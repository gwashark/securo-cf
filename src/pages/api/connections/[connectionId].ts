import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../lib/server/workspaces'

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.connectionId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const connection = await db.prepare('SELECT workspace_id FROM bank_connections WHERE id = ?').bind(params.connectionId).first<{ workspace_id: string }>()
    if (!connection) return Response.json({ detail: 'Connection not found' }, { status: 404 })
    await requireWorkspaceRole(db, connection.workspace_id, userId, 'editor')
    await db.prepare('DELETE FROM bank_connections WHERE id = ?').bind(params.connectionId).run()
    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to delete connection' }, { status: 400 })
  }
}