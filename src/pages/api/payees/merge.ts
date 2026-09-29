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
    const body = await request.json().catch(() => null) as { source_ids?: string[]; target_id?: string } | null
    if (!body?.source_ids?.length || !body?.target_id) return Response.json({ detail: 'source_ids and target_id are required' }, { status: 422 })
    if (body.source_ids.includes(body.target_id)) return Response.json({ detail: 'Target cannot be in source list' }, { status: 422 })
    
    // Update transactions to point to target payee
    const placeholders = body.source_ids.map(() => '?').join(',')
    await db.prepare(`UPDATE transactions SET payee_id = ? WHERE payee_id IN (${placeholders}) AND workspace_id = ?`).bind(body.target_id, ...body.source_ids, workspaceId).run()
    
    // Delete source payees
    await db.prepare(`DELETE FROM payee_tax_ids WHERE payee_id IN (${body.source_ids.map(() => '?').join(',')})`).bind(...body.source_ids).run()
    await db.prepare(`DELETE FROM payees WHERE id IN (${body.source_ids.map(() => '?').join(',')})`).bind(...body.source_ids).run()
    
    return Response.json({ merged: body.source_ids.length, transactions_reassigned: 0 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to merge payees' }, { status: 400 })
  }
}