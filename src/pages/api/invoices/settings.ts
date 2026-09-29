import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'
import { serializeInvoiceSettings, type InvoiceSettingsRow } from '../../../lib/server/invoices'

export const GET: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId)
    const row = await db.prepare('SELECT * FROM invoice_settings WHERE workspace_id = ?').bind(workspaceId).first<InvoiceSettingsRow>()
    if (!row) {
      // Return defaults
      return Response.json({
        workspace_id: workspaceId,
        default_payment_terms: 30,
        default_currency: 'USD',
        default_tax_jurisdiction: null,
        logo_id: null,
        logo_content_type: null,
        logo_data: null,
        next_number_receivable: 1,
        next_number_payable: 1,
        numbering_format: '{year}-{number:04d}',
        default_payment_terms_receivable: 30,
        default_payment_terms_payable: 30,
        auto_issue_on_create: false,
        require_approval: false,
        allow_partial_payment: true,
        default_tax_jurisdiction: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }
    return Response.json(serializeInvoiceSettings(row))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load invoice settings' }, { status: 500 })
  }
}

export const PATCH: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId, 'editor')
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const allowed = ['default_payment_terms', 'default_currency', 'default_tax_jurisdiction', 'next_number_receivable', 'next_number_payable', 'numbering_format', 'default_payment_terms_receivable', 'default_payment_terms_payable', 'auto_issue_on_create', 'require_approval', 'allow_partial_payment', 'default_tax_jurisdiction'].filter((field) => body && field in body)
    if (!allowed.length) return Response.json({ detail: 'No changes supplied' }, { status: 422 })
    const values = allowed.map((field) => {
      const value = body?.[field]
      if (typeof value === 'boolean') return value ? 1 : 0
      return value ?? null
    })
    await db.prepare(`INSERT INTO invoice_settings (workspace_id, ${allowed.join(', ')}, created_at, updated_at) VALUES (?, ${allowed.map(() => '?').join(', ')}, datetime('now'), datetime('now')) ON CONFLICT(workspace_id) DO UPDATE SET ${allowed.map((field) => `${field} = excluded.${field}`).join(', ')}, updated_at = datetime('now')`).bind(workspaceId, ...values).run()
    const row = await db.prepare('SELECT * FROM invoice_settings WHERE workspace_id = ?').bind(workspaceId).first<InvoiceSettingsRow>()
    return row ? Response.json(serializeInvoiceSettings(row)) : Response.json({ detail: 'Settings not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to update invoice settings' }, { status: 400 })
  }
}