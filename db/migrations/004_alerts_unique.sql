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
