import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { getSetting } from '../../../lib/server/settings'

export const GET: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  if (!await authenticatedUserId(request, env)) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    return Response.json({ format: await getSetting(requireDatabase(env), 'date_format') ?? 'auto' })
  } catch {
    return Response.json({ detail: 'Unable to load date format' }, { status: 500 })
  }
}