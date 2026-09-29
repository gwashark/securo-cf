import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../../lib/server/auth'
import { serializeConnection, type ConnectionRow } from '../../../../lib/server/connections'
import { getRuntimeEnv, requireDatabase } from '../../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../../lib/server/workspaces'

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.connectionId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const connection = await db.prepare('SELECT * FROM bank_connections WHERE id = ?').bind(params.connectionId).first<ConnectionRow & { workspace_id: string }>()
    if (!connection) return Response.json({ detail: 'Connection not found' }, { status: 404 })
    await requireWorkspaceRole(db, connection.workspace_id, userId, 'editor')
    const body = await request.json().catch(() => null) as { display_name?: string | null; payee_source?: string; import_pending?: boolean; sync_assets?: boolean } | null
    const current = JSON.parse(connection.settings || '{}')
    if (body?.display_name !== undefined) await db.prepare('UPDATE bank_connections SET display_name = ? WHERE id = ?').bind(body.display_name, params.connectionId).run()
    const settings = { ...current, ...Object.fromEntries(Object.entries(body ?? {}).filter(([key]) => ['payee_source', 'import_pending', 'sync_assets'].includes(key))) }
    await db.prepare('UPDATE bank_connections SET settings = ? WHERE id = ?').bind(JSON.stringify(settings), params.connectionId).run()
    const updated = await db.prepare('SELECT id, user_id, provider, external_id, institution_name, display_name, logo_url, settings, status, last_sync_at, created_at FROM bank_connections WHERE id = ?').bind(params.connectionId).first<ConnectionRow>()
    return updated ? Response.json(serializeConnection(updated)) : Response.json({ detail: 'Connection not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to update connection settings' }, { status: 400 })
  }
}