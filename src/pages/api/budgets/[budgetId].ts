import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../lib/server/workspaces'
import { serializeBudget, type BudgetRow } from '../../../lib/server/budgets'

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.budgetId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const budget = await db.prepare('SELECT * FROM budgets WHERE id = ?').bind(params.budgetId).first<BudgetRow & { workspace_id: string }>()
    if (!budget) return Response.json({ detail: 'Budget not found' }, { status: 404 })
    await requireWorkspaceRole(db, budget.workspace_id, userId, 'editor')
    const body = await request.json().catch(() => null) as { amount?: number; month?: string } | null
    const allowed = ['amount', 'month'].filter((field) => body && field in body)
    if (!allowed.length) return Response.json({ detail: 'No changes supplied' }, { status: 422 })
    await db.prepare(`UPDATE budgets SET ${allowed.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`).bind(...allowed.map((field) => body?.[field] ?? null), params.budgetId).run()
    const updated = await db.prepare('SELECT * FROM budgets WHERE id = ?').bind(params.budgetId).first<BudgetRow>()
    return updated ? Response.json(serializeBudget(updated)) : Response.json({ detail: 'Budget not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to update budget' }, { status: 400 })
  }
}

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.budgetId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const budget = await db.prepare('SELECT workspace_id FROM budgets WHERE id = ?').bind(params.budgetId).first<{ workspace_id: string }>()
    if (!budget) return Response.json({ detail: 'Budget not found' }, { status: 404 })
    await requireWorkspaceRole(db, budget.workspace_id, userId, 'editor')
    await db.prepare('DELETE FROM budgets WHERE id = ?').bind(params.budgetId).run()
    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to delete budget' }, { status: 400 })
  }
}