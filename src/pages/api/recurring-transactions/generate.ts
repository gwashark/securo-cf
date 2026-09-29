import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'

function nextOccurrenceDate(dateStr: string, frequency: string, dayOfMonth: number | null, weekendAdjustment: string): string {
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
      if (dayOfMonth) date.setDate(dayOfMonth)
      break
    case 'quarterly':
      date.setMonth(date.getMonth() + 3)
      if (dayOfMonth) date.setDate(dayOfMonth)
      break
    case 'semiannual':
      date.setMonth(date.getMonth() + 6)
      if (dayOfMonth) date.setDate(dayOfMonth)
      break
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1)
      if (dayOfMonth) date.setDate(dayOfMonth)
      break
  }
  // Weekend adjustment
  if (weekendAdjustment !== 'none') {
    const day = date.getDay()
    if (day === 0) { // Sunday
      date.setDate(date.getDate() + (weekendAdjustment === 'previous_friday' ? -2 : 1))
    } else if (day === 6) { // Saturday
      date.setDate(date.getDate() + (weekendAdjustment === 'previous_friday' ? -1 : 2))
    }
  }
  return date.toISOString().slice(0, 10)
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
    
    const today = new Date().toISOString().slice(0, 10)
    const recurring = await db.prepare('SELECT * FROM recurring_transactions WHERE workspace_id = ? AND is_active = 1 AND auto_generate = 1 AND next_occurrence <= ?').bind(workspaceId, today).all<{ id: string; account_id: string; category_id: string | null; description: string; amount: number; currency: string; type: string; frequency: string; weekend_adjustment: string; day_of_month: number | null; start_date: string; end_date: string | null; next_occurrence: string }>()
    
    let generated = 0
    for (const r of recurring.results) {
      // Check if already generated for this occurrence
      const existing = await db.prepare('SELECT id FROM transactions WHERE workspace_id = ? AND description = ? AND amount = ? AND date = ? AND account_id = ? AND type = ?').bind(workspaceId, r.description, r.amount, r.next_occurrence, r.account_id, r.type).first<{ id: string }>()
      if (existing) {
        // Update next occurrence
        const next = nextOccurrenceDate(r.next_occurrence, r.frequency, r.day_of_month, r.weekend_adjustment)
        await db.prepare('UPDATE recurring_transactions SET next_occurrence = ? WHERE id = ?').bind(next, r.id).run()
        continue
      }
      
      // Create transaction
      const txId = crypto.randomUUID()
      await db.prepare('INSERT INTO transactions (id, user_id, workspace_id, account_id, category_id, description, amount, currency, date, effective_date, type, source, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'recurring\', \'posted\')').bind(txId, r.user_id, r.workspace_id, r.account_id, r.category_id, r.description, r.amount, r.currency, r.next_occurrence, r.next_occurrence, r.type).run()
      await db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').bind(r.type === 'credit' ? r.amount : -r.amount, r.account_id).run()
      
      // Update next occurrence
      const next = nextOccurrenceDate(r.next_occurrence, r.frequency, r.day_of_month, r.weekend_adjustment)
      await db.prepare('UPDATE recurring_transactions SET next_occurrence = ? WHERE id = ?').bind(next, r.id).run()
      generated++
    }
    
    return Response.json({ generated })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to generate recurring transactions' }, { status: 500 })
  }
}