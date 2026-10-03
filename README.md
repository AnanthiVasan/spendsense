# Spendsense

Personal spending app: Next.js App Router, Postgres + pgvector, and mock fallbacks for Plaid, Gemini, and Stripe.

## Run locally (MOCK mode)

Step-by-step for reviewers: [docs/local-setup.md](docs/local-setup.md).

Plaid, Gemini, and Stripe stay mocked when their keys are empty. The database still has to be a Neon project, because the app connects with `@neondatabase/serverless`.

```bash
npm install
cp .env.example .env.local
# Paste a Neon pooled DATABASE_URL and an AUTH_SECRET. Leave other keys empty.
# Then apply db/migrations/*.sql in order (commands are in docs/local-setup.md).
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

End-to-end tests boot `next dev` themselves. They read `DATABASE_URL` from the environment (default `postgres://postgres:postgres@localhost:5432/spendsense`). Apply migrations and run `npm run seed` first.

## Deploy

1. Create a free Postgres database on [Neon](https://neon.tech).
2. Enable pgvector: `CREATE EXTENSION IF NOT EXISTS vector;` (included in `db/migrations/001_init.sql`).
3. Copy the **pooled** connection string into `DATABASE_URL`. The app uses `@neondatabase/serverless` `Pool`, which connects to Neon.
4. Apply every file in `db/migrations/` with `psql`, in order.
5. Run `npm run seed` once against that database. It creates the demo user and precomputes categories, embeddings, alerts, the forecast inputs, goals, and one or two monthly reports.
6. Import the GitHub repo into [Vercel](https://vercel.com).
7. Set env vars from `.env.example`. For a mock production demo, set only `DATABASE_URL`, `AUTH_SECRET`, and `AUTH_URL`.
8. Set `NEXT_PUBLIC_APP_URL` to the Vercel URL (for example `https://spendsense.vercel.app`).
9. Optional Stripe test mode: create a webhook endpoint `https://<app>/api/stripe/webhook` in the Stripe dashboard and set `STRIPE_WEBHOOK_SECRET` to that endpoint's signing secret.

Vercel Hobby functions time out around 10 seconds. Per-request handlers only embed one query or call one model. Categorization, embeddings, anomaly detection, goal math, and report generation run in `npm run seed`. No `vercel.json` override is required.

## Commands

| Command | What it does |
|---|---|
| `npm test` | Unit tests |
| `npm run e2e` | Playwright against the seeded demo user |
| `npm run seed` | Idempotent demo data |
| `npm run accuracy` | Writes `docs/categorization-accuracy.md` |
| `npm run rag:benchmark` | Writes `docs/rag-pipeline.md` latency numbers |
