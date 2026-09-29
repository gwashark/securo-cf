import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../../lib/server/auth'
import { balanceDelta } from '../../../../lib/server/transactions'
import { getRuntimeEnv, requireDatabase } from '../../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../../lib/server/workspaces'

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const body = await request.json().catch(() => null) as { account_id?: string; transactions?: Array<{ description: string; amount: number; date: string; type: 'debit' | 'credit'; currency?: string | null; external_id?: string | null; payee_raw?: string | null; notes?: string | null; category_id?: string | null; excluded?: boolean }>; filename?: string; detected_format?: string; detect_duplicates?: boolean } | null
    if (!body?.account_id || !Array.isArray(body.transactions)) return Response.json({ detail: 'Invalid import payload' }, { status: 422 })
    const account = await db.prepare('SELECT workspace_id, currency FROM accounts WHERE id = ?').bind(body.account_id).first<{ workspace_id: string; currency: string }>()
    if (!account) return Response.json({ detail: 'Account not found' }, { status: 404 })
    await requireWorkspaceRole(db, account.workspace_id, userId, 'editor')
    let imported = 0; let skipped = 0; let excluded = 0
    for (const transaction of body.transactions) {
      if (transaction.excluded) { excluded += 1; continue }
      if (!transaction.description || !transaction.amount || !transaction.date) { skipped += 1; continue }
      if (body.detect_duplicates && transaction.external_id) {
        const duplicate = await db.prepare('SELECT id FROM transactions WHERE workspace_id = ? AND external_id = ?').bind(account.workspace_id, transaction.external_id).first<{ id: string }>()
        if (duplicate) { skipped += 1; continue }
      }
      await db.prepare('INSERT INTO transactions (id, user_id, workspace_id, account_id, category_id, external_id, description, amount, currency, date, effective_date, type, source, status, payee, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'import\', \'posted\', ?, ?)').bind(crypto.randomUUID(), userId, account.workspace_id, body.account_id, transaction.category_id ?? null, transaction.external_id ?? null, transaction.description, Math.abs(transaction.amount), transaction.currency ?? account.currency, transaction.date, transaction.date, transaction.type, transaction.payee_raw ?? null, transaction.notes ?? null).run()
      await db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').bind(balanceDelta(transaction.type, Math.abs(transaction.amount)), body.account_id).run()
      imported += 1
    }
    return Response.json({ imported, skipped, excluded, import_log_id: crypto.randomUUID() }, { status: 201 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to import transactions' }, { status: 400 })
  }
}