import type { APIRoute } from 'astro'
import { hashPassword, requireSuperuser, userResponse } from '../../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../../lib/server/runtime'

type UserRow = { id: string; email: string; preferences: string; is_active: number; is_superuser: number; is_verified: number }

export const GET: APIRoute = async ({ request, locals, url }) => {
  const env = getRuntimeEnv(locals)
  try {
    const db = requireDatabase(env)
    await requireSuperuser(request, env, db)
    const search = url.searchParams.get('search')?.trim().toLowerCase() ?? ''
    const page = Math.max(Number(url.searchParams.get('page') ?? 1), 1)
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 50), 1), 100)
    const pattern = `%${search}%`
    const total = await db.prepare('SELECT COUNT(*) AS count FROM users WHERE email LIKE ? COLLATE NOCASE').bind(pattern).first<{ count: number }>()
    const rows = await db.prepare('SELECT id, email, preferences, is_active, is_superuser, is_verified FROM users WHERE email LIKE ? COLLATE NOCASE ORDER BY email LIMIT ? OFFSET ?').bind(pattern, limit, (page - 1) * limit).all<UserRow>()
    return Response.json({ items: rows.results.map(userResponse), total: total?.count ?? 0 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to list users' }, { status: 500 })
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  try {
    const db = requireDatabase(env)
    await requireSuperuser(request, env, db)
    const body = await request.json().catch(() => null) as { email?: string; password?: string; is_superuser?: boolean; preferences?: Record<string, unknown> } | null
    const email = body?.email?.trim().toLowerCase()
    if (!email || !body?.password || body.password.length < 8) return Response.json({ detail: 'Invalid user' }, { status: 422 })
    const id = crypto.randomUUID()
    await db.prepare('INSERT INTO users (id, email, password_hash, preferences, is_superuser) VALUES (?, ?, ?, ?, ?)').bind(id, email, await hashPassword(body.password), JSON.stringify(body.preferences ?? {}), body.is_superuser ? 1 : 0).run()
    const workspaceId = crypto.randomUUID()
    await db.prepare("INSERT INTO workspaces (id, name, kind, created_by_user_id) VALUES (?, 'Personal', 'personal', ?)").bind(workspaceId, id).run()
    await db.prepare("INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'owner')").bind(crypto.randomUUID(), workspaceId, id).run()
    const user = await db.prepare('SELECT id, email, preferences, is_active, is_superuser, is_verified FROM users WHERE id = ?').bind(id).first<UserRow>()
    return Response.json(user ? userResponse(user) : null, { status: 201 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to create user' }, { status: 400 })
  }
}