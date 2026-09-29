import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../../lib/server/auth'
import { serializeTransaction, type TransactionRow } from '../../../../lib/server/transactions'
import { getRuntimeEnv, requireDatabase } from '../../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../../lib/server/workspaces'

export const GET: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.transactionId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const transaction = await db.prepare('SELECT * FROM transactions WHERE id = ?').bind(params.transactionId).first<TransactionRow>()
    if (!transaction) return Response.json({ detail: 'Transaction not found' }, { status: 404 })
    await requireWorkspaceRole(db, transaction.workspace_id, userId)
    if (!transaction.transfer_pair_id) return Response.json(null)
    const pair = await db.prepare('SELECT * FROM transactions WHERE transfer_pair_id = ? AND id != ?').bind(transaction.transfer_pair_id, transaction.id).first<TransactionRow>()
    return Response.json(pair ? serializeTransaction(pair) : null)
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load transfer pair' }, { status: 500 })
  }
}