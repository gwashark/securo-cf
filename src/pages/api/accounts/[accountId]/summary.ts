import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../../lib/server/workspaces'

export const GET: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.accountId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const account = await db.prepare('SELECT workspace_id, balance FROM accounts WHERE id = ?').bind(params.accountId).first<{ workspace_id: string; balance: number }>()
    if (!account) return Response.json({ detail: 'Account not found' }, { status: 404 })
    await requireWorkspaceRole(db, account.workspace_id, userId)
    const balance = Number(account.balance ?? 0)
    return Response.json({ account_id: params.accountId, current_balance: balance, opening_balance: balance, monthly_income: 0, monthly_expenses: 0, projected_income: 0, projected_expenses: 0 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load account summary' }, { status: 500 })
  }
}