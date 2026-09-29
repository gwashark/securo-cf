CREATE TABLE IF NOT EXISTS category_groups (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'folder',
  color TEXT NOT NULL DEFAULT '#6B7280',
  position INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0,
  is_hidden INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES category_groups(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'circle-help',
  color TEXT NOT NULL DEFAULT '#6B7280',
  is_system INTEGER NOT NULL DEFAULT 0,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  treat_as_transfer INTEGER NOT NULL DEFAULT 0,
  is_ignored INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_category_groups_workspace ON category_groups(workspace_id);
CREATE INDEX IF NOT EXISTS idx_categories_workspace ON categories(workspace_id);