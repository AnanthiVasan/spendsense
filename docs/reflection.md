# Written reflection

**Project:** SpendSense — Personal Finance Copilot with Predictive Cash Flow  
**Programme:** Impacteers Track 1 — AI for Developers  
**Length:** ~520 words

## The problem

Most banking apps show a list of charges and a few charts. They rarely answer a simple question such as “what did I spend on food?” with evidence, or warn that one purchase is unusual for that category, or show the next thirty days with honest uncertainty. People are left to do that thinking in a spreadsheet. SpendSense targets that gap: take roughly ninety days of transactions, explain them in plain language, and look a month ahead without inventing numbers.

## The innovation

The load-bearing idea is **retrieval before prose**. Each transaction is embedded into pgvector. When someone asks a question, the app retrieves the closest rows for that user only, filters by a similarity floor, and then asks the model to narrate using those rows and precomputed totals. If nothing is close enough, the product refuses instead of answering from general knowledge. That is why “What is the capital of France?” fails on purpose, and why citations map back to ledger ids.

The second AI capability is **structured classification and narration around code-owned math**. Categorisation returns a category and a confidence score. Forecast balances, anomaly z-scores, savings trims, and the health score are calculated in TypeScript; the model only writes sentences. Remove the AI layer and you lose grounded answers, labels, and narratives—the product stops being a copilot—but you never lose the ability to trust that ₹2,480 was flagged by statistics, not by a model that guessed.

## What I would change

First, I would wire a real embedding model for every demo environment. The mock hashed vectors need careful query cleanup so “food last month” retrieves Chipotle; a production embedding model would make natural questions more robust without that alias work.

Second, I would store a live account balance from Plaid instead of an assumed starting balance for the forecast. The bands would then mean more to a user who already knows their current cash.

Third, I would add a short “why this answer” panel that shows the retrieval scores for each citation. Graders and users both benefit from seeing that the refusal path is a threshold, not a bug.

Fourth, I would keep a cleaner multi-commit history from day one. This repository was pushed as a working whole after iterative local builds; a public commit trail that mirrors each feature step would read better in review.

Finally, with mentor approval already implicit in the stack choices, I would document the Gemini and Neon substitutions earlier in the README so reviewers do not hunt for GPT-4 and Supabase names from the brief.

## Closing

SpendSense is worth showing in an interview because the AI is constrained: it cites, it refuses, and it does not own the money math. That discipline is the difference between a finance toy and a finance tool.
