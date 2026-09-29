import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../lib/server/workspaces'
import { serializeRecurringTransaction, type RecurringTransactionRow } from '../../../lib/server/recurring'

export const GET: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.recurringId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const recurring = await db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').bind(params.recurringId).first<RecurringTransactionRow & { workspace_id: string }>()
    if (!recurring) return Response.json({ detail: 'Recurring transaction not found' }, { status: 404 })
    await requireWorkspaceRole(db, recurring.workspace_id, userId)
    return Response.json(serializeRecurringTransaction(recurring))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load recurring transaction' }, { status: 500 })
  }
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.recurringId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const recurring = await db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').bind(params.recurringId).first<RecurringTransactionRow & { workspace_id: string }>()
    if (!recurring) return Response.json({ detail: 'Recurring transaction not found' }, { status: 404 })
    await requireWorkspaceRole(db, recurring.workspace_id, userId, 'editor')
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const allowed = ['description', 'amount', 'currency', 'type', 'frequency', 'weekend_adjustment', 'day_of_month', 'start_date', 'end_date', 'is_active', 'auto_generate'].filter((field) => body && field in body)
    if (!allowed.length) return Response.json({ detail: 'No changes supplied' }, { status: 422 })
    const values = allowed.map((field) => body?.[field] ?? null)
    await db.prepare(`UPDATE recurring_transactions SET ${allowed.map((field) => `${field} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...values, params.recurringId).run()
    const updated = await db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').bind(params.recurringId).first<RecurringTransactionRow>()
    return updated ? Response.json(serializeRecurringTransaction(updated)) : Response.json({ detail: 'Recurring transaction not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to update recurring transaction' }, { status: 400 })
  }
}

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.recurringId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const recurring = await db.prepare('SELECT workspace_id FROM recurring_transactions WHERE id = ?').bind(params.recurringId).first<{ workspace_id: string }>()
    if (!recurring) return Response.json({ detail: 'Recurring transaction not found' }, { status: 404 })
    await requireWorkspaceRole(db, recurring.workspace_id, userId, 'editor')
    await db.prepare('DELETE FROM recurring_transactions WHERE id = ?').bind(params.recurringId).run()
    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to delete recurring transaction' }, { status: 400 })
  }
}