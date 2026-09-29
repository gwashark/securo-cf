CREATE TABLE IF NOT EXISTS report_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  period TEXT NOT NULL,
  interval TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_report_snapshots_workspace ON report_snapshots(workspace_id);