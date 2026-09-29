import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../lib/server/workspaces'
import { serializePayee, type PayeeRow, type PayeeTaxIdRow } from '../../../lib/server/payees'

export const GET: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.payeeId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const payee = await db.prepare('SELECT * FROM payees WHERE id = ?').bind(params.payeeId).first<PayeeRow & { workspace_id: string }>()
    if (!payee) return Response.json({ detail: 'Payee not found' }, { status: 404 })
    await requireWorkspaceRole(db, payee.workspace_id, userId)
    const taxIds = (await db.prepare('SELECT * FROM payee_tax_ids WHERE payee_id = ?').bind(params.payeeId).all<PayeeTaxIdRow>()).results
    return Response.json(serializePayee(payee, taxIds))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load payee' }, { status: 500 })
  }
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.payeeId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const payee = await db.prepare('SELECT * FROM payees WHERE id = ?').bind(params.payeeId).first<PayeeRow & { workspace_id: string }>()
    if (!payee) return Response.json({ detail: 'Payee not found' }, { status: 404 })
    await requireWorkspaceRole(db, payee.workspace_id, userId, 'editor')
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const allowed = ['name', 'type', 'is_favorite', 'notes', 'email', 'phone', 'address', 'website'].filter((field) => body && field in body)
    if (!allowed.length) return Response.json({ detail: 'No changes supplied' }, { status: 422 })
    const values = allowed.map((field) => {
      const value = body?.[field]
      if (field === 'is_favorite' && typeof value === 'boolean') return value ? 1 : 0
      return value ?? null
    })
    await db.prepare(`UPDATE payees SET ${allowed.map((field) => `${field} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...values, params.payeeId).run()
    if (body?.tax_ids) {
      await db.prepare('DELETE FROM payee_tax_ids WHERE payee_id = ?').bind(params.payeeId).run()
      for (const tid of body.tax_ids as Array<{ kind: string; value: string }>) {
        await db.prepare('INSERT INTO payee_tax_ids (id, payee_id, kind, value) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), params.payeeId, tid.kind, tid.value).run()
      }
    }
    const updated = await db.prepare('SELECT * FROM payees WHERE id = ?').bind(params.payeeId).first<PayeeRow>()
    const taxIds = (await db.prepare('SELECT * FROM payee_tax_ids WHERE payee_id = ?').bind(params.payeeId).all<{ id: string; payee_id: string; kind: string; value: string }>()).results
    return updated ? Response.json(serializePayee(updated, taxIds)) : Response.json({ detail: 'Payee not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to update payee' }, { status: 400 })
  }
}

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.payeeId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const payee = await db.prepare('SELECT workspace_id FROM payees WHERE id = ?').bind(params.payeeId).first<{ workspace_id: string }>()
    if (!payee) return Response.json({ detail: 'Payee not found' }, { status: 404 })
    await requireWorkspaceRole(db, payee.workspace_id, userId, 'editor')
    await db.prepare('DELETE FROM payee_tax_ids WHERE payee_id = ?').bind(params.payeeId).run()
    await db.prepare('DELETE FROM payees WHERE id = ?').bind(params.payeeId).run()
    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to delete payee' }, { status: 400 })
  }
}