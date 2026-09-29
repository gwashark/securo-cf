import type { APIRoute } from 'astro'
import { hashPassword, requireSuperuser, userResponse } from '../../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../../lib/server/runtime'

type UserRow = { id: string; email: string; preferences: string; is_active: number; is_superuser: number; is_verified: number }

export const GET: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  try {
    const db = requireDatabase(env)
    await requireSuperuser(request, env, db)
    const user = await db.prepare('SELECT id, email, preferences, is_active, is_superuser, is_verified FROM users WHERE id = ?').bind(params.userId).first<UserRow>()
    return user ? Response.json(userResponse(user)) : Response.json({ detail: 'User not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load user' }, { status: 500 })
  }
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  try {
    const db = requireDatabase(env)
    const currentId = await requireSuperuser(request, env, db)
    const body = await request.json().catch(() => null) as { email?: string; password?: string; is_active?: boolean; is_superuser?: boolean; preferences?: Record<string, unknown> } | null
    if (body?.is_superuser === false && params.userId === currentId) return Response.json({ detail: 'Cannot demote yourself' }, { status: 400 })
    const updates: string[] = []
    const values: unknown[] = []
    if (body?.email) { updates.push('email = ?'); values.push(body.email.trim().toLowerCase()) }
    if (body?.password) { updates.push('password_hash = ?'); values.push(await hashPassword(body.password)) }
    if (body?.is_active !== undefined) { updates.push('is_active = ?'); values.push(body.is_active ? 1 : 0) }
    if (body?.is_superuser !== undefined) { updates.push('is_superuser = ?'); values.push(body.is_superuser ? 1 : 0) }
    if (body?.preferences !== undefined) { updates.push('preferences = ?'); values.push(JSON.stringify(body.preferences)) }
    if (!updates.length) return Response.json({ detail: 'No changes supplied' }, { status: 422 })
    await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values, params.userId).run()
    const user = await db.prepare('SELECT id, email, preferences, is_active, is_superuser, is_verified FROM users WHERE id = ?').bind(params.userId).first<UserRow>()
    return user ? Response.json(userResponse(user)) : Response.json({ detail: 'User not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to update user' }, { status: 400 })
  }
}

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  try {
    const db = requireDatabase(env)
    const currentId = await requireSuperuser(request, env, db)
    if (params.userId === currentId) return Response.json({ detail: 'Cannot delete yourself' }, { status: 400 })
    await db.prepare('DELETE FROM users WHERE id = ?').bind(params.userId).run()
    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to delete user' }, { status: 400 })
  }
}