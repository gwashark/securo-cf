import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'
import { serializeGoal, type GoalRow } from '../../../lib/server/goals'

export const GET: APIRoute = async ({ request, locals, url }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId)
    const status = url.searchParams.get('status')
    const rows = await db.prepare(`SELECT * FROM goals WHERE workspace_id = ? ${status ? 'AND status = ?' : ''} ORDER BY position, created_at`).bind(workspaceId, ...(status ? [status] : [])).all<GoalRow>()
    return Response.json(rows.results.map(serializeGoal))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load goals' }, { status: 500 })
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
    const body = await request.json().catch(() => null) as { name?: string; target_amount?: number; current_amount?: number; currency?: string; target_date?: string | null; tracking_type?: string; account_id?: string | null; asset_id?: string | null; asset_group_id?: string | null; icon?: string | null; color?: string | null; position?: number; metadata_json?: Record<string, unknown> | null } | null
    if (!body?.name?.trim() || !body?.target_amount || body.target_amount <= 0) return Response.json({ detail: 'Name and target_amount are required' }, { status: 422 })
    const id = crypto.randomUUID()
    await db.prepare('INSERT INTO goals (id, user_id, workspace_id, name, target_amount, current_amount, currency, target_date, tracking_type, account_id, asset_id, asset_group_id, status, icon, color, position, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, userId, workspaceId, body.name.trim(), body.target_amount, body.current_amount ?? 0, body.currency ?? 'USD', body.target_date ?? null, body.tracking_type ?? 'manual', body.account_id ?? null, body.asset_id ?? null, body.asset_group_id ?? null, 'active', body.icon ?? null, body.color ?? null, body.position ?? 0, body.metadata_json ? JSON.stringify(body.metadata_json) : null).run()
    const row = await db.prepare('SELECT * FROM goals WHERE id = ?').bind(id).first<GoalRow>()
    return row ? Response.json(serializeGoal(row), { status: 201 }) : Response.json({ detail: 'Goal not found' }, { status: 500 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to create goal' }, { status: 400 })
  }
}