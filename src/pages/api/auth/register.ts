import type { APIRoute } from 'astro'
import { hashPassword, issueToken } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { getSetting } from '../../../lib/server/settings'

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json().catch(() => null) as {
    email?: string
    password?: string
    preferences?: Record<string, unknown>
  } | null
  const email = body?.email?.trim().toLowerCase()

  if (!email || !body?.password || body.password.length < 8) {
    return Response.json({ detail: 'Invalid email or password' }, { status: 422 })
  }

  const env = getRuntimeEnv(locals)
  try {
    const db = requireDatabase(env)
    if (await getSetting(db, 'registration_enabled') === 'false') {
      return Response.json({ detail: 'Registration is currently disabled' }, { status: 403 })
    }
    const userId = crypto.randomUUID()
    const preferences = JSON.stringify(body.preferences ?? {})
    await db.prepare(
      'INSERT INTO users (id, email, password_hash, preferences) VALUES (?, ?, ?, ?)',
    ).bind(userId, email, await hashPassword(body.password), preferences).run()
    const workspaceId = crypto.randomUUID()
    await db.prepare(
      `INSERT INTO workspaces
        (id, name, kind, created_by_user_id, default_currency)
       VALUES (?, ?, 'personal', ?, ?)`
    ).bind(workspaceId, 'Personal', userId, body.preferences?.currency_display ?? 'USD').run()
    await db.prepare(
      `INSERT INTO workspace_members (id, workspace_id, user_id, role)
       VALUES (?, ?, ?, 'owner')`
    ).bind(crypto.randomUUID(), workspaceId, userId).run()
    return Response.json({ access_token: await issueToken(userId, env), token_type: 'bearer' }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('DB Cloudflare D1')) {
      return Response.json({ detail: 'Database is not configured' }, { status: 503 })
    }
    return Response.json({ detail: 'Unable to create account' }, { status: 400 })
  }
}