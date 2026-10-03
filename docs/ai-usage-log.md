# AI usage log

Capstone build of **SpendSense** (Impacteers Track 1, FinTech). Development tool: **Cursor** (Agent). No GitHub Copilot and no v0.dev were used for this project.

Edit rows if you remember extra sessions; dates are approximate India time (IST), October 2026.

| When (approx.) | Tool | What was asked / produced | How it shaped the build |
| --- | --- | --- | --- |
| Early Oct | Cursor Agent | Scaffold Next.js App Router + Auth.js credentials + Postgres migrations with `pgvector` | Created `app/`, `lib/db.ts`, `db/migrations/001_init.sql`, login/signup, session-gated dashboard |
| Early Oct | Cursor Agent | Plaid sandbox + deterministic mock when keys empty | `lib/plaid.ts`, `lib/plaid-mock.ts`, connect-bank UI, sync APIs |
| Early Oct | Cursor Agent | Seed script + Gemini/keyword categorisation + accuracy report | `scripts/seed.ts`, `lib/categorize.ts`, `docs/categorization-accuracy.md` |
| Mid Oct | Cursor Agent | Embeddings + LangChain user-scoped RAG + benchmark docs | `lib/llm.ts`, `lib/rag.ts`, `docs/rag-pipeline.md` |
| Mid Oct | Cursor Agent | Grounded copilot with citations and refusal | `lib/copilot.ts`, `/copilot` UI, quota hook |
| Mid Oct | Cursor Agent | Anomaly detection (mean + 2σ) + alerts UI | `lib/anomaly.ts`, rose rows, dashboard card |
| Mid Oct | Cursor Agent | 30-day forecast + Recharts bands + narrative | `lib/forecast.ts`, forecast page |
| Mid Oct | Cursor Agent | Savings goals (15% discretionary trim) | `lib/goals.ts`, accept/dismiss UI |
| Mid Oct | Cursor Agent | Monthly health report + exactly 3 actions | `lib/report.ts`, `/report` |
| Mid Oct | Cursor Agent | Stripe free/Pro + webhook + mock upgrade | `lib/stripe*.ts`, billing UI |
| Mid Oct | Cursor Agent | Vitest + Playwright + GitHub Actions CI | `tests/`, `e2e/`, `.github/workflows/ci.yml` |
| Mid Oct | Cursor Agent | Local setup + architecture + demo script docs | `docs/local-setup.md`, `architecture.md`, `demo-script.md` |
| Mid Oct | Cursor Agent | Switch display currency to INR | `lib/money.ts` + UI formatters |
| Mid Oct | Cursor Agent | Neon DB wiring, seed, fix idle connection pool | `.env.local` (local only), `lib/db.ts` reconnect |
| Mid Oct | Cursor Agent | Fix mock RAG for “food last month”; replace March chip | `expandQueryForEmbedding`, Copilot suggestions |
| Mid Oct | Cursor Agent | Plain-English PowerPoint for demos | `docs/Spendsense-overview.pptx` |
| Mid Oct | Cursor Agent | Deploy mock demo to Vercel + Neon | Live URL on Vercel Hobby |
| Mid Oct | Cursor Agent | Push to GitHub `AnanthiVasan/spendsense` | Initial commit + remote |
| 3 Oct | Cursor Agent | Capstone deliverable docs (prompts, AI log, reflection, architecture) | This file and siblings under `docs/` |

## Notes for graders

- AI tooling was used for implementation and docs; **numeric finance logic was specified to stay in code**, not in the model.
- Live demo runs in **MOCK mode** (empty Plaid / Gemini / Stripe keys) against a seeded Neon database.
- Secrets (`.env.local`, Neon password) were never committed.
