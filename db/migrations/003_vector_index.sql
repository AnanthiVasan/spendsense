-- Idempotent cosine index for transaction RAG.
-- HNSW is the right default here: seed volume is hundreds of rows, not millions,
-- and IVFFlat needs a trained list count that is awkward on small/empty tables.
CREATE INDEX IF NOT EXISTS transactions_embedding_hnsw_idx
  ON transactions
  USING hnsw (embedding vector_cosine_ops);
