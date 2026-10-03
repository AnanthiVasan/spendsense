CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  official_name TEXT,
  type TEXT,
  subtype TEXT,
  mask TEXT,
  plaid_account_id TEXT UNIQUE,
  plaid_item_id TEXT,
  plaid_access_token TEXT,
  institution_name TEXT,
  sync_cursor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON accounts (user_id);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts (id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL,
  iso_currency_code TEXT NOT NULL DEFAULT 'INR',
  merchant_name TEXT,
  name TEXT,
  category TEXT,
  subcategory TEXT,
  pending BOOLEAN NOT NULL DEFAULT FALSE,
  occurred_on DATE NOT NULL,
  plaid_transaction_id TEXT UNIQUE,
  raw_description TEXT,
  confidence NUMERIC(4, 3),
  embedding vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_user_occurred_idx
  ON transactions (user_id, occurred_on DESC);

CREATE INDEX IF NOT EXISTS transactions_embedding_hnsw_idx
  ON transactions
  USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(12, 2) NOT NULL,
  current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  target_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goals_user_id_idx ON goals (user_id);

CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_chunks_user_id_idx ON document_chunks (user_id);

CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  z_score NUMERIC(8, 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, transaction_id)
);

CREATE INDEX IF NOT EXISTS alerts_user_id_idx ON alerts (user_id);
