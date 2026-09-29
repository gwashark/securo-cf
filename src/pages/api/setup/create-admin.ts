import type { APIRoute } from 'astro'
import { hashPassword, issueToken } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  try {
    const db = requireDatabase(env)
    const existing = await db.prepare('SELECT COUNT(*) AS count FROM users').first<{ count: number }>()
    if ((existing?.count ?? 0) > 0) return Response.json({ detail: 'Setup already completed' }, { status: 403 })
    const body = await request.json().catch(() => null) as { email?: string; password?: string; currency?: string; name?: string; language?: string } | null
    const email = body?.email?.trim().toLowerCase()
    if (!email || !body?.password || body.password.length < 8) return Response.json({ detail: 'Invalid email or password' }, { status: 422 })
    const userId = crypto.randomUUID()
    const preferences = JSON.stringify({
      currency_display: body.currency ?? 'USD',
      language: body.language ?? 'pt-BR',
      onboarding_completed: false,
      ...(body.name ? { display_name: body.name } : {}),
    })
    await db.prepare('INSERT INTO users (id, email, password_hash, preferences, is_superuser, is_verified) VALUES (?, ?, ?, ?, 1, 1)').bind(userId, email, await hashPassword(body.password), preferences).run()
    const workspaceId = crypto.randomUUID()
    await db.prepare('INSERT INTO workspaces (id, name, kind, created_by_user_id, default_currency, locale) VALUES (?, ?, \'personal\', ?, ?, ?)').bind(workspaceId, body.language?.startsWith('pt') ? 'Pessoal' : 'Personal', userId, body.currency ?? 'USD', body.language ?? 'pt-BR').run()
    await db.prepare("INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'owner')").bind(crypto.randomUUID(), workspaceId, userId).run()
    return Response.json({ access_token: await issueToken(userId, env), token_type: 'bearer' })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to create administrator' }, { status: 400 })
  }
}