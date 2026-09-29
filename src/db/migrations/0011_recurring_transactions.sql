CREATE TABLE IF NOT EXISTS recurring_transactions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  type TEXT NOT NULL,
  frequency TEXT NOT NULL,
  weekend_adjustment TEXT NOT NULL DEFAULT 'none',
  day_of_month INTEGER,
  start_date TEXT NOT NULL,
  end_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  auto_generate INTEGER NOT NULL DEFAULT 1,
  next_occurrence TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recurring_workspace ON recurring_transactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_recurring_next_occurrence ON recurring_transactions(next_occurrence);