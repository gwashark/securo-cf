import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../lib/server/workspaces'
import { serializeInvoiceSchedule, type InvoiceScheduleRow, type InvoiceScheduleTermRow } from '../../../lib/server/invoiceSchedules'

export const GET: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.scheduleId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const schedule = await db.prepare('SELECT * FROM invoice_schedules WHERE id = ?').bind(params.scheduleId).first<InvoiceScheduleRow & { workspace_id: string }>()
    if (!schedule) return Response.json({ detail: 'Schedule not found' }, { status: 404 })
    await requireWorkspaceRole(db, schedule.workspace_id, userId)
    const terms = (await db.prepare('SELECT * FROM invoice_schedule_terms WHERE schedule_id = ? ORDER BY effective_from').bind(params.scheduleId).all<InvoiceScheduleTermRow>()).results
    return Response.json(serializeInvoiceSchedule(schedule, terms))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load schedule' }, { status: 500 })
  }
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.scheduleId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const schedule = await db.prepare('SELECT * FROM invoice_schedules WHERE id = ?').bind(params.scheduleId).first<InvoiceScheduleRow & { workspace_id: string }>()
    if (!schedule) return Response.json({ detail: 'Schedule not found' }, { status: 404 })
    await requireWorkspaceRole(db, schedule.workspace_id, userId, 'editor')
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const allowed = ['name', 'description', 'frequency', 'weekend_adjustment', 'day_of_month', 'start_date', 'end_date', 'status', 'currency', 'discount', 'notes', 'metadata_json'].filter((field) => body && field in body)
    if (!allowed.length) return Response.json({ detail: 'No changes supplied' }, { status: 422 })
    const values = allowed.map((field) => {
      const value = body?.[field]
      if (field === 'metadata_json' && value !== null && value !== undefined) return JSON.stringify(value)
      return value ?? null
    })
    await db.prepare(`UPDATE invoice_schedules SET ${allowed.map((field) => `${field} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...values, params.scheduleId).run()
    const updated = await db.prepare('SELECT * FROM invoice_schedules WHERE id = ?').bind(params.scheduleId).first<InvoiceScheduleRow>()
    const terms = (await db.prepare('SELECT * FROM invoice_schedule_terms WHERE schedule_id = ? ORDER BY effective_from').bind(params.scheduleId).all<{ id: string; schedule_id: string; effective_from: string; lines: string; discount: number; created_at: string }>()).results
    return updated ? Response.json(serializeInvoiceSchedule(updated, terms)) : Response.json({ detail: 'Schedule not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to update schedule' }, { status: 400 })
  }
}

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.scheduleId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const schedule = await db.prepare('SELECT workspace_id FROM invoice_schedules WHERE id = ?').bind(params.scheduleId).first<{ workspace_id: string }>()
    if (!schedule) return Response.json({ detail: 'Schedule not found' }, { status: 404 })
    await requireWorkspaceRole(db, schedule.workspace_id, userId, 'editor')
    await db.prepare('DELETE FROM invoice_schedule_terms WHERE schedule_id = ?').bind(params.scheduleId).run()
    await db.prepare('DELETE FROM invoice_schedules WHERE id = ?').bind(params.scheduleId).run()
    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to delete schedule' }, { status: 400 })
  }
}