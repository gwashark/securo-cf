import type { APIRoute } from 'astro'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'

export const GET: APIRoute = async ({ locals }) => {
  try {
    const count = await requireDatabase(getRuntimeEnv(locals)).prepare('SELECT COUNT(*) AS count FROM users').first<{ count: number }>()
    return Response.json({ has_users: (count?.count ?? 0) > 0 })
  } catch {
    return Response.json({ detail: 'Unable to load setup status' }, { status: 500 })
  }
}