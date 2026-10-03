# Spendsense

Personal finance copilot: bank transactions explained in plain language, anomaly alerts, a 30-day cash-flow forecast, savings ideas, a monthly health report, and Stripe free/Pro gating.

**Live demo (MOCK mode):** https://spendsense-sigma-one.vercel.app  
**Demo login:** `demo@spendsense.dev` / `demo-pass-123`  
**GitHub:** https://github.com/AnanthiVasan/spendsense

Capstone project for Impacteers Track 1 (FinTech). Stack substitutions from the brief: Next.js 15 App Router, Neon Postgres + pgvector, Gemini (`gemini-1.5-flash`, `text-embedding-004`) with deterministic mocks when keys are empty. Redis is not required.

## Architecture (short)

Browser → Next.js App Router → Auth.js session → Neon Postgres/pgvector. Plaid, Gemini, and Stripe are optional; empty keys use mock paths. Heavy work runs in `npm run seed` so request handlers stay short.

Full write-up: [docs/architecture.md](docs/architecture.md).

## Capstone deliverables

| Artefact | Location |
| --- | --- |
| Architecture (data flow, components, decisions) | [docs/architecture.md](docs/architecture.md) |
| RAG pipeline | [docs/rag-pipeline.md](docs/rag-pipeline.md) |
| pgvector schema + search notes | [docs/schema.md](docs/schema.md) |
| Categorisation accuracy + confusion matrices | [docs/categorization-accuracy.md](docs/categorization-accuracy.md) |
| Stripe webhook lifecycle | [docs/stripe-webhooks.md](docs/stripe-webhooks.md) |
| Prompt engineering notes | [docs/prompt-engineering.md](docs/prompt-engineering.md) |
| AI usage log (Cursor) | [docs/ai-usage-log.md](docs/ai-usage-log.md) |
| Written reflection | [docs/reflection.md](docs/reflection.md) |
| Demo shot list (record 5–10 min video from this) | [docs/demo-script.md](docs/demo-script.md) |
| Reviewer local setup | [docs/local-setup.md](docs/local-setup.md) |
| Overview slides | [docs/Spendsense-overview.pptx](docs/Spendsense-overview.pptx) |

## Run locally (MOCK mode)

Step-by-step: [docs/local-setup.md](docs/local-setup.md).

Plaid, Gemini, and Stripe stay mocked when their keys are empty. The database must be a Neon project (pooled URL), because the app uses `@neondatabase/serverless`.

```bash
npm install
cp .env.example .env.local
# Paste a Neon pooled DATABASE_URL and an AUTH_SECRET. Leave other keys empty.
# Apply db/migrations/*.sql in order (see docs/local-setup.md).
npm run seed
npm run dev
```

Open http://localhost:3000 and sign in as `demo@spendsense.dev` / `demo-pass-123`.

## Tests

```bash
npm test          # Vitest, no network
npm run test:watch
npm run e2e       # Playwright. Requires the migrated + seeded database
```

End-to-end tests boot `next dev` themselves. Export `DATABASE_URL` (Neon) before `npm run e2e`, or rely on CI’s pgvector service.

## Deploy

1. Create a free Postgres database on [Neon](https://neon.tech).
2. Enable pgvector: `CREATE EXTENSION IF NOT EXISTS vector;` (included in `db/migrations/001_init.sql`).
3. Copy the **pooled** connection string into `DATABASE_URL`.
4. Apply every file in `db/migrations/` in order.
5. Run `npm run seed` once.
6. Import the GitHub repo into [Vercel](https://vercel.com).
7. Set `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, and `NEXT_PUBLIC_APP_URL` (same public site URL).
8. Leave Plaid, Gemini, and Stripe empty for a mock production demo.
9. Optional Stripe test mode: webhook `https://<app>/api/stripe/webhook` and `STRIPE_WEBHOOK_SECRET`.

Vercel Hobby functions time out around 10 seconds. Categorisation, embeddings, anomalies, goals, and reports are prepared in `npm run seed`. During a live demo, prefer the already-seeded bank link over clicking **Connect bank**.

## Commands

| Command | What it does |
|---|---|
| `npm test` | Unit tests |
| `npm run e2e` | Playwright against the seeded demo user |
| `npm run seed` | Idempotent demo data |
| `npm run accuracy` | Writes `docs/categorization-accuracy.md` |
| `npm run rag:benchmark` | Writes `docs/rag-pipeline.md` latency numbers |
