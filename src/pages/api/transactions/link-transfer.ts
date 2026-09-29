import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId, 'editor')
    const body = await request.json().catch(() => null) as { transaction_ids?: string[] } | null
    if (!body?.transaction_ids || body.transaction_ids.length !== 2 || body.transaction_ids[0] === body.transaction_ids[1]) return Response.json({ detail: 'Exactly two different transactions are required' }, { status: 422 })
    const rows = await db.prepare('SELECT * FROM transactions WHERE workspace_id = ? AND id IN (?, ?)').bind(workspaceId, body.transaction_ids[0], body.transaction_ids[1]).all<{ id: string; account_id: string; type: string; transfer_pair_id: string | null }>()
    if (rows.results.length !== 2 || rows.results.some((row) => row.transfer_pair_id) || new Set(rows.results.map((row) => row.account_id)).size !== 2) return Response.json({ detail: 'Transactions cannot be linked' }, { status: 400 })
    const debit = rows.results.find((row) => row.type === 'debit')
    const credit = rows.results.find((row) => row.type === 'credit')
    if (!debit || !credit) return Response.json({ detail: 'One debit and one credit are required' }, { status: 400 })
    const pairId = crypto.randomUUID()
    await db.prepare('UPDATE transactions SET transfer_pair_id = ? WHERE id IN (?, ?)').bind(pairId, debit.id, credit.id).run()
    const linked = await db.prepare('SELECT * FROM transactions WHERE transfer_pair_id = ? ORDER BY type').bind(pairId).all<Record<string, unknown>>()
    return Response.json({ debit: linked.results.find((row) => row.type === 'debit'), credit: linked.results.find((row) => row.type === 'credit'), transfer_pair_id: pairId })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to link transfer' }, { status: 400 })
  }
}