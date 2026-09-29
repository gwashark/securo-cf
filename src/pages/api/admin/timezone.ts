import type { APIRoute } from 'astro'
import { requireSuperuser } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { getSetting } from '../../../lib/server/settings'

export const GET: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  try {
    const db = requireDatabase(env)
    await requireSuperuser(request, env, db)
    const saved = await getSetting(db, 'timezone')
    const timezone = saved || 'UTC'
    const available = typeof Intl.supportedValuesOf === 'function' ? ['UTC', ...Intl.supportedValuesOf('timeZone')] : ['UTC']
    return Response.json({ timezone, saved, fallback: 'UTC', available: [...new Set(available)].sort() })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load timezone' }, { status: 500 })
  }
}