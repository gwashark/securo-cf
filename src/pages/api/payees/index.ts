import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'
import { serializePayee, type PayeeRow, type PayeeTaxIdRow } from '../../../lib/server/payees'

export const GET: APIRoute = async ({ request, locals, url }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId)
    const q = url.searchParams.get('q')?.trim().toLowerCase()
    const type = url.searchParams.get('type')
    const isFavorite = url.searchParams.get('is_favorite')
    let conditions = ['workspace_id = ?']
    const values: unknown[] = [workspaceId]
    if (q) { conditions.push('name LIKE ?'); values.push(`%${q}%`) }
    if (type) { conditions.push('type = ?'); values.push(type) }
    if (isFavorite !== null) { conditions.push('is_favorite = ?'); values.push(isFavorite === 'true' ? 1 : 0) }
    const rows = await db.prepare(`SELECT * FROM payees WHERE ${conditions.join(' AND ')} ORDER BY name`).bind(...values).all<PayeeRow>()
    const payeeIds = rows.results.map((r) => r.id)
    let taxIds: PayeeTaxIdRow[] = []
    if (payeeIds.length) {
      const placeholders = payeeIds.map(() => '?').join(',')
      taxIds = (await db.prepare(`SELECT * FROM payee_tax_ids WHERE payee_id IN (${placeholders})`).bind(...payeeIds).all<PayeeTaxIdRow>()).results
    }
    const taxIdsByPayee = new Map<string, typeof taxIds>()
    for (const tid of taxIds) {
      if (!taxIdsByPayee.has(tid.payee_id)) taxIdsByPayee.set(tid.payee_id, [])
      taxIdsByPayee.get(tid.payee_id)!.push(tid)
    }
    return Response.json(rows.results.map((row) => serializePayee(row, taxIdsByPayee.get(row.id) ?? [])))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load payees' }, { status: 500 })
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
    const body = await request.json().catch(() => null) as { name?: string; type?: string | null; notes?: string | null; email?: string | null; phone?: string | null; address?: string | null; website?: string | null; tax_ids?: Array<{ kind: string; value: string }> } | null
    if (!body?.name?.trim()) return Response.json({ detail: 'Name is required' }, { status: 422 })
    const id = crypto.randomUUID()
    await db.prepare('INSERT INTO payees (id, user_id, workspace_id, name, type, source, notes, email, phone, address, website) VALUES (?, ?, ?, ?, ?, \'manual\', ?, ?, ?, ?, ?)').bind(id, userId, workspaceId, body.name.trim(), body.type ?? null, body.notes ?? null, body.email ?? null, body.phone ?? null, body.address ?? null, body.website ?? null).run()
    if (body.tax_ids?.length) {
      for (const tid of body.tax_ids) {
        await db.prepare('INSERT INTO payee_tax_ids (id, payee_id, kind, value) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), id, tid.kind, tid.value).run()
      }
    }
    const row = await db.prepare('SELECT * FROM payees WHERE id = ?').bind(id).first<PayeeRow>()
    const taxIds = (await db.prepare('SELECT * FROM payee_tax_ids WHERE payee_id = ?').bind(id).all<{ id: string; payee_id: string; kind: string; value: string }>()).results
    return row ? Response.json(serializePayee(row, taxIds), { status: 201 }) : Response.json({ detail: 'Payee not found' }, { status: 500 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to create payee' }, { status: 400 })
  }
}