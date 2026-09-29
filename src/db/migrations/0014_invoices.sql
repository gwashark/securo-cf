CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'draft',
  number TEXT,
  series TEXT,
  issue_date TEXT NOT NULL,
  due_date TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate REAL,
  payee_id TEXT REFERENCES payees(id) ON DELETE SET NULL,
  payee_name TEXT,
  payee_email TEXT,
  payee_address TEXT,
  payee_tax_id TEXT,
  issuer_name TEXT,
  issuer_address TEXT,
  issuer_tax_id TEXT,
  issuer_tax_jurisdiction TEXT,
  lines TEXT NOT NULL DEFAULT '[]',
  subtotal REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  amount_paid REAL NOT NULL DEFAULT 0,
  amount_deducted REAL NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  origin TEXT NOT NULL DEFAULT 'manual',
  schedule_id TEXT,
  installments TEXT NOT NULL DEFAULT '[]',
  deductions TEXT NOT NULL DEFAULT '[]',
  allocations TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  issued_at TEXT,
  voided_at TEXT,
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS invoice_attachments (
  id TEXT PRIMARY KEY NOT NULL,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  kind TEXT NOT NULL,
  document_number TEXT,
  issued_at TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice_settings (
  workspace_id TEXT PRIMARY KEY NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  default_payment_terms INTEGER NOT NULL DEFAULT 30,
  default_currency TEXT NOT NULL DEFAULT 'USD',
  default_tax_jurisdiction TEXT,
  logo_id TEXT,
  logo_content_type TEXT,
  logo_data TEXT,
  next_number_receivable INTEGER NOT NULL DEFAULT 1,
  next_number_payable INTEGER NOT NULL DEFAULT 1,
  numbering_format TEXT NOT NULL DEFAULT '{year}-{number:04d}',
  default_payment_terms_receivable INTEGER NOT NULL DEFAULT 30,
  default_payment_terms_payable INTEGER NOT NULL DEFAULT 30,
  auto_issue_on_create INTEGER NOT NULL DEFAULT 0,
  require_approval INTEGER NOT NULL DEFAULT 0,
  allow_partial_payment INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice_issuer_tax_ids (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_workspace ON invoices(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoices_state ON invoices(workspace_id, state);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(workspace_id, number);
CREATE INDEX IF NOT EXISTS idx_invoice_attachments_invoice ON invoice_attachments(invoice_id);