# Schema

Postgres with the `vector` and `pgcrypto` extensions. Embeddings are `vector(768)`.

## users

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| email | text unique | login |
| password_hash | text | bcrypt |
| name | text | |
| created_at, updated_at | timestamptz | |

## accounts

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk users | scoped reads |
| name, official_name, type, subtype, mask | text | |
| plaid_account_id | text unique | |
| plaid_item_id, plaid_access_token | text | token stays server-side |
| institution_name, sync_cursor | text | |
| created_at | timestamptz | |

## transactions

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | citation id in copilot |
| user_id | uuid fk | |
| account_id | uuid fk accounts | |
| amount | numeric(12,2) | positive spend, negative inflow |
| iso_currency_code | text | default INR |
| merchant_name, name, raw_description | text | |
| category, subcategory | text | |
| confidence | numeric(4,3) | |
| pending | boolean | |
| occurred_on | date | |
| plaid_transaction_id | text unique | sync + seed dedupe |
| embedding | vector(768) | HNSW `vector_cosine_ops` |
| created_at | timestamptz | |

Cosine search:

```sql
SELECT id
FROM transactions
WHERE user_id = $1 AND embedding IS NOT NULL
ORDER BY embedding <=> $2::vector
LIMIT $3
```

Similarity returned to the app is `1 - (embedding <=> query)`.

## alerts

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk | unique with transaction_id |
| transaction_id | uuid fk | |
| reason | text | includes z-score |
| z_score | numeric(8,3) | |
| created_at | timestamptz | |

## savings_goals

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk | unique with category |
| category | text | food, entertainment, shopping, or overall |
| current_monthly_avg, projected_monthly_saving, projected_annual_saving | numeric | |
| suggested_trim_pct | numeric | |
| rationale, narrative | text | narrative may be null |
| status | text | suggested, accepted, dismissed |
| created_at | timestamptz | |

The older `goals` table (name, target_amount, current_amount, target_date) is unused by the recommendation engine.

## reports

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk | unique with month |
| month | text | YYYY-MM |
| narrative | text | |
| action_items | jsonb | length 3 |
| score | numeric(5,2) | 0-100 |
| metrics | jsonb | income, spend, categories, anomalies |
| created_at | timestamptz | |

## subscriptions

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid unique fk | |
| stripe_customer_id, stripe_subscription_id | text | |
| tier | text | free or pro |
| status | text | active, trialing, past_due, canceled |
| current_period_end | timestamptz | |
| created_at, updated_at | timestamptz | |

## usage

| Column | Type | Notes |
|---|---|---|
| user_id | uuid fk | pk with day |
| day | date | UTC |
| copilot_count | integer | |

## document_chunks

Reserved for longer documents. Same `vector(768)` column and HNSW cosine index as transactions. Copilot retrieval currently reads `transactions` only.
