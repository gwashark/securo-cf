CREATE TABLE IF NOT EXISTS invoice_schedules (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  payee_id TEXT REFERENCES payees(id) ON DELETE SET NULL,
  payee_name TEXT,
  payee_email TEXT,
  payee_address TEXT,
  payee_tax_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL,
  weekend_adjustment TEXT NOT NULL DEFAULT 'none',
  day_of_month INTEGER,
  start_date TEXT NOT NULL,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  next_sequence INTEGER NOT NULL DEFAULT 1,
  currency TEXT NOT NULL DEFAULT 'USD',
  lines TEXT NOT NULL DEFAULT '[]',
  discount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT,
  ended_reason TEXT
);

CREATE TABLE IF NOT EXISTS invoice_schedule_terms (
  id TEXT PRIMARY KEY NOT NULL,
  schedule_id TEXT NOT NULL REFERENCES invoice_schedules(id) ON DELETE CASCADE,
  effective_from TEXT NOT NULL,
  lines TEXT NOT NULL DEFAULT '[]',
  discount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_schedules_workspace ON invoice_schedules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoice_schedule_terms_schedule ON invoice_schedule_terms(schedule_id);