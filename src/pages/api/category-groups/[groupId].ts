import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../lib/server/workspaces'

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.groupId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const group = await db.prepare('SELECT * FROM category_groups WHERE id = ?').bind(params.groupId).first<{ workspace_id: string; is_system: number }>()
    if (!group) return Response.json({ detail: 'Group not found' }, { status: 404 })
    await requireWorkspaceRole(db, group.workspace_id, userId, 'editor')
    if (group.is_system) return Response.json({ detail: 'System groups cannot be edited' }, { status: 400 })
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const allowed = ['name', 'icon', 'color', 'position', 'is_hidden'].filter((field) => body && field in body)
    if (!allowed.length) return Response.json({ detail: 'No changes supplied' }, { status: 422 })
    const values = allowed.map((field) => typeof body?.[field] === 'boolean' ? (body[field] ? 1 : 0) : body?.[field])
    await db.prepare(`UPDATE category_groups SET ${allowed.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`).bind(...values, params.groupId).run()
    const updated = await db.prepare('SELECT * FROM category_groups WHERE id = ?').bind(params.groupId).first<Record<string, unknown>>()
    return Response.json(updated ? { ...updated, is_system: Boolean(updated.is_system), is_hidden: Boolean(updated.is_hidden), categories: [] } : null)
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to update category group' }, { status: 400 })
  }
}

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.groupId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const group = await db.prepare('SELECT workspace_id, is_system FROM category_groups WHERE id = ?').bind(params.groupId).first<{ workspace_id: string; is_system: number }>()
    if (!group) return Response.json({ detail: 'Group not found' }, { status: 400 })
    await requireWorkspaceRole(db, group.workspace_id, userId, 'editor')
    if (group.is_system) return Response.json({ detail: 'System groups cannot be deleted' }, { status: 409 })
    await db.prepare('DELETE FROM category_groups WHERE id = ?').bind(params.groupId).run()
    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to delete category group' }, { status: 400 })
  }
}