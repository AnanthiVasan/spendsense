# Categorization accuracy

Ground truth is the **deterministic seed labels** attached to the mock generator in `lib/plaid-mock.ts` (merchant + amount mapping). That is preferred over treating the keyword baseline as truth.

The keyword rule set in `lib/categories.ts` is the **baseline**, not ground truth. Rent is labeled `other` in seed labels because housing is not in the category enum.

## Run settings

- Rows evaluated: 103
- Predictor: In-memory keyword MOCK categorizer (GEMINI_API_KEY unset).
- GEMINI_API_KEY present: no
- Compared persisted DB categories: no

## Scores

| Comparison | Accuracy |
| --- | --- |
| Predictor vs seed labels (ground truth) | 100.0% |
| Predictor vs keyword baseline | 100.0% |
| Keyword baseline vs seed labels | 100.0% |

When `GEMINI_API_KEY` is unset, the predictor **is** the keyword mock, so predictor vs baseline is 100%. That does not mean the labels are perfect against seed ground truth.

## Confusion matrix: predictor vs seed labels

actual \ pred | food | travel | utilities | EMI | groceries | entertainment | income | health | shopping | other
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
food | 11 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0
travel | 0 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0
utilities | 0 | 0 | 11 | 0 | 0 | 0 | 0 | 0 | 0 | 0
EMI | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0
groceries | 0 | 0 | 0 | 0 | 13 | 0 | 0 | 0 | 0 | 0
entertainment | 0 | 0 | 0 | 0 | 0 | 15 | 0 | 0 | 0 | 0
income | 0 | 0 | 0 | 0 | 0 | 0 | 7 | 0 | 0 | 0
health | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 0
shopping | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 17 | 0
other | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3

## Confusion matrix: predictor vs keyword baseline

actual \ pred | food | travel | utilities | EMI | groceries | entertainment | income | health | shopping | other
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
food | 11 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0
travel | 0 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0
utilities | 0 | 0 | 11 | 0 | 0 | 0 | 0 | 0 | 0 | 0
EMI | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0
groceries | 0 | 0 | 0 | 0 | 13 | 0 | 0 | 0 | 0 | 0
entertainment | 0 | 0 | 0 | 0 | 0 | 15 | 0 | 0 | 0 | 0
income | 0 | 0 | 0 | 0 | 0 | 0 | 7 | 0 | 0 | 0
health | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 0
shopping | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 17 | 0
other | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3

## Notes

- Recurring rent / EMI / payroll are generated on a fixed calendar so later forecast work stays reproducible.
- Low-confidence UI highlighting uses `confidence < 0.6`; rent's baseline confidence is 0.58 on purpose so that path is visible in MOCK mode.
