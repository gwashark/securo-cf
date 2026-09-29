import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
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
    for (const [param, column] of [['account_id', 'account_id'], ['category_id', 'category_id'], ['type', 'type'], ['status', 'status']] as const) {
      const value = url.searchParams.get(param)
      if (value) { conditions.push(`${column} = ?`); values.push(value) }
    }
    const rows = await db.prepare(`SELECT date, description, amount, type, currency, category_id, account_id, payee, notes, status, source, amount_primary, fx_rate_used FROM transactions WHERE ${conditions.join(' AND ')} ORDER BY date DESC, created_at DESC`).bind(...values).all<Record<string, unknown>>()
    const lines = ['date,description,amount,type,currency,category_id,account_id,payee,notes,status,source,amount_primary,fx_rate_used']
    for (const row of rows.results) lines.push(['date', 'description', 'amount', 'type', 'currency', 'category_id', 'account_id', 'payee', 'notes', 'status', 'source', 'amount_primary', 'fx_rate_used'].map((key) => csvCell(row[key])).join(','))
    return new Response(`\uFEFF${lines.join('\n')}\n`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="transactions.csv"' } })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to export transactions' }, { status: 500 })
  }
}