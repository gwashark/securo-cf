import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../lib/server/workspaces'
import { serializeAccount, type AccountRow } from '../../../lib/server/accounts'

async function loadAccount(db: Parameters<typeof requireWorkspaceRole>[0], id: string) {
  return db.prepare('SELECT * FROM accounts WHERE id = ?').bind(id).first<AccountRow>()
}

export const GET: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.accountId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const account = await loadAccount(db, params.accountId)
    if (!account) return Response.json({ detail: 'Account not found' }, { status: 404 })
    await requireWorkspaceRole(db, account.workspace_id, userId)
    return Response.json(serializeAccount(account))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load account' }, { status: 500 })
  }
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.accountId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const account = await loadAccount(db, params.accountId)
    if (!account) return Response.json({ detail: 'Account not found' }, { status: 404 })
    await requireWorkspaceRole(db, account.workspace_id, userId, 'editor')
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const allowed = ['name', 'display_name', 'type', 'balance', 'credit_limit', 'statement_close_day', 'payment_due_day', 'minimum_payment', 'card_brand', 'card_level'].filter((field) => body && field in body)
    if (!allowed.length) return Response.json({ detail: 'No changes supplied' }, { status: 422 })
    await db.prepare(`UPDATE accounts SET ${allowed.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`).bind(...allowed.map((field) => body?.[field] ?? null), params.accountId).run()
    const updated = await loadAccount(db, params.accountId)
    return updated ? Response.json(serializeAccount(updated)) : Response.json({ detail: 'Account not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to update account' }, { status: 400 })
  }
}

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.accountId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const account = await loadAccount(db, params.accountId)
    if (!account) return Response.json({ detail: 'Account not found' }, { status: 404 })
    await requireWorkspaceRole(db, account.workspace_id, userId, 'editor')
    await db.prepare('DELETE FROM accounts WHERE id = ?').bind(params.accountId).run()
    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to delete account' }, { status: 400 })
  }
}