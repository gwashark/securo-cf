import type { APIRoute } from 'astro'
import { issueToken, verifyPassword } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'

type UserRecord = { id: string; password_hash: string; is_active: number }

export const POST: APIRoute = async ({ request, locals }) => {
  const form = await request.formData().catch(() => null)
  const email = form?.get('username')?.toString().trim().toLowerCase()
  const password = form?.get('password')?.toString()
  if (!email || !password) return Response.json({ detail: 'LOGIN_BAD_CREDENTIALS' }, { status: 400 })

  const env = getRuntimeEnv(locals)
  try {
    const user = await requireDatabase(env).prepare(
      'SELECT id, password_hash, is_active FROM users WHERE email = ? COLLATE NOCASE',
    ).bind(email).first<UserRecord>()
    if (!user || !user.is_active || !(await verifyPassword(password, user.password_hash))) {
      return Response.json({ detail: 'LOGIN_BAD_CREDENTIALS' }, { status: 400 })
    }
    return Response.json({ access_token: await issueToken(user.id, env), token_type: 'bearer' })
  } catch (error) {
    if (error instanceof Error && error.message.includes('DB Cloudflare D1')) {
      return Response.json({ detail: 'Database is not configured' }, { status: 503 })
    }
    return Response.json({ detail: 'Unable to authenticate' }, { status: 500 })
  }
}