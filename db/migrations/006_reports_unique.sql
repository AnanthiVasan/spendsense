CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  narrative TEXT NOT NULL,
  action_items JSONB NOT NULL,
  score NUMERIC(5, 2) NOT NULL,
  metrics JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

CREATE INDEX IF NOT EXISTS reports_user_month_idx ON reports (user_id, month);
