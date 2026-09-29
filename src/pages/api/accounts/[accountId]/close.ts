import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../../lib/server/workspaces'
import { serializeAccount, type AccountRow } from '../../../../lib/server/accounts'

export const POST: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.accountId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const account = await db.prepare('SELECT * FROM accounts WHERE id = ?').bind(params.accountId).first<AccountRow>()
    if (!account) return Response.json({ detail: 'Account not found' }, { status: 404 })
    await requireWorkspaceRole(db, account.workspace_id, userId, 'editor')
    await db.prepare("UPDATE accounts SET is_closed = 1, closed_at = datetime('now') WHERE id = ?").bind(params.accountId).run()
    const updated = await db.prepare('SELECT * FROM accounts WHERE id = ?').bind(params.accountId).first<AccountRow>()
    return updated ? Response.json(serializeAccount(updated)) : Response.json({ detail: 'Account not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to close account' }, { status: 400 })
  }
}