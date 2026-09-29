import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'
import { serializeAccount, type AccountRow } from '../../../lib/server/accounts'

export const GET: APIRoute = async ({ request, locals, url }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId)
    const includeClosed = url.searchParams.get('include_closed') === 'true'
    const rows = await db.prepare(`SELECT * FROM accounts WHERE workspace_id = ? ${includeClosed ? '' : 'AND is_closed = 0'} ORDER BY name`).bind(workspaceId).all<AccountRow>()
    return Response.json(rows.results.map(serializeAccount))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load accounts' }, { status: 500 })
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
    const body = await request.json().catch(() => null) as { name?: string; type?: string; balance?: number; currency?: string; credit_limit?: number | null; statement_close_day?: number | null; payment_due_day?: number | null; minimum_payment?: number | null; card_brand?: string | null; card_level?: string | null } | null
    if (!body?.name?.trim() || !body.type) return Response.json({ detail: 'Name and type are required' }, { status: 422 })
    const id = crypto.randomUUID()
    await db.prepare('INSERT INTO accounts (id, user_id, workspace_id, name, type, balance, currency, credit_limit, statement_close_day, payment_due_day, minimum_payment, card_brand, card_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, userId, workspaceId, body.name.trim(), body.type, body.balance ?? 0, body.currency ?? 'USD', body.credit_limit ?? null, body.statement_close_day ?? null, body.payment_due_day ?? null, body.minimum_payment ?? null, body.card_brand ?? null, body.card_level ?? null).run()
    const row = await db.prepare('SELECT * FROM accounts WHERE id = ?').bind(id).first<AccountRow>()
    return row ? Response.json(serializeAccount(row), { status: 201 }) : Response.json({ detail: 'Account not found' }, { status: 500 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to create account' }, { status: 400 })
  }
}