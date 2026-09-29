import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, serializeWorkspace, type WorkspaceRow } from '../../../lib/server/workspaces'

const EDITABLE_FIELDS = ['name', 'icon', 'color', 'default_currency', 'locale', 'tax_jurisdiction', 'timezone'] as const

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.workspaceId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const role = await requireWorkspaceRole(db, params.workspaceId, userId, 'owner')
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const updates = EDITABLE_FIELDS.filter((field) => body && field in body)
    if (!updates.length) return Response.json({ detail: 'No changes supplied' }, { status: 422 })
    if (body?.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
      return Response.json({ detail: 'Invalid workspace name' }, { status: 422 })
    }
    const assignments = updates.map((field) => `${field} = ?`).join(', ')
    const values = updates.map((field) => field === 'name' ? String(body?.[field]).trim() : body?.[field] ?? null)
    await db.prepare(`UPDATE workspaces SET ${assignments} WHERE id = ?`).bind(...values, params.workspaceId).run()
    const row = await db.prepare(
      'SELECT w.*, ? AS role FROM workspaces w WHERE w.id = ?',
    ).bind(role, params.workspaceId).first<WorkspaceRow>()
    return row ? Response.json(serializeWorkspace(row)) : Response.json({ detail: 'Workspace not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to update workspace' }, { status: 400 })
  }
}

export const POST: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.workspaceId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    await requireWorkspaceRole(db, params.workspaceId, userId, 'owner')
    const workspaceCount = await db.prepare(
      `SELECT COUNT(*) AS count FROM workspace_members wm
       INNER JOIN workspaces w ON w.id = wm.workspace_id
       WHERE wm.user_id = ? AND w.is_archived = 0`,
    ).bind(userId).first<{ count: number }>()
    if ((workspaceCount?.count ?? 0) <= 1) return Response.json({ detail: 'Cannot archive your last workspace' }, { status: 400 })
    await db.prepare('UPDATE workspaces SET is_archived = 1 WHERE id = ?').bind(params.workspaceId).run()
    const row = await db.prepare(
      'SELECT w.*, ? AS role FROM workspaces w WHERE w.id = ?',
    ).bind('owner', params.workspaceId).first<WorkspaceRow>()
    return row ? Response.json(serializeWorkspace(row)) : Response.json({ detail: 'Workspace not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to archive workspace' }, { status: 400 })
  }
}