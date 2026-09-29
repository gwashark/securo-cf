import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../../lib/server/workspaces'
import { serializeInvoice, type InvoiceRow } from '../../../../lib/server/invoices'

function nextOccurrenceDate(dateStr: string, frequency: string, dayOfMonth: number | null): string {
  const date = new Date(dateStr + 'T00:00:00')
  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7)
      break
    case 'biweekly':
      date.setDate(date.getDate() + 14)
      break
    case 'monthly':
      date.setMonth(date.getMonth() + 1)
      break
    case 'quarterly':
      date.setMonth(date.getMonth() + 3)
      break
    case 'semiannual':
      date.setMonth(date.getMonth() + 6)
      break
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1)
      break
  }
  return date.toISOString().slice(0, 10)
}

export const POST: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.scheduleId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const schedule = await db.prepare('SELECT * FROM invoice_schedules WHERE id = ?').bind(params.scheduleId).first<{ id: string; workspace_id: string; user_id: string; status: string; next_sequence: number; frequency: string; day_of_month: number | null; start_date: string; end_date: string | null; lines: string; currency: string; discount: number; name: string; description: string | null; payee_id: string | null; payee_name: string | null; payee_email: string | null; payee_address: string | null; payee_tax_id: string | null; user_id: string }>()
    if (!schedule) return Response.json({ detail: 'Schedule not found' }, { status: 404 })
    await requireWorkspaceRole(db, schedule.workspace_id, userId, 'editor')
    if (schedule.status !== 'active') return Response.json({ detail: 'Only active schedules can generate invoices' }, { status: 400 })
    
    const today = new Date().toISOString().slice(0, 10)
    const lines = JSON.parse(schedule.lines || '[]')
    const subtotal = lines.reduce((sum: number, line: { quantity: number; unit_price: number }) => sum + line.quantity * line.unit_price, 0)
    const taxAmount = lines.reduce((sum: number, line: { quantity: number; unit_price: number; tax_rate?: number }) => sum + line.quantity * line.unit_price * (line.tax_rate ?? 0) / 100, 0)
    const totalAmount = subtotal + taxAmount - (schedule.discount || 0)
    
    const invoiceId = crypto.randomUUID()
    const number = `INV-${Date.now().toString().slice(-6)}`
    const issueDate = new Date().toISOString().slice(0, 10)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)
    
    await db.prepare('INSERT INTO invoices (id, user_id, workspace_id, direction, state, number, issue_date, due_date, currency, payee_id, payee_name, lines, subtotal, tax_amount, total_amount, balance, status, schedule_id, sequence) VALUES (?, ?, ?, \'receivable\', \'issued\', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'issued\', ?, ?)').bind(crypto.randomUUID(), schedule.user_id, schedule.workspace_id, `INV-${Date.now().toString().slice(-6)}`, issueDate, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), schedule.currency, schedule.payee_id, schedule.payee_name, JSON.stringify(schedule.lines), totalAmount, 0, totalAmount, totalAmount, 'issued', schedule.id, schedule.next_sequence).run()
    
    await db.prepare('UPDATE invoice_schedules SET next_sequence = next_sequence + 1, next_occurrence = ? WHERE id = ?').bind(nextOccurrenceDate(schedule.start_date, 'monthly', null), schedule.id).run()
    
    const row = await db.prepare('SELECT * FROM invoices WHERE id = ?').bind(crypto.randomUUID()).first<{ id: string }>()
    return Response.json({ generated: 1, invoice_id: invoiceId }, { status: 201 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to generate invoice' }, { status: 400 })
  }
}