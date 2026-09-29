import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { serializeConnection, type ConnectionRow } from '../../../lib/server/connections'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'

export const GET: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId)
    const rows = await db.prepare('SELECT id, user_id, provider, external_id, institution_name, display_name, logo_url, settings, status, last_sync_at, created_at FROM bank_connections WHERE workspace_id = ? ORDER BY created_at DESC').bind(workspaceId).all<ConnectionRow>()
    return Response.json(rows.results.map(serializeConnection))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load connections' }, { status: 500 })
  }
}