import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, isEnabled } from '../../../lib/server/runtime'
import { requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../lib/server/workspaces'

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  if (!isEnabled(env.MOCK_BANK_PROVIDER)) return Response.json({ detail: 'No local bank provider is enabled' }, { status: 503 })
  try {
    const db = requireDatabase(env)
    const workspace = await db.prepare('SELECT w.id FROM workspaces w INNER JOIN workspace_members wm ON wm.workspace_id = w.id WHERE wm.user_id = ? AND w.is_archived = 0 ORDER BY w.created_at LIMIT 1').bind(userId).first<{ id: string }>()
    if (!workspace) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspace.id, userId, 'editor')
    return Response.json({ access_token: 'local-mock-connect-token' })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to create connect token' }, { status: 400 })
  }
}