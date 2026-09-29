import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../../lib/server/workspaces'
import { serializeInvoice, type InvoiceRow } from '../../../../lib/server/invoices'

export const POST: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.invoiceId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const invoice = await db.prepare('SELECT * FROM invoices WHERE id = ?').bind(params.invoiceId).first<InvoiceRow & { workspace_id: string }>()
    if (!invoice) return Response.json({ detail: 'Invoice not found' }, { status: 404 })
    await requireWorkspaceRole(db, invoice.workspace_id, userId, 'editor')
    if (invoice.state !== 'draft') return Response.json({ detail: 'Only draft invoices can be issued' }, { status: 400 })
    const number = `INV-${Date.now().toString().slice(-6)}`
    await db.prepare('UPDATE invoices SET state = \'issued\', status = \'issued\', number = ?, issued_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?').bind(`INV-${Date.now().toString().slice(-6)}`, params.invoiceId).run()
    const updated = await db.prepare('SELECT * FROM invoices WHERE id = ?').bind(params.invoiceId).first<InvoiceRow>()
    return updated ? Response.json(serializeInvoice(updated)) : Response.json({ detail: 'Invoice not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to issue invoice' }, { status: 400 })
  }
}