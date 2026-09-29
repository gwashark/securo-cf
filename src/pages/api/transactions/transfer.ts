import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { serializeTransaction, type TransactionRow } from '../../../lib/server/transactions'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'

async function pairResponse(db: Parameters<typeof requireWorkspaceRole>[0], pairId: string) {
  const rows = await db.prepare('SELECT * FROM transactions WHERE transfer_pair_id = ? ORDER BY type').bind(pairId).all<TransactionRow>()
  const debit = rows.results.find((row) => row.type === 'debit')
  const credit = rows.results.find((row) => row.type === 'credit')
  if (!debit || !credit) return null
  return { debit: serializeTransaction(debit), credit: serializeTransaction(credit), transfer_pair_id: pairId }
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
    const body = await request.json().catch(() => null) as { from_account_id?: string; to_account_id?: string; amount?: number; destination_amount?: number; date?: string; description?: string; notes?: string } | null
    if (!body?.from_account_id || !body.to_account_id || body.from_account_id === body.to_account_id || !body.amount || body.amount <= 0 || !body.date || !body.description?.trim()) return Response.json({ detail: 'Invalid transfer' }, { status: 422 })
    const accounts = await db.prepare('SELECT id, currency FROM accounts WHERE workspace_id = ? AND id IN (?, ?)').bind(workspaceId, body.from_account_id, body.to_account_id).all<{ id: string; currency: string }>()
    if (accounts.results.length !== 2) return Response.json({ detail: 'Account not found' }, { status: 404 })
    const source = accounts.results.find((account) => account.id === body.from_account_id)!
    const destination = accounts.results.find((account) => account.id === body.to_account_id)!
    const pairId = crypto.randomUUID()
    const debitId = crypto.randomUUID()
    const creditId = crypto.randomUUID()
    const destinationAmount = body.destination_amount ?? body.amount
    await db.prepare('INSERT INTO transactions (id, user_id, workspace_id, account_id, description, amount, currency, date, effective_date, type, source, status, notes, transfer_pair_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, \'debit\', \'manual\', \'posted\', ?, ?)').bind(debitId, userId, workspaceId, body.from_account_id, body.description.trim(), body.amount, source.currency, body.date, body.date, body.notes ?? null, pairId).run()
    await db.prepare('INSERT INTO transactions (id, user_id, workspace_id, account_id, description, amount, currency, date, effective_date, type, source, status, notes, transfer_pair_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, \'credit\', \'manual\', \'posted\', ?, ?)').bind(creditId, userId, workspaceId, body.to_account_id, body.description.trim(), destinationAmount, destination.currency, body.date, body.date, body.notes ?? null, pairId).run()
    await db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').bind(body.amount, body.from_account_id).run()
    await db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').bind(destinationAmount, body.to_account_id).run()
    return Response.json(await pairResponse(db, pairId), { status: 201 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to create transfer' }, { status: 400 })
  }
}