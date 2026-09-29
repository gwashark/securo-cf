import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { serializeWorkspace, type WorkspaceRow } from '../../../lib/server/workspaces'

export const GET: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const workspaceId = request.headers.get('X-Workspace-Id')
    const db = requireDatabase(env)
    const row = await db.prepare(
      `SELECT w.*, wm.role FROM workspaces w
       INNER JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = ? AND w.is_archived = 0
         AND (? IS NULL OR w.id = ?)
       ORDER BY w.created_at ASC LIMIT 1`,
    ).bind(userId, workspaceId, workspaceId).first<WorkspaceRow>()
    if (!row) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    return Response.json(serializeWorkspace(row))
  } catch {
    return Response.json({ detail: 'Unable to load workspace' }, { status: 500 })
  }
}