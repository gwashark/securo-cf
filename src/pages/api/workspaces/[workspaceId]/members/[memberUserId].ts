import type { APIRoute } from 'astro'
import { authenticatedUserId, hashPassword } from '../../../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../../../lib/server/workspaces'

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.workspaceId || !params.memberUserId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    await requireWorkspaceRole(db, params.workspaceId, userId, 'owner')
    const body = await request.json().catch(() => null) as { role?: string } | null
    if (!body?.role || !['owner', 'editor', 'viewer'].includes(body.role)) return Response.json({ detail: 'Invalid role' }, { status: 422 })
    await db.prepare('UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?').bind(body.role, params.workspaceId, params.memberUserId).run()
    const member = await db.prepare(
      `SELECT wm.id, wm.user_id, u.email, u.preferences, wm.role, wm.joined_at
       FROM workspace_members wm INNER JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = ? AND wm.user_id = ?`,
    ).bind(params.workspaceId, params.memberUserId).first<{ id: string; user_id: string; email: string; preferences: string; role: string; joined_at: string }>()
    if (!member) return Response.json({ detail: 'Member not found' }, { status: 404 })
    return Response.json({ ...member, preferences: undefined, display_name: JSON.parse(member.preferences || '{}').display_name ?? null })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to change member role' }, { status: 400 })
  }
}

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.workspaceId || !params.memberUserId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const role = await requireWorkspaceRole(db, params.workspaceId, userId)
    if (role !== 'owner' && role !== 'manager' && params.memberUserId !== userId) return new Response('Only the owner can remove other members', { status: 403 })
    await db.prepare('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?').bind(params.workspaceId, params.memberUserId).run()
    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to remove member' }, { status: 400 })
  }
}