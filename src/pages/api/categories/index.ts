import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'

type CategoryRow = { id: string; user_id: string; group_id: string | null; name: string; icon: string; color: string; is_system: number; is_hidden: number; treat_as_transfer: number; is_ignored: number }
function serialize(row: CategoryRow) { return { ...row, is_system: Boolean(row.is_system), is_hidden: Boolean(row.is_hidden), treat_as_transfer: Boolean(row.treat_as_transfer), is_ignored: Boolean(row.is_ignored) } }

export const GET: APIRoute = async ({ request, locals, url }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId)
    const hidden = url.searchParams.get('include_hidden') === 'true'
    const rows = await db.prepare(`SELECT * FROM categories WHERE workspace_id = ? ${hidden ? '' : 'AND is_hidden = 0'} ORDER BY name`).bind(workspaceId).all<CategoryRow>()
    return Response.json(rows.results.map(serialize))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load categories' }, { status: 500 })
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId, 'editor')
    const body = await request.json().catch(() => null) as { name?: string; icon?: string; color?: string; group_id?: string | null; treat_as_transfer?: boolean; is_ignored?: boolean } | null
    if (!body?.name?.trim()) return Response.json({ detail: 'Name is required' }, { status: 422 })
    const id = crypto.randomUUID()
    await db.prepare('INSERT INTO categories (id, user_id, workspace_id, group_id, name, icon, color, treat_as_transfer, is_ignored) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, userId, workspaceId, body.group_id ?? null, body.name.trim(), body.icon ?? 'circle-help', body.color ?? '#6B7280', body.treat_as_transfer ? 1 : 0, body.is_ignored ? 1 : 0).run()
    return Response.json(serialize({ id, user_id: userId, group_id: body.group_id ?? null, name: body.name.trim(), icon: body.icon ?? 'circle-help', color: body.color ?? '#6B7280', is_system: 0, is_hidden: 0, treat_as_transfer: body.treat_as_transfer ? 1 : 0, is_ignored: body.is_ignored ? 1 : 0 }), { status: 201 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to create category' }, { status: 400 })
  }
}