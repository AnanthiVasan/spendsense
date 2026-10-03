# AI usage log

Capstone build of **SpendSense** (Impacteers Track 1, FinTech). Development tool: **Cursor** (Agent). No GitHub Copilot and no v0.dev were used for this project.

Three-day build plan (IST). Edit wording if you want it more personal.

## Day 1 — 1 Oct 2026 · Foundation

| Tool | What was asked / produced | How it shaped the build |
| --- | --- | --- |
| Cursor Agent | Scaffold Next.js App Router + Auth.js credentials + Postgres migrations with `pgvector` | Created `app/`, `lib/db.ts`, `db/migrations/001_init.sql`, login/signup, session-gated dashboard |
| Cursor Agent | Plaid sandbox + deterministic mock when keys empty | `lib/plaid.ts`, `lib/plaid-mock.ts`, connect-bank UI, sync APIs |
| Cursor Agent | Seed script + Gemini/keyword categorisation + accuracy report | `scripts/seed.ts`, `lib/categorize.ts`, `docs/categorization-accuracy.md` |
| Cursor Agent | Embeddings + LangChain user-scoped RAG + benchmark docs | `lib/llm.ts`, `lib/rag.ts`, `docs/rag-pipeline.md` |
| Cursor Agent | Grounded copilot with citations and refusal | `lib/copilot.ts`, `/copilot` UI |

## Day 2 — 2 Oct 2026 · Insights, billing, ship

| Tool | What was asked / produced | How it shaped the build |
| --- | --- | --- |
| Cursor Agent | Anomaly detection (mean + 2σ) + alerts UI | `lib/anomaly.ts`, rose rows, dashboard card |
| Cursor Agent | 30-day forecast + Recharts bands + narrative | `lib/forecast.ts`, forecast page |
| Cursor Agent | Savings goals (15% discretionary trim) | `lib/goals.ts`, accept/dismiss UI |
| Cursor Agent | Monthly health report + exactly 3 actions | `lib/report.ts`, `/report` |
| Cursor Agent | Stripe free/Pro + webhook + mock upgrade | `lib/stripe*.ts`, billing UI |
| Cursor Agent | Vitest + Playwright + GitHub Actions CI | `tests/`, `e2e/`, `.github/workflows/ci.yml` |
| Cursor Agent | Local setup, architecture, demo script | `docs/local-setup.md`, early `architecture.md`, `demo-script.md` |
| Cursor Agent | Switch display currency to INR | `lib/money.ts` + UI formatters |
| Cursor Agent | Neon wiring, seed, idle connection reconnect | Local `.env.local` (not committed), `lib/db.ts` |
| Cursor Agent | Fix mock RAG for food questions; working Copilot chips | `expandQueryForEmbedding`, suggestion list |
| Cursor Agent | Plain-English PowerPoint | `docs/Spendsense-overview.pptx` |
| Cursor Agent | Deploy MOCK demo to Vercel + Neon | https://spendsense-sigma-one.vercel.app |

## Day 3 — 3 Oct 2026 · Submit artefacts

| Tool | What was asked / produced | How it shaped the build |
| --- | --- | --- |
| Cursor Agent | Push working app to GitHub | https://github.com/AnanthiVasan/spendsense |
| Cursor Agent | Capstone docs: prompts, AI log, reflection, architecture, README index | `docs/prompt-engineering.md`, this file, `docs/reflection.md`, updated `docs/architecture.md`, `README.md` |
| Cursor Agent | Make the repository public | Repo visibility set to public |

## Notes for graders

- AI tooling was used for implementation and docs; **numeric finance logic was specified to stay in code**, not in the model.
- Live demo runs in **MOCK mode** (empty Plaid / Gemini / Stripe keys) against a seeded Neon database.
- Secrets (`.env.local`, Neon password) were never committed.
