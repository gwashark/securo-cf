import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'
import { serializeRule, type RuleRow } from '../../../lib/server/rules'

export const GET: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId)
    const rows = await db.prepare('SELECT * FROM rules WHERE workspace_id = ? ORDER BY priority, created_at').bind(workspaceId).all<RuleRow>()
    return Response.json(rows.results.map(serializeRule))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load rules' }, { status: 500 })
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
    const body = await request.json().catch(() => null) as { name?: string; conditions_op?: string; conditions?: Array<{ field?: string; op?: string; value?: any; op?: string; conditions?: any[] }>; actions?: Array<{ op: string; value: any }>; priority?: number; is_active?: boolean; apply_to_existing?: boolean; overwrite_existing_categories?: boolean } | null
    if (!body?.name?.trim() || !body?.conditions?.length || !body?.actions?.length) return Response.json({ detail: 'Invalid rule' }, { status: 422 })
    const id = crypto.randomUUID()
    await db.prepare('INSERT INTO rules (id, user_id, workspace_id, name, conditions_op, conditions, actions, priority, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, userId, workspaceId, body.name.trim(), body.conditions_op ?? 'and', JSON.stringify(body.conditions), JSON.stringify(body.actions), body.priority ?? 0, body.is_active ?? true ? 1 : 0).run()
    const row = await db.prepare('SELECT * FROM rules WHERE id = ?').bind(id).first<RuleRow>()
    return row ? Response.json(serializeRule(row), { status: 201 }) : Response.json({ detail: 'Rule not found' }, { status: 500 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to create rule' }, { status: 400 })
  }
}