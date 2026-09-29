import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { serializeWorkspace, type WorkspaceRow } from '../../../lib/server/workspaces'

export const GET: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const rows = await requireDatabase(env).prepare(
      `SELECT w.*, wm.role FROM workspaces w
       INNER JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = ? AND w.is_archived = 0
       ORDER BY w.created_at ASC`,
    ).bind(userId).all<WorkspaceRow>()
    return Response.json(rows.results.map(serializeWorkspace))
  } catch {
    return Response.json({ detail: 'Unable to load workspaces' }, { status: 500 })
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null) as {
    name?: string; kind?: string; default_currency?: string; locale?: string | null
    tax_jurisdiction?: string | null; icon?: string | null; color?: string | null
    self_membership?: boolean
  } | null
  if (!body?.name?.trim() || !['personal', 'business'].includes(body.kind ?? 'personal')) {
    return Response.json({ detail: 'Invalid workspace' }, { status: 422 })
  }
  try {
    const db = requireDatabase(env)
    const workspaceId = crypto.randomUUID()
    const kind = body.kind ?? 'personal'
    await db.prepare(
      `INSERT INTO workspaces
       (id, name, kind, created_by_user_id, managed_by_user_id, default_currency, locale, tax_jurisdiction, icon, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      workspaceId, body.name.trim(), kind, userId, userId, body.default_currency ?? 'USD',
      body.locale ?? null, body.tax_jurisdiction ?? null, body.icon ?? null, body.color ?? null,
    ).run()
    if (body.self_membership) {
      await db.prepare(
        `INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'owner')`,
      ).bind(crypto.randomUUID(), workspaceId, userId).run()
    }
    const row = await db.prepare(
      `SELECT w.*, ? AS role FROM workspaces w WHERE w.id = ?`,
    ).bind(body.self_membership ? 'owner' : 'manager', workspaceId).first<WorkspaceRow>()
    return Response.json(row ? serializeWorkspace(row) : null, { status: 201 })
  } catch {
    return Response.json({ detail: 'Unable to create workspace' }, { status: 400 })
  }
}