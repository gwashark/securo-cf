import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId, 'editor')
    const body = await request.json().catch(() => null) as { ids?: string[] } | null
    if (!body?.ids?.length) return Response.json({ detail: 'ids array is required' }, { status: 422 })
    
    const placeholders = body.ids.map(() => '?').join(',')
    await db.prepare(`DELETE FROM payee_tax_ids WHERE payee_id IN (${placeholders})`).bind(...body.ids).run()
    await db.prepare(`DELETE FROM payees WHERE id IN (${placeholders}) AND workspace_id = ?`).bind(...body.ids, workspaceId).run()
    
    return Response.json({ deleted: body.ids.length })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to bulk delete payees' }, { status: 400 })
  }
}