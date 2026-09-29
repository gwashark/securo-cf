import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'
import { serializeInvoice, type InvoiceRow } from '../../../lib/server/invoices'

export const GET: APIRoute = async ({ request, locals, url }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId)
    const state = url.searchParams.get('state')
    const direction = url.searchParams.get('direction') ?? 'receivable'
    const year = url.searchParams.get('year')
    const payeeId = url.searchParams.get('payee_id')
    const q = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 100), 1), 500)
    const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0)
    
    let conditions = ['workspace_id = ?']
    const values: unknown[] = [workspaceId]
    if (state) { conditions.push('state = ?'); values.push(state) }
    if (direction) { conditions.push('direction = ?'); values.push(direction) }
    if (year) { conditions.push('strftime(\'%Y\', issue_date) = ?'); values.push(year) }
    if (payeeId) { conditions.push('payee_id = ?'); values.push(payeeId) }
    if (q) { conditions.push('(number LIKE ? OR payee_name LIKE ?)'); values.push(`%${q}%`, `%${q}%`) }
    
    const rows = await db.prepare(`SELECT * FROM invoices WHERE ${conditions.join(' AND ')} ORDER BY issue_date DESC, created_at DESC LIMIT ? OFFSET ?`).bind(...values, limit, offset).all<InvoiceRow>()
    return Response.json(rows.results.map(serializeInvoice))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load invoices' }, { status: 500 })
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
    const body = await request.json().catch(() => null) as { direction?: string; issue_date?: string; due_date?: string | null; currency?: string; payee_id?: string | null; payee_name?: string; payee_email?: string | null; payee_address?: string | null; payee_tax_id?: string | null; lines?: Array<{ description: string; quantity: number; unit_price: number; tax_rate?: number }>; notes?: string | null } | null
    if (!body?.direction || !['receivable', 'payable'].includes(body.direction) || !body?.issue_date || !body?.lines?.length) return Response.json({ detail: 'Invalid invoice' }, { status: 422 })
    const id = crypto.randomUUID()
    const lines = JSON.stringify(body.lines)
    const subtotal = body.lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0)
    const taxAmount = body.lines.reduce((sum, line) => sum + line.quantity * line.unit_price * (line.tax_rate ?? 0) / 100, 0)
    const totalAmount = subtotal + taxAmount
    const number = `INV-${Date.now().toString().slice(-6)}`
    await db.prepare('INSERT INTO invoices (id, user_id, workspace_id, direction, state, number, issue_date, due_date, currency, payee_id, payee_name, lines, subtotal, tax_amount, total_amount, balance, status) VALUES (?, ?, ?, ?, \'draft\', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'draft\')').bind(id, userId, workspaceId, body.direction, number, body.issue_date, body.due_date ?? null, body.currency ?? 'USD', body.payee_id ?? null, body.payee_name ?? null, lines, subtotal, taxAmount, totalAmount, totalAmount).run()
    const row = await db.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first<InvoiceRow>()
    return row ? Response.json(serializeInvoice(row), { status: 201 }) : Response.json({ detail: 'Invoice not found' }, { status: 500 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to create invoice' }, { status: 400 })
  }
}