CREATE TABLE IF NOT EXISTS transaction_splits (
  id TEXT PRIMARY KEY NOT NULL,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  group_member_id TEXT NOT NULL,
  share_amount REAL NOT NULL,
  share_type TEXT NOT NULL CHECK (share_type IN ('equal', 'exact', 'percent')),
  share_pct REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transaction_splits_transaction ON transaction_splits(transaction_id);