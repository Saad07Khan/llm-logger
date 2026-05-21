# Architecture

## Components

| Service     | Runtime       | Responsibility                                                         |
|-------------|---------------|------------------------------------------------------------------------|
| `frontend`  | Next.js 14    | UI, API routes (`/api/chat`, `/api/conversations`, `/api/metrics`), SDK logger that wraps every LLM call |
| `ingestion` | Node + Express| BullMQ worker + HTTP fallback endpoint, validates and persists inference logs |
| `postgres`  | Postgres 16   | Source of truth for conversations, messages, inference logs            |
| `redis`     | Redis 7       | BullMQ broker for async log delivery                                   |

## Ingestion flow

```
User sends message
  └─▶ Next.js POST /api/chat
        ├─ Create USER Message row
        ├─ Load last 10 messages for context
        └─ SDK Logger wraps provider.chatStream()
              ├─ start = Date.now()
              ├─ Stream tokens → SSE back to browser
              ├─ end = Date.now()
              ├─ Build InferenceLogPayload
              ├─ Redact PII on input/output previews
              └─ enqueueInferenceLog(payload)  ─┐
                                                │
                       ┌────────────────────────┘
                       ▼
              BullMQ inference-log queue (Redis)
                       │
                       ▼
              Ingestion Worker
                ├─ Zod validate
                ├─ Enrich (tokens/sec, slow flag)
                └─ Prisma create InferenceLog
```

The producer (`enqueueInferenceLog`) is fire-and-forget from the request's perspective — the SSE stream completes before the worker writes. The user-visible chat latency is never blocked by ingestion.

## Logging strategy

- **One row per request.** Streaming requests are logged once when the stream completes (or errors / cancels), not per-token.
- **Status tracks lifecycle.** `SUCCESS`, `ERROR`, `TIMEOUT`, `CANCELLED` — distinct so the dashboard can separate user-cancelled streams from provider failures.
- **Tokens captured from provider metadata.** Each provider's SDK returns usage in different shapes; the LLMProvider adapter normalizes to `inputTokens`, `outputTokens`, `totalTokens`. `null` is preserved when the provider doesn't report (e.g., aborted stream before final).
- **Previews, not payloads.** Only the first 200 chars of input and output are stored, PII-redacted via regex. Full content lives in `Message` rows under `Conversation`, which the user controls.
- **Metadata is `Json`.** Worker enrichment adds `tokensPerSecond` and `slow` (>5s) without a migration.

## Failure handling

| Failure                  | Behavior                                                                 |
|--------------------------|--------------------------------------------------------------------------|
| LLM provider errors      | SDK records `status=ERROR`, error message + code, partial output if any  |
| User aborts the stream   | `AbortController` fires, SDK logs `status=CANCELLED` with what streamed  |
| Redis unreachable        | `enqueueInferenceLog` falls back to HTTP POST to `ingestion:3001/api/logs` |
| Ingestion service down   | Redis retains jobs; worker drains on recovery (no data loss)             |
| DB write fails           | BullMQ retries 3× with exponential backoff (1s → 2s → 4s)                |
| Validation fails         | Job goes to failed set with the issue path / message; not retried        |
| Frontend container restart | Prisma `migrate deploy` runs on entry; falls back to `db push` if no migration history exists |

## Scaling

- **Ingestion is stateless** — scale horizontally by adding more containers. BullMQ distributes jobs across all workers connected to the same Redis instance.
- **PostgreSQL indexes** are tuned for dashboard queries: time-range scans on `requestTimestamp`, equality on `provider` and `status`. At >10M rows, partition `InferenceLog` by month.
- **Connection pooling via Prisma**. For higher throughput, front Postgres with PgBouncer in transaction mode.
- **Read replica** for the dashboard query path once writes outpace mixed reads.
- **Bullmq concurrency** is set to 5 per worker; raise it as DB write throughput allows.

## SDK design

The SDK (`frontend/src/lib/sdk/logger.ts`) exposes two functions:

```ts
loggedChat(provider, messages, ctx, options): Promise<LLMResponse>
loggedChatStream(provider, messages, ctx, options): AsyncGenerator<LLMStreamChunk, LLMResponse>
```

Both:
1. Record `Date.now()` before invoking the provider.
2. Delegate to the provider's `chat` / `chatStream` (which is responsible for token accounting).
3. Record `Date.now()` on completion / error / abort.
4. Run PII redaction on input + output previews.
5. Enqueue the payload — never throws inside `enqueueInferenceLog`; failures fall back to direct HTTP.

This isolates "logging the call" from "making the call", so adding a new provider is a single file (implement `LLMProvider`) and a factory case.

## Why these choices

- **Producer in-process with Next.js.** Same Node runtime as the chat route means no extra hop to start a log. The async push to Redis is the only side-effect.
- **Worker out-of-process.** A bad DB or slow Prisma write must never stall a user's stream. A separate service makes that contract explicit.
- **Postgres for both relational state and log storage.** Logs need joins with conversations to render the dashboard breakdown; a single store keeps that cheap. Once volume justifies it, move logs to ClickHouse and keep relational state in Postgres.
