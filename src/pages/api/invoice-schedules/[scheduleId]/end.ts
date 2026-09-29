import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../../lib/server/workspaces'
import { serializeInvoiceSchedule, type InvoiceScheduleRow } from '../../../../lib/server/invoiceSchedules'

export const POST: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.scheduleId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const schedule = await db.prepare('SELECT * FROM invoice_schedules WHERE id = ?').bind(params.scheduleId).first<InvoiceScheduleRow & { workspace_id: string }>()
    if (!schedule) return Response.json({ detail: 'Schedule not found' }, { status: 404 })
    await requireWorkspaceRole(db, schedule.workspace_id, userId, 'editor')
    if (schedule.status === 'ended') return Response.json({ detail: 'Schedule already ended' }, { status: 400 })
    const body = await request.json().catch(() => null) as { reason?: string; ended_at?: string } | null
    await db.prepare('UPDATE invoice_schedules SET status = \'ended\', ended_at = ?, ended_reason = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(body?.ended_at ?? new Date().toISOString().slice(0, 10), body?.reason ?? null, params.scheduleId).run()
    const updated = await db.prepare('SELECT * FROM invoice_schedules WHERE id = ?').bind(params.scheduleId).first<InvoiceScheduleRow>()
    return updated ? Response.json(serializeInvoiceSchedule(updated, [])) : Response.json({ detail: 'Schedule not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to end schedule' }, { status: 400 })
  }
}