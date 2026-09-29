import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { balanceDelta, normalizeSplits, serializeTransaction, type TransactionRow, type TransactionSplitRow } from '../../../lib/server/transactions'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../lib/server/workspaces'

async function loadTransaction(db: Parameters<typeof requireWorkspaceRole>[0], id: string) {
  return db.prepare('SELECT * FROM transactions WHERE id = ?').bind(id).first<TransactionRow>()
}

async function categoryFor(db: Parameters<typeof requireWorkspaceRole>[0], categoryId: string | null) {
  if (!categoryId) return null
  return db.prepare('SELECT id, user_id, group_id, name, icon, color, is_system, is_hidden, treat_as_transfer, is_ignored FROM categories WHERE id = ?').bind(categoryId).first<Record<string, unknown>>()
}

async function splitsFor(db: Parameters<typeof requireWorkspaceRole>[0], transactionId: string) {
  const rows = await db.prepare('SELECT * FROM transaction_splits WHERE transaction_id = ? ORDER BY created_at').bind(transactionId).all<TransactionSplitRow>()
  return rows.results
}

export const GET: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.transactionId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const transaction = await loadTransaction(db, params.transactionId)
    if (!transaction) return Response.json({ detail: 'Transaction not found' }, { status: 404 })
    await requireWorkspaceRole(db, transaction.workspace_id, userId)
    return Response.json(serializeTransaction(transaction, await categoryFor(db, transaction.category_id), await splitsFor(db, transaction.id)))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load transaction' }, { status: 500 })
  }
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.transactionId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const transaction = await loadTransaction(db, params.transactionId)
    if (!transaction) return Response.json({ detail: 'Transaction not found' }, { status: 404 })
    await requireWorkspaceRole(db, transaction.workspace_id, userId, 'editor')
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const allowed = ['account_id', 'category_id', 'description', 'amount', 'currency', 'date', 'effective_date', 'type', 'status', 'payee', 'payee_id', 'notes', 'amount_primary', 'fx_rate_used'].filter((field) => body && field in body)
    if (!allowed.length && !(body && 'splits' in body)) return Response.json({ detail: 'No changes supplied' }, { status: 422 })
    const newAccountId = typeof body?.account_id === 'string' ? body.account_id : transaction.account_id
    const account = await db.prepare('SELECT id, currency FROM accounts WHERE id = ? AND workspace_id = ?').bind(newAccountId, transaction.workspace_id).first<{ id: string; currency: string }>()
    if (!account) return Response.json({ detail: 'Account not found' }, { status: 404 })
    const newType = typeof body?.type === 'string' ? body.type : transaction.type
    const newAmount = typeof body?.amount === 'number' ? body.amount : transaction.amount
    if (!['debit', 'credit'].includes(newType) || newAmount <= 0) return Response.json({ detail: 'Invalid transaction amount or type' }, { status: 422 })
    const values = allowed.map((field) => body?.[field] ?? null)
    if (allowed.length) await db.prepare(`UPDATE transactions SET ${allowed.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`).bind(...values, params.transactionId).run()
    await db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').bind(balanceDelta(transaction.type, transaction.amount), transaction.account_id).run()
    await db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').bind(balanceDelta(newType, newAmount), newAccountId).run()
    if (body?.splits) {
      const splitPayload = body.splits as { share_type?: 'equal' | 'exact' | 'percent'; splits?: Array<{ group_member_id: string; share_amount?: number; share_pct?: number; notes?: string }> }
      if (!splitPayload.share_type || !splitPayload.splits) return Response.json({ detail: 'Invalid splits payload' }, { status: 422 })
      const normalized = normalizeSplits(splitPayload.splits, splitPayload.share_type, newAmount)
      await db.prepare('DELETE FROM transaction_splits WHERE transaction_id = ?').bind(params.transactionId).run()
      for (const split of normalized) await db.prepare('INSERT INTO transaction_splits (id, transaction_id, group_member_id, share_amount, share_type, share_pct, notes) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), params.transactionId, split.group_member_id, split.share_amount, splitPayload.share_type, split.share_pct, split.notes).run()
    }
    const updated = await loadTransaction(db, params.transactionId)
    return updated ? Response.json(serializeTransaction(updated, await categoryFor(db, updated.category_id), await splitsFor(db, updated.id))) : Response.json({ detail: 'Transaction not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to update transaction' }, { status: 400 })
  }
}

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.transactionId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const transaction = await loadTransaction(db, params.transactionId)
    if (!transaction) return Response.json({ detail: 'Transaction not found' }, { status: 404 })
    await requireWorkspaceRole(db, transaction.workspace_id, userId, 'editor')
    await db.prepare('DELETE FROM transactions WHERE id = ?').bind(params.transactionId).run()
    await db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').bind(balanceDelta(transaction.type, transaction.amount), transaction.account_id).run()
    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to delete transaction' }, { status: 400 })
  }
}