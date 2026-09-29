import type { APIRoute } from 'astro'
import { readToken } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'

type UserRecord = {
  id: string
  email: string
  preferences: string
  is_active: number
  is_superuser: number
  is_verified: number
}

export const GET: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  const authorization = request.headers.get('Authorization')
  const userId = await readToken(authorization?.replace(/^Bearer\s+/i, '') ?? null, env).catch(() => null)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })

  try {
    const user = await requireDatabase(env).prepare(
      'SELECT id, email, preferences, is_active, is_superuser, is_verified FROM users WHERE id = ?',
    ).bind(userId).first<UserRecord>()
    if (!user || !user.is_active) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
    return Response.json({
      id: user.id,
      email: user.email,
      is_active: Boolean(user.is_active),
      is_superuser: Boolean(user.is_superuser),
      is_verified: Boolean(user.is_verified),
      is_2fa_enabled: false,
      preferences: JSON.parse(user.preferences || '{}'),
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('DB Cloudflare D1')) {
      return Response.json({ detail: 'Database is not configured' }, { status: 503 })
    }
    return Response.json({ detail: 'Unable to load user' }, { status: 500 })
  }
}