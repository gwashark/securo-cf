import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'
import { serializeBudget, type BudgetRow } from '../../../lib/server/budgets'

export const GET: APIRoute = async ({ request, locals, url }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId)
    const month = url.searchParams.get('month')
    const rows = await db.prepare(`SELECT * FROM budgets WHERE workspace_id = ? ${month ? 'AND month = ?' : ''} ORDER BY month DESC, created_at DESC`).bind(workspaceId, ...(month ? [month] : [])).all<BudgetRow>()
    return Response.json(rows.results.map(serializeBudget))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load budgets' }, { status: 500 })
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
    const body = await request.json().catch(() => null) as { category_id?: string; amount?: number; month?: string; is_recurring?: boolean } | null
    if (!body?.category_id || !body?.amount || !body?.month) return Response.json({ detail: 'category_id, amount, and month are required' }, { status: 422 })
    const id = crypto.randomUUID()
    await db.prepare('INSERT INTO budgets (id, user_id, workspace_id, category_id, amount, month, is_recurring) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, userId, workspaceId, body.category_id, body.amount, body.month, body.is_recurring ? 1 : 0).run()
    const row = await db.prepare('SELECT * FROM budgets WHERE id = ?').bind(id).first<BudgetRow>()
    return row ? Response.json({ ...row, amount: Number(row.amount), is_recurring: Boolean(row.is_recurring) }, { status: 201 }) : Response.json({ detail: 'Budget not found' }, { status: 500 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to create budget' }, { status: 400 })
  }
}