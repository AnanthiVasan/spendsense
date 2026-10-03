# Prompt engineering notes

Spendsense uses the model for **prose and structured labels only**. Totals, z-scores, forecast balances, savings math, health scores, and action items are computed in TypeScript. When `GEMINI_API_KEY` is empty, each path falls back to a deterministic mock so demos and CI never need a paid key.

Primary model in code: Google Gemini `gemini-1.5-flash` (capstone brief lists GPT-4; Gemini is the approved substitution used in this repo). Embeddings: `text-embedding-004` (768-d) or hashed mock vectors of the same shape.

---

## 1. Transaction categorisation

**File:** `lib/categorize.ts` → `fewShotPrompt`  
**Output:** JSON `{"category":"<enum>","confidence":0-1}`  
**Temperature:** `0`  
**Why:** Classification should be stable. Structured JSON + Zod parsing means a bad string never lands in the database.

**Design choices**

- Few-shot examples cover every enum value, including rent as `other` with low confidence (`0.6`), so housing is not forced into a wrong bucket.
- Negative amounts (payroll) map to `income`.
- One retry, then `{ category: "other", confidence: 0 }` if the model fails.
- Merchant-level in-memory cache avoids repeat calls for the same merchant during a seed run.

**Final prompt shape (abbreviated)**

```
You are Spendsense's transaction classifier.
Return ONLY JSON: {"category":"<enum>","confidence":<0-1 float>}.
Allowed category values: food, travel, utilities, EMI, groceries, entertainment, income, health, shopping, other.
Examples: Starbucks→food, Whole Foods→groceries, Delta→travel, PG&E→utilities,
SoFi→EMI, Netflix→entertainment, Acme Payroll→income, CVS→health, Amazon→shopping,
Urban Living Apts→other (0.6).
Classify this transaction: { merchant_name, amount, raw_description }
```

**Mock path:** keyword rules in `lib/categories.ts` when the API key is absent.

---

## 2. Copilot (grounded Q&A)

**File:** `lib/copilot.ts` → `groundedPrompt`  
**Temperature:** `0.2`  
**Retrieval:** LangChain `UserScopedTransactionRetriever`, top-k (`RAG_TOP_K`, default 8), cosine similarity; rows below `MIN_SIMILARITY` (default 0.3) are dropped. Empty usable set → fixed refusal string, no model call.

**Design choices**

- Code precomputes category totals and passes them into the prompt so the model does not do arithmetic.
- Every cited line uses `[#id]` matching the retrieved row id.
- Explicit ban on inventing merchants, dates, or amounts.
- Free tier: 10 questions/day counted before the answer (refusals count).

**Final prompt shape (abbreviated)**

```
You are Spendsense Copilot. Answer using ONLY the transactions and numeric totals below.
Do not invent merchants, dates, or amounts. Cite with [#id]. Prefer precomputed totals.
Question: …
Precomputed totals: …
Transactions: [#id] date | merchant | category | amount …
```

**Mock path:** `mockAnswerFromRows` builds the same style of sentence from the retrieved set without calling Gemini.

---

## 3. Forecast narrative

**File:** `lib/forecast-narrative.ts` → `prompt`  
**Temperature:** `0.2`  
**Numbers:** from `forecastCashflow` (recurring detection, weekday spend, 1.64σ bands). The model only narrates.

**Design choices**

- JSON payload includes summary + every 7th point so the prompt stays short under Vercel’s ~10s limit.
- Instruction: do not invent figures; do not do arithmetic.

**Final prompt shape (abbreviated)**

```
You are Spendsense's cash-flow narrator.
Write 3-5 concise sentences. Use ONLY these computed numbers.
Mention recurring items, projected end balance, and any negative-balance day already identified.
{ horizonDays, startingBalance, summary, samplePoints }
```

---

## 4. Savings goal narratives

**File:** `lib/goals-narrative.ts` → `explainSavingsGoals`  
**Temperature:** `0.2`  
**MIME:** `application/json`  
**Numbers:** 15% trim of discretionary categories with enough history (`lib/goals.ts`).

**Design choices**

- One short encouragement sentence per goal; amounts come from the JSON only.
- Array response is Zod-validated; failure falls back to a template sentence.

**Final prompt shape (abbreviated)**

```
Write one short encouragement sentence per savings goal.
Use ONLY the provided numbers. Do not invent figures.
Return JSON array [{"category":"...","narrative":"..."}].
[{ category, currentMonthlyAvg, projectedMonthlySaving, suggestedTrimPct }, …]
```

---

## 5. Monthly report narrative

**File:** `lib/report-narrative.ts` → `geminiNarrative`  
**Temperature:** `0.2`  
**Actions:** always exactly three items from `buildActionItems` in code — the model is told not to invent more.

**Design choices**

- Score and metrics are already computed (`lib/report.ts`).
- Prompt length is 4–6 sentences so the UI stays readable.

**Final prompt shape (abbreviated)**

```
Write a 4-6 sentence monthly financial summary.
Use ONLY the numbers in the JSON. Do not invent figures. Do not add action items.
{ metrics, actionItems }
```

---

## Failure handling (shared)

| Case | Behaviour |
| --- | --- |
| Missing `GEMINI_API_KEY` | Deterministic mock templates / keyword rules |
| Empty or unparseable model text | Retry once (categorise) or mock template |
| Copilot retrieval below threshold | Fixed refusal; empty citations |
| Free quota exhausted | HTTP 402 `Upgrade to Pro`; no model call |

## What we deliberately did not put in prompts

- Forecast band math (`z * dailySpendStd * sqrt(t)`)
- Anomaly threshold (`mean + 2σ`)
- Health score weights
- Stripe tier rules

Those stay in code so a model rewrite cannot change money or entitlement logic.
