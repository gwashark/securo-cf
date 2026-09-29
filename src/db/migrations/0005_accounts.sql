CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id TEXT,
  external_id TEXT,
  name TEXT NOT NULL,
  display_name TEXT,
  masked_number TEXT,
  type TEXT NOT NULL,
  balance REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  credit_limit REAL,
  statement_close_day INTEGER,
  payment_due_day INTEGER,
  minimum_payment REAL,
  card_brand TEXT,
  card_level TEXT,
  shared_balance_group TEXT,
  is_closed INTEGER NOT NULL DEFAULT 0,
  closed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_accounts_workspace ON accounts(workspace_id);