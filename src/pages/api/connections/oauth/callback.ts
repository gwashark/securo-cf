import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../../lib/server/auth'
import { serializeConnection, type ConnectionRow } from '../../../../lib/server/connections'
import { getRuntimeEnv, isEnabled, requireDatabase } from '../../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../../lib/server/workspaces'

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !isEnabled(env.MOCK_BANK_PROVIDER)) return Response.json({ detail: 'Local bank provider is unavailable' }, { status: userId ? 503 : 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId, 'editor')
    const body = await request.json().catch(() => null) as { provider?: string; code?: string } | null
    if (!body?.code) return Response.json({ detail: 'Authorization code is required' }, { status: 422 })
    const connectionId = crypto.randomUUID()
    await db.prepare("INSERT INTO bank_connections (id, user_id, workspace_id, provider, external_id, institution_name, display_name, settings, status) VALUES (?, ?, ?, 'local', ?, 'Local Test Bank', 'Local Test Bank', '{}', 'active')").bind(connectionId, userId, workspaceId, `local-item-${crypto.randomUUID()}`).run()
    await db.prepare("INSERT INTO accounts (id, user_id, workspace_id, connection_id, name, type, balance, currency) VALUES (?, ?, ?, ?, 'Local Checking', 'checking', 500, 'USD')").bind(crypto.randomUUID(), userId, workspaceId, connectionId).run()
    const row = await db.prepare('SELECT id, user_id, provider, external_id, institution_name, display_name, logo_url, settings, status, last_sync_at, created_at FROM bank_connections WHERE id = ?').bind(connectionId).first<ConnectionRow>()
    return row ? Response.json(serializeConnection(row)) : Response.json({ detail: 'Connection not found' }, { status: 500 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to complete local bank connection' }, { status: 400 })
  }
}