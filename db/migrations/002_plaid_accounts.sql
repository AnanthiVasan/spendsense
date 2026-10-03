ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS institution_name TEXT,
  ADD COLUMN IF NOT EXISTS plaid_access_token TEXT,
  ADD COLUMN IF NOT EXISTS sync_cursor TEXT;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS raw_description TEXT,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(4, 3);

CREATE UNIQUE INDEX IF NOT EXISTS accounts_user_plaid_account_idx
  ON accounts (user_id, plaid_account_id)
  WHERE plaid_account_id IS NOT NULL;
