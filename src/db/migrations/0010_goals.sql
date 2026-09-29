CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount REAL NOT NULL,
  current_amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  target_date TEXT,
  tracking_type TEXT NOT NULL DEFAULT 'manual',
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  asset_id TEXT,
  asset_group_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  icon TEXT,
  color TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_goals_workspace ON goals(workspace_id);