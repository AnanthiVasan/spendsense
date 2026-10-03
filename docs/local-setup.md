# Run Spendsense locally

This is the path for a reviewer (or anyone) checking the app on their own machine. Leave Plaid, Gemini, and Stripe blank. Those features stay in mock mode. You still need one real Postgres database, because sign-in, transactions, and the seed script persist rows.

The app uses `@neondatabase/serverless`, which connects to [Neon](https://neon.tech). A local Docker Postgres instance is not a drop-in substitute for that driver.

## What you need

- Node.js 22 (20 or newer also works). Check with `node -v`.
- A free Neon project. Create one at https://console.neon.tech and copy the **pooled** connection string.
- `psql` on your PATH, or Docker, only as a client that runs the SQL files against Neon.

## 1. Install dependencies

From the repo root:

```bash
npm install
```

## 2. Environment file

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
DATABASE_URL=postgres://USER:PASSWORD@HOST/neondb?sslmode=require
AUTH_SECRET=replace-with-openssl-rand-base64-32
AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Generate a secret with:

```bash
openssl rand -base64 32
```

Leave `PLAID_CLIENT_ID`, `PLAID_SECRET`, `GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_ID_PRO` empty. `.env.local` is gitignored.

## 3. Apply migrations

The files live in `db/migrations/` and must run in filename order. `001_init.sql` creates the `vector` extension.

If `psql` is installed:

```bash
set -a
source .env.local
set +a

for file in db/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
done
```

Without `psql`, the Postgres client image is enough:

```bash
set -a
source .env.local
set +a

for file in db/migrations/*.sql; do
  docker run --rm -i postgres:16 psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f - < "$file"
done
```

## 4. Seed the demo ledger

```bash
npm run seed
```

The script loads `.env.local` itself. It creates the demo user and about 90 days of deterministic mock transactions, then fills categories, embeddings, anomaly alerts, savings goals, and monthly reports. It is safe to run again.

Demo login printed at the end:

- Email: `demo@spendsense.dev`
- Password: `demo-pass-123`

## 5. Start the app

```bash
npm run dev
```

Open http://localhost:3000. Sign in with the demo account. The dashboard shows a **Mock data** badge when Plaid keys are empty.

## What to click

Use the nav in this order. Amounts come from the seeded ledger.

1. **Dashboard.** The mock institution is already linked by the seed. Click **Connect bank** if you want to see the mock link path again. It returns you to Transactions.
2. **Transactions.** Categories and confidence are on each row. Low confidence is amber. Flagged outliers are rose. Hover an alert badge for the z-score reason.
3. **Copilot.** Ask `how much did I spend on food last month?` and wait for an answer plus a **Sources** list. Then ask `What is the capital of France?` The off-topic question should refuse with no sources.
4. **Forecast.** The chart is a 30-day balance with a shaded band. The paragraph restates numbers computed in code.
5. **Goals.** Recommendations are a 15% trim of discretionary categories. Accept or dismiss one.
6. **Report.** Score, narrative, and exactly three action items.
7. **Billing.** Click **Upgrade to Pro**. With Stripe keys empty, this marks the account Pro locally and returns to Billing.

A fuller shot list is in [demo-script.md](./demo-script.md).

You can also create an account from **Sign up**. That user starts with an empty ledger until they connect the mock bank.

## Tests

Unit tests do not need a database or API keys:

```bash
npm test
```

End-to-end tests need the migrated and seeded Neon database. Export the same URL before Playwright starts, so it does not fall back to a local Postgres default:

```bash
set -a
source .env.local
set +a

npx playwright install chromium
npm run e2e
```

If `npm run dev` is already running against this `.env.local`, Playwright reuses that server. The HTML report is written to `playwright-report/`.

## If something fails

- `DATABASE_URL is not set` on seed: `.env.local` is missing or the variable is empty.
- Dashboard says the database is not configured: migrations were not applied, or the URL does not point at the Neon database you seeded.
- Copilot or forecast is empty: run `npm run seed` again while `npm run dev` is stopped, then refresh.
- `vector` extension errors: the database role cannot create extensions. Use a Neon project database, then rerun `001_init.sql`.
