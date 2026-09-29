CREATE TABLE IF NOT EXISTS payees (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  is_favorite INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  website TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payee_tax_ids (
  id TEXT PRIMARY KEY NOT NULL,
  payee_id TEXT NOT NULL REFERENCES payees(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payees_workspace ON payees(workspace_id);
CREATE INDEX IF NOT EXISTS idx_payee_tax_ids_payee ON payee_tax_ids(payee_id);