import type { D1Database } from './runtime'

export const DEFAULT_MODULES = [
  'transactions', 'accounts', 'import', 'reports', 'assets', 'budgets',
  'goals', 'recurring', 'categories', 'payees', 'split_groups', 'rules',
]

export type WorkspaceRow = {
  id: string
  name: string
  kind: string
  is_archived: number
  default_currency: string
  locale: string | null
  timezone: string | null
  tax_jurisdiction: string | null
  icon: string | null
  color: string | null
  created_at: string
  created_by_user_id: string | null
  managed_by_user_id: string | null
  role: string
}

export function serializeWorkspace(row: WorkspaceRow) {
  return {
    ...row,
    is_archived: Boolean(row.is_archived),
    enabled_modules: row.kind === 'business' ? [...DEFAULT_MODULES, 'invoices'] : DEFAULT_MODULES,
  }
}

export async function getWorkspaceRole(db: D1Database, workspaceId: string, userId: string): Promise<string | null> {
  const membership = await db.prepare(
    'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
  ).bind(workspaceId, userId).first<{ role: string }>()
  if (membership) return membership.role
  const manager = await db.prepare(
    'SELECT id FROM workspaces WHERE id = ? AND managed_by_user_id = ? AND is_archived = 0',
  ).bind(workspaceId, userId).first<{ id: string }>()
  return manager ? 'manager' : null
}

export async function requireWorkspaceRole(
  db: D1Database,
  workspaceId: string,
  userId: string,
  minimum: 'viewer' | 'editor' | 'owner' = 'viewer',
): Promise<string> {
  const role = await getWorkspaceRole(db, workspaceId, userId)
  if (!role) throw new Response('Workspace not found', { status: 404 })
  const ranks = { viewer: 1, editor: 2, owner: 3, manager: 3 }
  if (ranks[role as keyof typeof ranks] < ranks[minimum]) throw new Response('Insufficient role', { status: 403 })
  return role
}

export async function resolveWorkspaceId(db: D1Database, userId: string, requestedId: string | null): Promise<string | null> {
  const row = await db.prepare(
    `SELECT w.id FROM workspaces w
     LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ?
     WHERE w.is_archived = 0 AND (wm.user_id IS NOT NULL OR w.managed_by_user_id = ?)
       AND (? IS NULL OR w.id = ?)
     ORDER BY w.created_at ASC LIMIT 1`,
  ).bind(userId, userId, requestedId, requestedId).first<{ id: string }>()
  return row?.id ?? null
}