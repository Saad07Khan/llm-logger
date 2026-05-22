# LLM Logger

A production-grade chat surface for Groq, Gemini, OpenAI, and Anthropic that logs every inference call (latency, tokens, status, errors) into a queue-backed Postgres store, then renders the whole thing on a metrics dashboard. One repo, one `docker compose up`, four real provider SDKs, real streaming, real numbers.

![Dashboard](docs/screenshots/dashboard.png)

## Table of contents

1. [What this is](#what-this-is)
2. [Screenshots](#screenshots)
3. [Quickstart](#quickstart)
4. [Architecture](#architecture)
5. [Pages](#pages)
6. [Providers](#providers)
7. [Conversation lifecycle](#conversation-lifecycle)
8. [SDK logger and PII redaction](#sdk-logger-and-pii-redaction)
9. [API surface](#api-surface)
10. [Database schema](#database-schema)
11. [Project layout](#project-layout)
12. [Local development](#local-development)
13. [Environment variables](#environment-variables)
14. [Troubleshooting](#troubleshooting)
15. [Design tradeoffs](#design-tradeoffs)
16. [Roadmap](#roadmap)

## What this is

LLM Logger is two things stitched together:

1. **A chat application.** Pick a provider, send a message, watch tokens stream back in real time. Conversations persist, can be paused or deleted, and survive restarts.
2. **An observability layer.** Every call to a provider is wrapped by an in-process SDK that records start time, end time, token usage, status, and the first 200 characters of input and output (PII-redacted). Those events are pushed onto a BullMQ queue (Redis) and consumed by a separate ingestion service that validates and persists them to Postgres. The dashboard reads from that table.

It is intentionally small enough to fit in one repo, but the seams are real: the producer is in-process with the chat route so logging adds no extra hop on the request path, while the consumer runs in its own container so a slow database can never stall a user's stream.

## Screenshots

### Chat (empty state)
![Chat empty state](docs/screenshots/chat-empty.png)

### Chat (streaming reply, sidebar with recents)
![Chat with messages](docs/screenshots/chat-messages.png)

### Conversations (with status filter)
![Conversations dashboard](docs/screenshots/conversations.png)

### Paused conversation (Resume banner, input disabled)
![Paused banner](docs/screenshots/paused-banner.png)

### Metrics dashboard
![Metrics dashboard](docs/screenshots/dashboard.png)

## Quickstart

You need Docker Desktop and one provider API key. The fastest one to get is a free Groq key at [console.groq.com](https://console.groq.com).

```bash
git clone https://github.com/Saad07Khan/llm-logger.git
cd llm-logger
cp .env.example .env
# Open .env and paste at least one of:
#   GROQ_API_KEY=...
#   GOOGLE_GEMINI_API_KEY=...
#   OPENAI_API_KEY=...
#   ANTHROPIC_API_KEY=...
docker compose up --build
```

Then open [http://localhost:3000](http://localhost:3000). The chat page is the landing surface.

| Service     | URL                       | What runs there                                  |
|-------------|---------------------------|--------------------------------------------------|
| Frontend    | http://localhost:3000     | Next.js 14 (App Router, standalone output)       |
| Ingestion   | http://localhost:3001     | Express worker + HTTP fallback for log writes    |
| Postgres    | localhost:5432            | Postgres 16, schema auto-applied on first boot   |
| Redis       | localhost:6379            | BullMQ broker                                    |

First boot: the frontend container runs an idempotent enum migration, then `prisma db push` to align the schema, then starts the Next.js server. Total cold start is around 5 to 15 seconds depending on hardware.

## Architecture

```
┌───────────────┐   SSE     ┌─────────────────┐   BullMQ    ┌───────────────┐   Prisma   ┌────────────┐
│    Browser    │ ────────▶ │  Next.js API    │ ──────────▶ │   Ingestion   │ ─────────▶ │ PostgreSQL │
│    (Chat)     │ ◀──────── │  + SDK Logger   │   payload   │    Worker     │            │            │
└───────────────┘  tokens   └────────┬────────┘             └───────┬───────┘            └────────────┘
                                     │                              │
                                     ▼                              ▼
                              ┌─────────────┐               ┌──────────────────┐
                              │    Redis    │ ◀──fallback── │    HTTP POST     │
                              │   (BullMQ)  │    direct     │    /api/logs     │
                              └─────────────┘               └──────────────────┘
```

The chat request path is deliberately direct: the browser opens a `text/event-stream` to `/api/chat`, that route invokes the provider SDK and streams tokens back as they arrive. The logging is a side-channel that fires once the stream completes (or errors, or is cancelled). If Redis is unreachable, the producer falls back to a direct HTTP POST to the ingestion service, so a Redis outage never loses a log line.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full ingestion flow, failure handling table, and scaling notes.

## Pages

### `/chat`
Streaming chat. Provider selector (Groq / Gemini / OpenAI / Anthropic) and model are switchable per conversation. Live status: streaming dots while waiting for the first token, animated cursor for active deltas, Cancel button that aborts the in-flight call (and records `status=CANCELLED` on the log). Sidebar Recent list updates instantly when anything changes (no polling lag).

### `/conversations`
A grid view of every conversation. Tabs at the top filter by status (All / Active / Paused) with live counts. Each card shows the title, last message preview, provider chip, message count, and time since update. Per-card actions: Open, Pause (or Resume if already paused), Delete. Deletes cascade through messages and inference logs and propagate to the sidebar Recent in the same render tick.

### `/dashboard`
Inference metrics across all providers. Window selector for the last 1h / 6h / 24h / 7d. Four KPI tiles (total requests, average latency, error rate, total tokens), three time-series charts (latency over time, throughput, errors), and a per-provider breakdown table with average latency, error count, and error rate.

## Providers

Each provider implements a small `LLMProvider` interface in `frontend/src/lib/llm/`. Adding a new one is a single file plus a factory case.

| Provider  | Default model                       | Env var                  |
|-----------|-------------------------------------|--------------------------|
| Groq      | `llama-3.3-70b-versatile`           | `GROQ_API_KEY`           |
| Gemini    | `gemini-2.0-flash`                  | `GOOGLE_GEMINI_API_KEY`  |
| OpenAI    | `gpt-4.1-nano`                      | `OPENAI_API_KEY`         |
| Anthropic | `claude-sonnet-4-20250514`          | `ANTHROPIC_API_KEY`      |

Groq is the default and the recommended starter because the free tier has generous quota and reliable streaming. Gemini is also free but its quota is per-project and can read as zero on brand new accounts.

## Conversation lifecycle

A conversation has two states:

- **Active.** Default. Fully writable.
- **Paused.** Read-only. The chat page shows a Paused breadcrumb chip, a banner with a Resume button and an "All conversations" link, and the input textarea is disabled with a placeholder that explains why.

Pause and Resume are explicit user actions on the dashboard or on the chat page. There is no auto-archival. The earlier draft of this app had a third "Completed" status but no flow ever populated it, so it was removed in favor of a two-state model that maps cleanly to user intent. The schema migration (`prisma/migrate-statuses.js`) renames `CANCELLED` to `PAUSED` in place and drops `COMPLETED`, so upgrading an existing database is a no-op restart.

Mutations propagate through a small `conversations:changed` `CustomEvent` so the sidebar, the chat view, and the conversations grid all stay in sync instantly. There is no polling round-trip.

## SDK logger and PII redaction

Every provider call goes through `loggedChat` / `loggedChatStream` in `frontend/src/lib/sdk/logger.ts`. The wrapper:

1. Records a high-resolution timestamp before delegating to the provider.
2. Streams tokens back to the caller untouched.
3. On completion (or error, or abort), assembles a normalized `InferenceLogPayload` with provider, model, status, latency, input and output token counts, error message and code if any, and 200-character previews of input and output.
4. Runs the previews through a regex PII redactor (email, phone, SSN, credit card, IPv4).
5. Enqueues the payload to BullMQ. If Redis is down, falls back to a direct HTTP POST.

Statuses are intentionally distinct: `SUCCESS`, `ERROR`, `TIMEOUT`, `CANCELLED`. The dashboard can separate provider-side failures from user-cancelled streams.

The full prompt and response live in the `Message` table under `Conversation`, which is user-owned and can be deleted at any time. Only the redacted preview lives in `InferenceLog`. That keeps the metrics table cheap and reduces blast radius if it ever leaks.

## API surface

All routes are colocated in `frontend/src/app/api/`.

### Chat

- `POST /api/chat` body `{ conversationId, message, provider? }`. Streams `text/event-stream` with three event types: `delta` (token chunks), `done` (final usage), `error` or `cancelled`. Refuses with `409` if the conversation is paused.

### Conversations

- `GET /api/conversations` lists all conversations with last message preview and message count.
- `POST /api/conversations` creates one with `{ title?, provider?, model? }`.
- `GET /api/conversations/[id]` returns one with full message history.
- `PATCH /api/conversations/[id]` updates `{ title?, status?, provider? }`.
- `DELETE /api/conversations/[id]` removes the conversation and cascades messages and inference logs.

### Metrics

- `GET /api/metrics?period=24h` returns KPIs, time series for latency / throughput / errors, and a per-provider breakdown. `period` accepts `1h`, `6h`, `24h`, `7d`.

### Ingestion

- `POST /api/logs` on the ingestion service is the direct-HTTP fallback. It accepts the same `InferenceLogPayload` that BullMQ would deliver.

## Database schema

Three tables, three enums. CUIDs over UUIDs (shorter, sortable, URL-safe).

```prisma
model Conversation {
  id        String             @id @default(cuid())
  title     String?
  status    ConversationStatus @default(ACTIVE)
  provider  String
  model     String
  createdAt DateTime           @default(now())
  updatedAt DateTime           @updatedAt
  messages       Message[]
  inferenceLogs  InferenceLog[]
  @@index([status])
  @@index([createdAt])
}

model Message {
  id              String   @id @default(cuid())
  conversationId  String
  role            Role
  content         String
  redactedContent String?
  tokenCount      Int?
  createdAt       DateTime @default(now())
  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  @@index([conversationId])
  @@index([createdAt])
}

model InferenceLog {
  id                String        @id @default(cuid())
  conversationId    String
  provider          String
  model             String
  status            RequestStatus @default(SUCCESS)
  requestTimestamp  DateTime
  responseTimestamp DateTime?
  latencyMs         Int?
  inputTokens       Int?
  outputTokens      Int?
  totalTokens       Int?
  inputPreview      String?
  outputPreview     String?
  errorMessage      String?
  errorCode         String?
  metadata          Json?
  createdAt         DateTime      @default(now())
  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  @@index([conversationId])
  @@index([provider])
  @@index([status])
  @@index([requestTimestamp])
  @@index([createdAt])
}

enum ConversationStatus { ACTIVE PAUSED }
enum Role               { USER ASSISTANT SYSTEM }
enum RequestStatus      { SUCCESS ERROR TIMEOUT CANCELLED }
```

Notes:

- `provider` is a free-text column, not an enum, so a new provider can be added without a migration.
- `metadata Json` lets the ingestion worker stamp derived fields like `tokensPerSecond` and `slow` (latency over 5s) without touching the schema.
- Indexes are tuned for dashboard queries: range scans on `requestTimestamp`, equality on `provider` and `status`. At more than ten million log rows, partition by month.

## Project layout

```
llm-logger/
├── docker-compose.yml          # Frontend, ingestion, postgres, redis
├── .env.example
├── ARCHITECTURE.md             # Ingestion flow, failure handling, scaling
├── README.md                   # You are here
├── docs/
│   └── screenshots/            # PNGs referenced by this README
├── frontend/                   # Next.js 14 app, the chat + dashboard
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrate-statuses.js # Idempotent enum migration on container start
│   ├── docker-entrypoint.sh
│   ├── Dockerfile
│   └── src/
│       ├── app/                # App Router pages and API routes
│       ├── components/
│       │   ├── chat/           # ChatInput, ChatWindow, MessageBubble, StreamingDot, ProviderSelect
│       │   ├── conversations/  # ConversationCard
│       │   ├── dashboard/      # KPI tiles, charts, breakdown
│       │   └── layout/         # Sidebar, Bracketed (corner-bracket frame)
│       ├── hooks/              # useChat, useConversations
│       ├── lib/
│       │   ├── llm/            # Provider adapters (groq, gemini, openai, anthropic) + factory
│       │   ├── sdk/            # logger, pii redaction, queue producer
│       │   └── prisma.ts
│       └── types/
├── ingestion/                  # Express + BullMQ worker
│   ├── src/
│   │   ├── worker.ts           # BullMQ consumer
│   │   └── api.ts              # POST /api/logs HTTP fallback
│   └── Dockerfile
└── scripts/                    # seed and screenshot helpers
```

## Local development

The repo is an npm workspaces monorepo. The Docker compose path is the recommended way to run it because it is what production looks like, but you can also run pieces locally.

```bash
npm install                                  # hoists workspace deps to root
npm run prisma:generate --workspace frontend # generates the Prisma client
npm run dev --workspace frontend             # next dev on :3000
npm run dev --workspace ingestion            # tsx watch on :3001
```

You still need a Postgres and a Redis somewhere. The compose file's `postgres` and `redis` services are happy to run on their own:

```bash
docker compose up postgres redis -d
```

### Seeding sample data

```bash
npm install
npm run prisma:generate --workspace frontend
npm run seed              # runs scripts/seed.ts
```

Adds three sample conversations spanning each provider and about 75 inference logs across the last 24 hours so the dashboard has something to draw.

## Environment variables

| Variable                | Required        | Default                                                  | Notes                                                |
|-------------------------|-----------------|----------------------------------------------------------|------------------------------------------------------|
| `DATABASE_URL`          | yes             | `postgresql://postgres:postgres@postgres:5432/llm_logger`| Compose default points at the bundled Postgres       |
| `REDIS_URL`             | yes             | `redis://redis:6379`                                     | Compose default points at the bundled Redis          |
| `INGESTION_URL`         | yes             | `http://ingestion:3001`                                  | Used by the producer's HTTP fallback                 |
| `GROQ_API_KEY`          | at least one of | empty                                                    | Recommended starter, fast + generous free tier       |
| `GOOGLE_GEMINI_API_KEY` | at least one of | empty                                                    |                                                      |
| `OPENAI_API_KEY`        | at least one of | empty                                                    |                                                      |
| `ANTHROPIC_API_KEY`     | at least one of | empty                                                    |                                                      |
| `NODE_ENV`              | no              | `development`                                            |                                                      |

The `.env` file is gitignored. Only `.env.example` is committed, and it has blank placeholders. Never commit a real key.

## Troubleshooting

**`docker compose up` hangs on "Generating static pages".** First build is slow; Next runs prerender on every page. Subsequent builds are cached. If a real failure surfaces, the most common cause on Next 14 is a server component reading `useSearchParams` outside a Suspense boundary. The repo wraps all such reads.

**`/api/chat` returns 409 with "Conversation is paused".** Expected. Pause is enforced on the server too, not just in the UI. Open the conversation and click Resume.

**Dashboard shows 100% errors for one provider.** Likely a quota or API-key issue with that specific provider. Check the InferenceLog row's `errorMessage` (the SDK records the real response), or just rotate the key.

**Sidebar does not update after I pause from /conversations.** It should update in the same tick via `conversations:changed`. If you are running with HMR off and an older build, hard reload once.

**Frontend container exit code 1 with prisma errors.** The entrypoint runs `migrate-statuses.js` then `prisma db push`. If migrate fails (for example connection refused while Postgres is still warming up), Docker will restart the container per the `restart: unless-stopped` policy. Wait 10 seconds. If it keeps failing, `docker compose logs frontend` will tell you which step.

**Port 3000 already in use.** Kill the other process or change the host port in `docker-compose.yml`. On Windows, `netstat -ano | findstr :3000` plus `taskkill /PID <pid> /F`.

## Design tradeoffs

- **Next.js API routes + one Express ingestion service**, not a microservice mesh. The producer and dashboard share a Node runtime; only the ingestion worker is split out so logging never blocks user-facing latency.
- **BullMQ over Kafka.** Redis is already a useful primitive (rate limits, cache) and BullMQ ships retries, exponential backoff, and dead-letter handling. Kafka makes sense above 100k events per second. Not this app.
- **SSE over WebSocket.** Chat is unidirectional after the user hits send. SSE reuses HTTP, survives proxies that hate WS, and is supported by every browser without a library.
- **Regex PII redaction, not ML.** Deterministic, zero cost, no external call. False negatives exist for exotic formats, which is acceptable here because full payloads are never stored in the log table.
- **Prisma over raw SQL.** Small runtime cost in exchange for typed queries and migration ergonomics that are worth it on a single-author repo.
- **One row per request, not per token.** Streaming requests log once on completion. Per-token logging multiplies the row count by orders of magnitude with no extra signal.
- **Postgres for relational state and log storage.** Logs need joins with conversations to render the dashboard breakdown. Once volume justifies it, move logs to ClickHouse and keep the relational state where it is.

## Roadmap

- Rate limiting on `/api/chat` and `/api/logs` (BullMQ retries, but throttling stops abuse).
- Authentication via NextAuth (Google + GitHub).
- Log retention with monthly Postgres partitions and a TTL drop policy.
- OpenTelemetry exporter so latency and token metrics land in Prometheus or Honeycomb.
- Horizontal ingestion scaling. The worker is already stateless; BullMQ distributes across all workers on the same Redis.
- Playwright end-to-end coverage of streaming, cancel, pause, resume, and delete.
- Provider routing rules: cost-aware fallback when the primary provider is over quota or slow.

## License

MIT. Use it, ship it, fork it.
