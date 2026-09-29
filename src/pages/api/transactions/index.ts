import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { balanceDelta, normalizeSplits, serializeTransaction, type TransactionRow, type TransactionSplitRow } from '../../../lib/server/transactions'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'

async function categoryFor(db: Parameters<typeof requireWorkspaceRole>[0], categoryId: string | null) {
  if (!categoryId) return null
  return db.prepare('SELECT id, user_id, group_id, name, icon, color, is_system, is_hidden, treat_as_transfer, is_ignored FROM categories WHERE id = ?').bind(categoryId).first<Record<string, unknown>>()
}

async function splitsFor(db: Parameters<typeof requireWorkspaceRole>[0], transactionId: string) {
  const rows = await db.prepare('SELECT * FROM transaction_splits WHERE transaction_id = ? ORDER BY created_at').bind(transactionId).all<TransactionSplitRow>()
  return rows.results
}

export const GET: APIRoute = async ({ request, locals, url }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId)
    const conditions = ['workspace_id = ?']
    const values: unknown[] = [workspaceId]
    const add = (sql: string, value: unknown) => { conditions.push(sql); values.push(value) }
    if (url.searchParams.get('account_id')) add('account_id = ?', url.searchParams.get('account_id'))
    if (url.searchParams.get('category_id')) add('category_id = ?', url.searchParams.get('category_id'))
    if (url.searchParams.get('from')) add('date >= ?', url.searchParams.get('from'))
    if (url.searchParams.get('to')) add('date <= ?', url.searchParams.get('to'))
    if (url.searchParams.get('type')) add('type = ?', url.searchParams.get('type'))
    if (url.searchParams.get('status')) add('status = ?', url.searchParams.get('status'))
    if (url.searchParams.get('q')) add('(description LIKE ? OR payee LIKE ?)', `%${url.searchParams.get('q')}%`); if (url.searchParams.get('q')) values.push(`%${url.searchParams.get('q')}%`)
    if (url.searchParams.get('uncategorized') === 'true') conditions.push('category_id IS NULL')
    if (url.searchParams.get('exclude_ignored') === 'true') conditions.push('is_ignored = 0')
    const page = Math.max(Number(url.searchParams.get('page') ?? 1), 1)
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 50), 1), 500)
    const where = conditions.join(' AND ')
    const total = await db.prepare(`SELECT COUNT(*) AS count FROM transactions WHERE ${where}`).bind(...values).first<{ count: number }>()
    const rows = await db.prepare(`SELECT * FROM transactions WHERE ${where} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`).bind(...values, limit, (page - 1) * limit).all<TransactionRow>()
    const items = await Promise.all(rows.results.map(async (row) => serializeTransaction(row, await categoryFor(db, row.category_id))))
    const summary = await db.prepare(`SELECT COALESCE(SUM(CASE WHEN type = 'credit' AND is_ignored = 0 THEN amount ELSE 0 END), 0) AS income, COALESCE(SUM(CASE WHEN type = 'debit' AND is_ignored = 0 THEN amount ELSE 0 END), 0) AS expense FROM transactions WHERE ${where}`).bind(...values).first<{ income: number; expense: number }>()
    return Response.json({ items, total: total?.count ?? 0, page, limit, summary: { income: Number(summary?.income ?? 0), expense: Number(summary?.expense ?? 0), net: Number(summary?.income ?? 0) - Number(summary?.expense ?? 0), excluded: 0, currency: 'USD' } })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load transactions' }, { status: 500 })
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
    const body = await request.json().catch(() => null) as { account_id?: string; category_id?: string | null; description?: string; amount?: number; date?: string; type?: string; currency?: string; status?: string; payee?: string; notes?: string; amount_primary?: number | null; fx_rate_used?: number | null; splits?: { share_type: 'equal' | 'exact' | 'percent'; splits: Array<{ group_member_id: string; share_amount?: number; share_pct?: number; notes?: string }> } } | null
    if (!body?.account_id || !body.description?.trim() || !body.date || !body.amount || !['debit', 'credit'].includes(body.type ?? '')) return Response.json({ detail: 'Invalid transaction' }, { status: 422 })
    const account = await db.prepare('SELECT currency FROM accounts WHERE id = ? AND workspace_id = ?').bind(body.account_id, workspaceId).first<{ currency: string }>()
    if (!account) return Response.json({ detail: 'Account not found' }, { status: 404 })
    const id = crypto.randomUUID()
    const currency = body.currency ?? account.currency
    await db.prepare('INSERT INTO transactions (id, user_id, workspace_id, account_id, category_id, description, amount, currency, date, effective_date, type, source, status, payee, notes, amount_primary, fx_rate_used) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'manual\', ?, ?, ?, ?, ?)').bind(id, userId, workspaceId, body.account_id, body.category_id ?? null, body.description.trim(), body.amount, currency, body.date, body.date, body.type, body.status ?? 'posted', body.payee ?? null, body.notes ?? null, body.amount_primary ?? null, body.fx_rate_used ?? null).run()
    await db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').bind(balanceDelta(body.type, body.amount), body.account_id).run()
    if (body.splits) {
      const normalized = normalizeSplits(body.splits.splits, body.splits.share_type, body.amount)
      for (const split of normalized) await db.prepare('INSERT INTO transaction_splits (id, transaction_id, group_member_id, share_amount, share_type, share_pct, notes) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), id, split.group_member_id, split.share_amount, body.splits.share_type, split.share_pct, split.notes).run()
    }
    const row = await db.prepare('SELECT * FROM transactions WHERE id = ?').bind(id).first<TransactionRow>()
    return row ? Response.json(serializeTransaction(row, await categoryFor(db, row.category_id), await splitsFor(db, id)), { status: 201 }) : Response.json({ detail: 'Transaction not found' }, { status: 500 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to create transaction' }, { status: 400 })
  }
}