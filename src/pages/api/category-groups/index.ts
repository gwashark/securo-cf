import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'

type GroupRow = { id: string; user_id: string; name: string; icon: string; color: string; position: number; is_system: number; is_hidden: number }
type CategoryRow = { id: string; user_id: string; group_id: string | null; name: string; icon: string; color: string; is_system: number; is_hidden: number; treat_as_transfer: number; is_ignored: number }

function category(row: CategoryRow) {
  return { ...row, is_system: Boolean(row.is_system), is_hidden: Boolean(row.is_hidden), treat_as_transfer: Boolean(row.treat_as_transfer), is_ignored: Boolean(row.is_ignored) }
}

function group(row: GroupRow, categories: CategoryRow[]) {
  return { ...row, is_system: Boolean(row.is_system), is_hidden: Boolean(row.is_hidden), categories: categories.filter((item) => item.group_id === row.id).map(category) }
}

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
    const groups = await db.prepare(`SELECT * FROM category_groups WHERE workspace_id = ? ${hidden ? '' : 'AND is_hidden = 0'} ORDER BY position, name`).bind(workspaceId).all<GroupRow>()
    const categories = await db.prepare(`SELECT * FROM categories WHERE workspace_id = ? ${hidden ? '' : 'AND is_hidden = 0'} ORDER BY name`).bind(workspaceId).all<CategoryRow>()
    return Response.json(groups.results.map((item) => group(item, categories.results)))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load category groups' }, { status: 500 })
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
    const body = await request.json().catch(() => null) as { name?: string; icon?: string; color?: string; position?: number } | null
    if (!body?.name?.trim()) return Response.json({ detail: 'Name is required' }, { status: 422 })
    const id = crypto.randomUUID()
    await db.prepare('INSERT INTO category_groups (id, user_id, workspace_id, name, icon, color, position) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, userId, workspaceId, body.name.trim(), body.icon ?? 'folder', body.color ?? '#6B7280', body.position ?? 0).run()
    return Response.json({ id, user_id: userId, name: body.name.trim(), icon: body.icon ?? 'folder', color: body.color ?? '#6B7280', position: body.position ?? 0, is_system: false, is_hidden: false, categories: [] }, { status: 201 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to create category group' }, { status: 400 })
  }
}