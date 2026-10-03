# RAG pipeline

Spendsense retrieval is **one transaction = one chunk = one pgvector row**. There is no multi-sentence document splitting. That matches the data: each spend event is already a discrete fact with a date, merchant, category, amount, and raw description.

## Chunk text

Indexing and (model-side) querying share `buildTransactionText`:

```
${date} | ${merchant_name} | ${category} | amount ${amount} | ${raw_description}
```

Example: `2026-09-15 | Chipotle | food | amount 14.20 | CHIPOTLE`

Row-level chunks keep retrieval user-isolatable (`WHERE user_id = $1`) and make later copilot citations map 1:1 to a ledger line. Aggregating several transactions into one embedding would blur amounts and dates.

Natural-language questions are embedded with the same `embedText` function (same model, 768-d, L2-normalized). In MOCK mode, query tokens get light aliases (`dining` → `food`, `emi` → `sofi loan`) so hashed token vectors still overlap category/merchant tokens.

## Embedding model

- Production: Gemini `text-embedding-004` (768 dimensions, free-tier friendly).
- Fallback: deterministic hashed token vectors, also 768-d and L2-normalized, so the `vector(768)` column and HNSW index never change shape.
- Switch: set `GEMINI_API_KEY`. Empty key keeps MOCK embeddings.

Embeddings are **precomputed in `npm run seed`** via `embedTransactionsForUser`. The HTTP handler only embeds the query.

## Retrieval-k and operator

- `RAG_TOP_K` (default 8) is enough for a later copilot prompt without stuffing the context window.
- Distance: pgvector cosine operator `<=>` (`vector_cosine_ops`).
- Score returned to clients: `1 - (embedding <=> query)` so higher is closer.
- Index: HNSW on `transactions.embedding` (see `db/migrations/001_init.sql` and `003_vector_index.sql`). HNSW is preferred over IVFFlat here because seed volume is hundreds of rows and IVFFlat wants a trained `lists` count.

LangChain.js is used as a thin `BaseRetriever` (`UserScopedTransactionRetriever`). The SQL is authored by us and **always** includes `user_id`.

## Measured latency

- GEMINI_API_KEY present: no (MOCK embeddings)
- Demo user seeded: no
- Runs per query: 5
- Average embed latency: 0.14 ms
- Average vector-search latency (includes query embed + SQL): n/a

### "dining spend last month"

- Average embed latency: 0.22 ms
- Average vector-search latency: n/a (no DATABASE_URL / demo user)

_No rows returned. Run `npm run seed` first._

### "all EMI payments"

- Average embed latency: 0.11 ms
- Average vector-search latency: n/a (no DATABASE_URL / demo user)

_No rows returned. Run `npm run seed` first._

### "biggest travel expense"

- Average embed latency: 0.10 ms
- Average vector-search latency: n/a (no DATABASE_URL / demo user)

_No rows returned. Run `npm run seed` first._

