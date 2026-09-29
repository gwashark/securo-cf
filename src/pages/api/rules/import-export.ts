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
    const payload = {
      format: 'securo-categorization-rules',
      version: 1,
      rules: rows.results.map((row) => {
        const r = serializeRule(row)
        return {
          name: r.name,
          conditions_op: r.conditions_op,
          conditions: r.conditions,
          actions: r.actions,
          priority: r.priority,
          is_active: r.is_active,
        }
      }),
    }
    return new Response(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="securo-categorization-rules.json"',
      },
    })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to export rules' }, { status: 500 })
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
    const body = await request.json().catch(() => null) as { payload?: any; overwrite?: boolean } | null
    if (!body?.payload?.rules?.length) return Response.json({ detail: 'Invalid import payload' }, { status: 422 })
    
    let imported = 0, skipped = 0, overwritten = 0
    for (const rule of body.payload.rules) {
      const existing = await db.prepare('SELECT id FROM rules WHERE workspace_id = ? AND name = ?').bind(workspaceId, rule.name).first<{ id: string }>()
      if (existing) {
        if (body.overwrite) {
          await db.prepare('DELETE FROM rules WHERE id = ?').bind(existing.id).run()
          overwritten++
        } else {
          skipped++
          continue
        }
      }
      const id = crypto.randomUUID()
      await db.prepare('INSERT INTO rules (id, user_id, workspace_id, name, conditions_op, conditions, actions, priority, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), userId, workspaceId, rule.name, rule.conditions_op ?? 'and', JSON.stringify(rule.conditions), JSON.stringify(rule.actions), rule.priority ?? 0, rule.is_active ?? true ? 1 : 0).run()
      imported++
    }
    return Response.json({ imported, skipped, overwritten })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to import rules' }, { status: 400 })
  }
}