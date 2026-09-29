import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'
import { serializeInvoiceSchedule, type InvoiceScheduleRow, type InvoiceScheduleTermRow } from '../../../lib/server/invoiceSchedules'

export const GET: APIRoute = async ({ request, locals, url }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId)
    const status = url.searchParams.get('status')
    const payeeId = url.searchParams.get('payee_id')
    let conditions = ['workspace_id = ?']
    const values: unknown[] = [workspaceId]
    if (status) { conditions.push('status = ?'); values.push(status) }
    if (payeeId) { conditions.push('payee_id = ?'); values.push(payeeId) }
    const rows = await db.prepare(`SELECT * FROM invoice_schedules WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`).bind(...values).all<InvoiceScheduleRow>()
    const scheduleIds = rows.results.map((r) => r.id)
    let terms: InvoiceScheduleTermRow[] = []
    if (scheduleIds.length) {
      const placeholders = scheduleIds.map(() => '?').join(',')
      const termRows = await db.prepare(`SELECT * FROM invoice_schedule_terms WHERE schedule_id IN (${placeholders})`).bind(...scheduleIds).all<InvoiceScheduleTermRow>()
      terms = termRows.results
    }
    const termsBySchedule = new Map<string, InvoiceScheduleTermRow[]>()
    for (const term of terms) {
      if (!termsBySchedule.has(term.schedule_id)) termsBySchedule.set(term.schedule_id, [])
      termsBySchedule.get(term.schedule_id)!.push(term)
    }
    return Response.json(rows.results.map((row) => serializeInvoiceSchedule(row, termsBySchedule.get(row.id) ?? [])))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load invoice schedules' }, { status: 500 })
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
    const body = await request.json().catch(() => null) as { payee_id?: string | null; payee_name?: string | null; payee_email?: string | null; payee_address?: string | null; payee_tax_id?: string | null; name?: string; description?: string | null; frequency?: string; weekend_adjustment?: string; day_of_month?: number | null; start_date?: string; end_date?: string | null; currency?: string; lines?: Array<{ description: string; quantity: number; unit_price: number; tax_rate?: number }>; discount?: number; notes?: string | null; metadata_json?: Record<string, unknown> | null } | null
    if (!body?.name?.trim() || !body?.frequency || !body?.start_date || !body?.lines?.length) return Response.json({ detail: 'Invalid schedule' }, { status: 422 })
    const id = crypto.randomUUID()
    const lines = JSON.stringify(body.lines)
    await db.prepare('INSERT INTO invoice_schedules (id, user_id, workspace_id, payee_id, payee_name, payee_email, payee_address, payee_tax_id, name, description, frequency, weekend_adjustment, day_of_month, start_date, end_date, status, next_sequence, currency, lines, discount, notes, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, userId, workspaceId, body.payee_id ?? null, body.payee_name ?? null, body.payee_email ?? null, body.payee_address ?? null, body.payee_tax_id ?? null, body.name.trim(), body.description ?? null, body.frequency, body.weekend_adjustment ?? 'none', body.day_of_month ?? null, body.start_date, body.end_date ?? null, 'active', 1, body.currency ?? 'USD', lines, body.discount ?? 0, body.notes ?? null, body.metadata_json ? JSON.stringify(body.metadata_json) : null).run()
    const row = await db.prepare('SELECT * FROM invoice_schedules WHERE id = ?').bind(id).first<InvoiceScheduleRow>()
    return row ? Response.json(serializeInvoiceSchedule(row, []), { status: 201 }) : Response.json({ detail: 'Schedule not found' }, { status: 500 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to create invoice schedule' }, { status: 400 })
  }
}