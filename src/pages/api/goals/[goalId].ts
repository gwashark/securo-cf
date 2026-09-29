import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../lib/server/workspaces'
import { serializeGoal, type GoalRow } from '../../../lib/server/goals'

export const GET: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.goalId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const goal = await db.prepare('SELECT * FROM goals WHERE id = ?').bind(params.goalId).first<GoalRow & { workspace_id: string }>()
    if (!goal) return Response.json({ detail: 'Goal not found' }, { status: 404 })
    await requireWorkspaceRole(db, goal.workspace_id, userId)
    return Response.json(serializeGoal(goal))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load goal' }, { status: 500 })
  }
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.goalId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const goal = await db.prepare('SELECT * FROM goals WHERE id = ?').bind(params.goalId).first<GoalRow & { workspace_id: string }>()
    if (!goal) return Response.json({ detail: 'Goal not found' }, { status: 404 })
    await requireWorkspaceRole(db, goal.workspace_id, userId, 'editor')
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const allowed = ['name', 'target_amount', 'current_amount', 'currency', 'target_date', 'tracking_type', 'account_id', 'asset_id', 'asset_group_id', 'status', 'icon', 'color', 'position', 'metadata_json'].filter((field) => body && field in body)
    if (!allowed.length) return Response.json({ detail: 'No changes supplied' }, { status: 422 })
    const values = allowed.map((field) => {
      const value = body?.[field]
      if (field === 'metadata_json' && value !== null && value !== undefined) return JSON.stringify(value)
      return value ?? null
    })
    await db.prepare(`UPDATE goals SET ${allowed.map((field) => `${field} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...values, params.goalId).run()
    const updated = await db.prepare('SELECT * FROM goals WHERE id = ?').bind(params.goalId).first<GoalRow>()
    return updated ? Response.json(serializeGoal(updated)) : Response.json({ detail: 'Goal not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to update goal' }, { status: 400 })
  }
}

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.goalId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const goal = await db.prepare('SELECT workspace_id FROM goals WHERE id = ?').bind(params.goalId).first<{ workspace_id: string }>()
    if (!goal) return Response.json({ detail: 'Goal not found' }, { status: 404 })
    await requireWorkspaceRole(db, goal.workspace_id, userId, 'editor')
    await db.prepare('DELETE FROM goals WHERE id = ?').bind(params.goalId).run()
    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to delete goal' }, { status: 400 })
  }
}