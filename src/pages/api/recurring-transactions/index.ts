import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'
import { serializeRecurringTransaction, type RecurringTransactionRow } from '../../../lib/server/recurring'

export const GET: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId)
    const rows = await db.prepare('SELECT * FROM recurring_transactions WHERE workspace_id = ? ORDER BY created_at DESC').bind(workspaceId).all<RecurringTransactionRow>()
    return Response.json(rows.results.map(serializeRecurringTransaction))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load recurring transactions' }, { status: 500 })
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
    const body = await request.json().catch(() => null) as { account_id?: string; category_id?: string | null; description?: string; amount?: number; currency?: string; type?: string; frequency?: string; weekend_adjustment?: string; day_of_month?: number | null; start_date?: string; end_date?: string | null; is_active?: boolean; auto_generate?: boolean } | null
    if (!body?.account_id || !body?.description?.trim() || !body?.amount || body.amount <= 0 || !body?.frequency || !body?.start_date || !['debit', 'credit'].includes(body.type ?? '')) return Response.json({ detail: 'Invalid recurring transaction' }, { status: 422 })
    const id = crypto.randomUUID()
    const nextOccurrence = body.start_date
    await db.prepare('INSERT INTO recurring_transactions (id, user_id, workspace_id, account_id, category_id, description, amount, currency, type, frequency, weekend_adjustment, day_of_month, start_date, end_date, is_active, auto_generate, next_occurrence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, userId, workspaceId, body.account_id, body.category_id ?? null, body.description.trim(), body.amount, body.currency ?? 'USD', body.type, body.frequency, body.weekend_adjustment ?? 'none', body.day_of_month ?? null, body.start_date, body.end_date ?? null, body.is_active ?? true ? 1 : 0, body.auto_generate ?? true ? 1 : 0, nextOccurrence).run()
    const row = await db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').bind(id).first<RecurringTransactionRow>()
    return row ? Response.json(serializeRecurringTransaction(row), { status: 201 }) : Response.json({ detail: 'Recurring transaction not found' }, { status: 500 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to create recurring transaction' }, { status: 400 })
  }
}