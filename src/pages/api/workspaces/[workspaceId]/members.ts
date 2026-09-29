import type { APIRoute } from 'astro'
import { authenticatedUserId, hashPassword } from '../../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../../lib/server/workspaces'

type MemberRow = { id: string; user_id: string; email: string; preferences: string; role: string; joined_at: string }

function serializeMember(row: MemberRow) {
  const preferences = JSON.parse(row.preferences || '{}') as { display_name?: string }
  return { id: row.id, user_id: row.user_id, email: row.email, display_name: preferences.display_name ?? null, role: row.role, joined_at: row.joined_at }
}

export const GET: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.workspaceId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    await requireWorkspaceRole(db, params.workspaceId, userId)
    const rows = await db.prepare(
      `SELECT wm.id, wm.user_id, u.email, u.preferences, wm.role, wm.joined_at
       FROM workspace_members wm INNER JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = ? ORDER BY wm.joined_at ASC`,
    ).bind(params.workspaceId).all<MemberRow>()
    return Response.json(rows.results.map(serializeMember))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load members' }, { status: 500 })
  }
}

export const POST: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.workspaceId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    await requireWorkspaceRole(db, params.workspaceId, userId, 'owner')
    const body = await request.json().catch(() => null) as { email?: string; role?: string; password?: string } | null
    const email = body?.email?.trim().toLowerCase()
    const role = body?.role ?? 'editor'
    if (!email || !['owner', 'editor', 'viewer'].includes(role)) return Response.json({ detail: 'Invalid member' }, { status: 422 })
    let target = await db.prepare('SELECT id, email, preferences FROM users WHERE email = ? COLLATE NOCASE').bind(email).first<{ id: string; email: string; preferences: string }>()
    if (!target) {
      if (!body?.password || body.password.length < 8) return Response.json({ detail: 'A password is required for new users' }, { status: 400 })
      const targetId = crypto.randomUUID()
      await db.prepare('INSERT INTO users (id, email, password_hash, preferences) VALUES (?, ?, ?, ?)').bind(targetId, email, await hashPassword(body.password), '{}').run()
      target = { id: targetId, email, preferences: '{}' }
      const personalId = crypto.randomUUID()
      await db.prepare("INSERT INTO workspaces (id, name, kind, created_by_user_id) VALUES (?, 'Personal', 'personal', ?)").bind(personalId, targetId).run()
      await db.prepare("INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'owner')").bind(crypto.randomUUID(), personalId, targetId).run()
    }
    const memberId = crypto.randomUUID()
    await db.prepare('INSERT INTO workspace_members (id, workspace_id, user_id, role, invited_by_user_id) VALUES (?, ?, ?, ?, ?)').bind(memberId, params.workspaceId, target.id, role, userId).run()
    return Response.json({ id: memberId, user_id: target.id, email: target.email, display_name: JSON.parse(target.preferences || '{}').display_name ?? null, role, joined_at: new Date().toISOString() }, { status: 201 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to add member' }, { status: 400 })
  }
}