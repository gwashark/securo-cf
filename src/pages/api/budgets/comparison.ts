import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'
import { serializeBudgetVsActual, type BudgetVsActualRow } from '../../../lib/server/budgets'

export const GET: APIRoute = async ({ request, locals, url }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId)
    const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7) + '-01'
    const rows = await db.prepare(`
      SELECT 
        c.id as category_id,
        c.name as category_name,
        c.icon as category_icon,
        c.color as category_color,
        cg.id as group_id,
        cg.name as group_name,
        b.amount as budget_amount,
        COALESCE(SUM(CASE WHEN t.type = 'debit' AND t.is_ignored = 0 THEN t.amount ELSE 0 END), 0) as actual_amount,
        0 as projected_amount,
        0 as prev_month_amount,
        0 as projected_prev_month_amount,
        CASE WHEN b.amount > 0 THEN (COALESCE(SUM(CASE WHEN t.type = 'debit' AND t.is_ignored = 0 THEN t.amount ELSE 0 END), 0) / b.amount) * 100 ELSE NULL END as percentage_used,
        b.is_recurring
      FROM categories c
      LEFT JOIN category_groups cg ON cg.id = c.group_id
      LEFT JOIN budgets b ON b.category_id = c.id AND b.workspace_id = ? AND b.month = ?
      LEFT JOIN transactions t ON t.category_id = c.id AND t.workspace_id = ? AND t.date >= ? AND t.date < date(?, '+1 month')
      WHERE c.workspace_id = ?
      GROUP BY c.id, c.name, c.icon, c.color, cg.id, cg.name, b.amount, b.is_recurring
      ORDER BY cg.position, cg.name, c.name
    `).bind(workspaceId, month, workspaceId, month, month, workspaceId).all<BudgetVsActualRow>()
    return Response.json(rows.results.map(serializeBudgetVsActual))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load budget comparison' }, { status: 500 })
  }
}