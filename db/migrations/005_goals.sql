CREATE TABLE IF NOT EXISTS savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  current_monthly_avg NUMERIC(12, 2) NOT NULL,
  suggested_trim_pct NUMERIC(5, 4) NOT NULL,
  projected_monthly_saving NUMERIC(12, 2) NOT NULL,
  projected_annual_saving NUMERIC(12, 2) NOT NULL,
  rationale TEXT NOT NULL,
  narrative TEXT,
  status TEXT NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested', 'accepted', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);

CREATE INDEX IF NOT EXISTS savings_goals_user_id_idx ON savings_goals (user_id);
