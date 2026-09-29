import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../lib/server/workspaces'
import { serializeInvoice, type InvoiceRow } from '../../../lib/server/invoices'

export const GET: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.invoiceId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const invoice = await db.prepare('SELECT * FROM invoices WHERE id = ?').bind(params.invoiceId).first<InvoiceRow & { workspace_id: string }>()
    if (!invoice) return Response.json({ detail: 'Invoice not found' }, { status: 404 })
    await requireWorkspaceRole(db, invoice.workspace_id, userId)
    return Response.json(serializeInvoice(invoice))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load invoice' }, { status: 500 })
  }
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.invoiceId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const invoice = await db.prepare('SELECT * FROM invoices WHERE id = ?').bind(params.invoiceId).first<InvoiceRow & { workspace_id: string }>()
    if (!invoice) return Response.json({ detail: 'Invoice not found' }, { status: 404 })
    await requireWorkspaceRole(db, invoice.workspace_id, userId, 'editor')
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const allowed = ['due_date', 'payee_id', 'payee_name', 'payee_email', 'payee_address', 'payee_tax_id', 'notes', 'metadata_json'].filter((field) => body && field in body)
    if (!allowed.length) return Response.json({ detail: 'No changes supplied' }, { status: 422 })
    const values = allowed.map((field) => {
      const value = body?.[field]
      if (field === 'metadata_json' && value !== null && value !== undefined) return JSON.stringify(value)
      return value ?? null
    })
    await db.prepare(`UPDATE invoices SET ${allowed.map((field) => `${field} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...values, params.invoiceId).run()
    const updated = await db.prepare('SELECT * FROM invoices WHERE id = ?').bind(params.invoiceId).first<InvoiceRow>()
    return updated ? Response.json(serializeInvoice(updated)) : Response.json({ detail: 'Invoice not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to update invoice' }, { status: 400 })
  }
}

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.invoiceId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const invoice = await db.prepare('SELECT workspace_id FROM invoices WHERE id = ?').bind(params.invoiceId).first<{ workspace_id: string }>()
    if (!invoice) return Response.json({ detail: 'Invoice not found' }, { status: 404 })
    await requireWorkspaceRole(db, invoice.workspace_id, userId, 'editor')
    await db.prepare('DELETE FROM invoices WHERE id = ?').bind(params.invoiceId).run()
    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to delete invoice' }, { status: 400 })
  }
}