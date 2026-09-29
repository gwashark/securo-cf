import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../lib/server/workspaces'
import { serializeRule, type RuleRow } from '../../../lib/server/rules'

export const GET: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.ruleId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const rule = await db.prepare('SELECT * FROM rules WHERE id = ?').bind(params.ruleId).first<RuleRow & { workspace_id: string }>()
    if (!rule) return Response.json({ detail: 'Rule not found' }, { status: 404 })
    await requireWorkspaceRole(db, rule.workspace_id, userId)
    return Response.json(serializeRule(rule))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load rule' }, { status: 500 })
  }
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.ruleId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const rule = await db.prepare('SELECT * FROM rules WHERE id = ?').bind(params.ruleId).first<RuleRow & { workspace_id: string }>()
    if (!rule) return Response.json({ detail: 'Rule not found' }, { status: 404 })
    await requireWorkspaceRole(db, rule.workspace_id, userId, 'editor')
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const allowed = ['name', 'conditions_op', 'conditions', 'actions', 'priority', 'is_active'].filter((field) => body && field in body)
    if (!allowed.length) return Response.json({ detail: 'No changes supplied' }, { status: 422 })
    const values = allowed.map((field) => {
      const value = body?.[field]
      if (field === 'conditions' || field === 'actions') return JSON.stringify(value)
      if (field === 'is_active') return value === true ? 1 : 0
      return value ?? null
    })
    await db.prepare(`UPDATE rules SET ${allowed.map((field) => `${field} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...values, params.ruleId).run()
    const updated = await db.prepare('SELECT * FROM rules WHERE id = ?').bind(params.ruleId).first<RuleRow>()
    return updated ? Response.json(serializeRule(updated)) : Response.json({ detail: 'Rule not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to update rule' }, { status: 400 })
  }
}

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.ruleId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const rule = await db.prepare('SELECT workspace_id FROM rules WHERE id = ?').bind(params.ruleId).first<{ workspace_id: string }>()
    if (!rule) return Response.json({ detail: 'Rule not found' }, { status: 404 })
    await requireWorkspaceRole(db, rule.workspace_id, userId, 'editor')
    await db.prepare('DELETE FROM rules WHERE id = ?').bind(params.ruleId).run()
    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to delete rule' }, { status: 400 })
  }
}