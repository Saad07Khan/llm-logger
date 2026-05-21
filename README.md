# LLM Logger

Production-grade LLM inference logging and ingestion. Streams chat through Gemini, GPT, or Claude, captures every request's latency / tokens / status into a queue, and surfaces it on a metrics dashboard.

```
┌──────────┐   SSE    ┌──────────────┐   BullMQ    ┌────────────┐   Prisma   ┌────────────┐
│  Browser │ ────────▶│ Next.js API  │ ──────────▶ │ Ingestion  │ ─────────▶ │ PostgreSQL │
│  (Chat)  │ ◀──────  │ + SDK Logger │             │ Worker     │            │            │
└──────────┘  tokens  └──────┬───────┘             └─────┬──────┘            └────────────┘
                             │                           │
                             ▼                           ▼
                       ┌──────────┐               ┌────────────┐
                       │  Redis   │ ◀──fallback── │ HTTP POST  │
                       │ (BullMQ) │     direct    │ /api/logs  │
                       └──────────┘               └────────────┘
```

## Setup

```bash
cp .env.example .env
# Edit .env — at minimum set GOOGLE_GEMINI_API_KEY
docker compose up --build
```

Visit `http://localhost:3000`. The chat page is the default landing.

| Service     | URL                       |
|-------------|---------------------------|
| Frontend    | http://localhost:3000     |
| Ingestion   | http://localhost:3001     |
| Postgres    | localhost:5432            |
| Redis       | localhost:6379            |

The frontend container runs `prisma migrate deploy` on boot (with `db push` as fallback if no migration history exists yet), so first-run is one command.

## Pages

- `/chat` — streaming chat, provider selector, cancel button, conversation sidebar
- `/conversations` — grid of every conversation, filter by status, cancel / resume / delete
- `/dashboard` — total requests, avg + p95 latency, error rate, total tokens, three time-series charts, per-provider breakdown

## Schema decisions

- **`cuid` over `uuid`** — shorter, sortable, URL-safe in tags / titles.
- **Cascading deletes** — `Message` and `InferenceLog` cascade on `Conversation` so the table doesn't accumulate orphans when a user wipes a thread.
- **Composite-friendly indexes** — `InferenceLog` indexes `(provider)`, `(status)`, `(requestTimestamp)`, and `(conversationId)` independently because the dashboard queries by each dimension; combining them prematurely costs writes more than reads.
- **`inputPreview` / `outputPreview`** are short, PII-redacted slices, not full payloads. Full payloads are not stored — keeping the table cheap and reducing the blast radius if it ever leaks.

## Tradeoffs

- **Next.js API routes + a single Express ingestion service** instead of full microservices. The producer and dashboard share a Node runtime; only the ingestion worker is split out so logging never blocks user-facing latency.
- **BullMQ over Kafka.** Redis is already a useful primitive (rate-limits, cache) and BullMQ ships retries, backoff, dead-letter, and stale-job cleanup. Kafka makes sense at >100k events/sec — not here.
- **Prisma over raw SQL.** Trades a small runtime cost for typed queries and migration ergonomics.
- **SSE over WebSocket.** Chat is unidirectional after the user hits send; SSE re-uses HTTP and survives proxies that hate WS.
- **Regex PII over an ML classifier.** Deterministic, zero cost, no external call. False negatives are possible for unusual formats — acceptable for previews; full payloads aren't stored anyway.
- **`provider` as a string column, not an enum.** New providers can be added by config without a migration.

## Improvements with more time

- Rate limiting on `/api/logs` and `/api/chat` (BullMQ already retries; throttling stops abuse).
- Authentication (NextAuth — Google + GitHub).
- Log retention / TTL cleanup (Postgres partition by month, drop old partitions).
- OpenTelemetry exporter so latency / token metrics land in Prometheus or Honeycomb.
- Horizontal scaling: ingestion is stateless and BullMQ distributes work across N workers.
- E2E tests with Playwright covering the streaming + cancel flow.

## Seeding sample data

The seed script and Playwright screenshot script live in `scripts/` and run as workspace npm tasks at the repo root. One-time setup:

```bash
npm install                       # hoists workspace deps (frontend + ingestion) to root
npm run prisma:generate           # generates the Prisma client used by the seed
```

Then, with `docker compose up` running:

```bash
npm run seed                      # 3 sample conversations + ~75 inference logs
```

## Screenshots

```bash
npm run playwright:install        # one-time
npm run screenshots               # writes docs/screenshots/{chat,conversations,dashboard}.png
```

### Chat
![Chat interface](docs/screenshots/chat.png)

### Conversations
![Conversation list](docs/screenshots/conversations.png)

### Dashboard
![Metrics dashboard](docs/screenshots/dashboard.png)

## Project layout

```
llm-logger/
├── docker-compose.yml
├── .env.example
├── frontend/                 # Next.js 14 app
│   ├── src/app/api/          # Chat (SSE), conversations, metrics
│   ├── src/lib/llm/          # Gemini / OpenAI / Anthropic providers
│   ├── src/lib/sdk/          # logger, queue, pii
│   └── src/components/       # Chat, conversations, dashboard UI
├── ingestion/                # Express + BullMQ worker
└── scripts/                  # seed, migrate, screenshots
```

See `ARCHITECTURE.md` for the ingestion flow, failure handling, and scaling notes.
