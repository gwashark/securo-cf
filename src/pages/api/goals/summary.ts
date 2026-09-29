import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'
import { serializeGoalSummary, type GoalSummaryRow } from '../../../lib/server/goals'

export const GET: APIRoute = async ({ request, locals, url }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId)
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 3), 1), 10)
    const rows = await db.prepare('SELECT id, name, target_amount, current_amount, currency, target_date, status, icon, color, position FROM goals WHERE workspace_id = ? AND status = \'active\' ORDER BY position, created_at LIMIT ?').bind(workspaceId, limit).all<{ id: string; name: string; target_amount: number; current_amount: number; currency: string; target_date: string | null; status: string; icon: string | null; color: string | null; position: number }>()
    const summaries = rows.results.map((row) => {
      const targetAmount = Number(row.target_amount)
      const currentAmount = Number(row.current_amount)
      const percentage = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0
      return {
        ...row,
        target_amount: targetAmount,
        current_amount: currentAmount,
        percentage,
        monthly_contribution: null,
        on_track: null,
      }
    })
    return Response.json(summaries.slice(0, limit))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load goal summary' }, { status: 500 })
  }
}