# Demo script

About 8 minutes. The app is already running at http://localhost:3000 in mock mode (no Plaid, Gemini, or Stripe keys). Sign in as `demo@spendsense.dev` / `demo-pass-123`. Say the amounts on screen if they differ; they come from the seeded ledger.

The ledger is about 90 days ending 2026-10-01. There is no March data.

## 1. Sign-in gate

Open a private window, or click **Sign out**, then go to http://localhost:3000/dashboard.

Say: "Dashboard routes require a session. An anonymous visit is sent to login."

Sign in with the demo account.

## 2. Dashboard

Point at the **Mock data** badge, **First Platypus Bank**, this month’s outflow, and the anomaly list.

Say: "Plaid keys are empty, so the bank link writes a fixed mock ledger. The alerts are spends more than 2 standard deviations above that category’s mean. The rupee amounts are the seeded numbers, shown in INR."

**Edge.** If the database connection is down, this page says the database is not configured and shows ₹0.00 instead of inventing a balance.

## 3. Transactions

Open **Transactions**.

- Amber + **low**: **Urban Living Apts**, category **Other**, **58%**. Say: "Rent is labeled other because housing is not one of the categories. Confidence under 0.6 is highlighted. The model does not silently call it a known category."
- Rose + **ALERT**: **Delta Air Lines ₹2,480.00** (2026-09-18), **Amazon ₹1,899.00** (2026-08-22), **Chipotle ₹420.00** (2026-07-30). Hover the alert. Say: "Those three are planted outliers. Smaller rows such as Whole Foods and PG&E can also flag when they clear mean + 2σ."

**Edge.** **Categorize new** does nothing visible when every row is already categorized. **Re-check for anomalies** rewrites the same flags; it does not call a model.

## 4. Copilot

Open **Copilot**. Free plan: 10 questions a day. Each click counts, including a refusal.

**Answer with sources.** Click **How much did I spend on food last month?**, **How much did I spend on travel?**, or **List my EMI payments**. Wait for the paragraph and the **Sources** list. Say: "Totals are computed from the retrieved rows. The citations are transaction ids, and the prose cannot add merchants that are not in that list."

**Refusal, off topic.** Ask `What is the capital of France?` and click **Send**. The answer is `I don't have enough data to answer that from your transactions.` and **Sources** is absent. Say: "Nothing in the ledger is close enough, so it refuses instead of answering from general knowledge. March is the same kind of miss: that month is outside this 90-day window, so it is not a suggested question."

**Edge.** A question shorter than 3 characters does not send. The 11th question today shows **Upgrade to Pro** and does not call the model.

## 5. Forecast

Open **Forecast**. Point at the shaded band and the projected end balance.

Say: "The line and the band are a 30-day heuristic. The band is 1.64 standard deviations of daily spend times the square root of the day, so it widens as the forecast goes out. The paragraph only restates those numbers. Starting balance is an assumed ₹3,500, not a live Plaid balance."

Point at recurring items: **Acme Payroll** biweekly (an inflow, shown negative because inflows are negative amounts), **SoFi Personal Loan** ₹425 monthly, **Urban Living Apts** ₹2,100 monthly.

**Edge.** The page names the first day the projected balance goes negative (2026-10-06 on this seed). The label under the chart says the narrative is mock because `GEMINI_API_KEY` is empty.

## 6. Goals

Open **Goals**. Point at **Potential total monthly savings** and one category card.

Say: "Only discretionary categories with at least five expenses are eligible: food, entertainment, shopping. EMI, rent, and utilities are excluded. Each suggestion is a 15% trim of the monthly average. The overall card blends those categories, so it is not added into the potential total."

**Edge.** **Accept** or **Dismiss** changes the status and is kept if you re-seed. Dismissed suggestions drop off the list. Do this only after the talking point, or the next run of the demo hides that card.

## 7. Monthly report

Open **Report**. Select **2026-09**.

Say: "The score is 0–100 from code: savings rate, spend versus income, anomaly count, and the month-over-month trend. This month is Needs attention because spend is above income. There are always exactly three action cards, built in code. The paragraph repeats those figures."

Switch to **2026-10**. Say: "October is the current partial month, so the complete-month default is September. July and August are on the same menu."

## 8. Billing

Open **Billing**.

Say: "Effective tier is free. Copilot shows how many of the 10 daily questions are used."

Click **Upgrade to Pro**.

Say: "Stripe keys are empty, so this mock success writes a Pro row locally and comes back here. Effective tier becomes pro and the copilot limit becomes unlimited. With real test keys, that row is written only by the webhook, not by the success page."

Stop before clicking **Upgrade** if you still want to show the free-tier quota in the same sitting.
