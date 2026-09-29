import type { APIRoute } from 'astro'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { getSetting } from '../../../lib/server/settings'

export const GET: APIRoute = async ({ locals }) => {
  try {
    const value = await getSetting(requireDatabase(getRuntimeEnv(locals)), 'registration_enabled')
    return Response.json({ enabled: value !== 'false' })
  } catch {
    return Response.json({ detail: 'Unable to load registration status' }, { status: 500 })
  }
}