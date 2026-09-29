import type { APIRoute } from 'astro'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { getSetting } from '../../../lib/server/settings'

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = requireDatabase(getRuntimeEnv(locals))
    return Response.json({ light: await getSetting(db, 'theme_color_light'), dark: await getSetting(db, 'theme_color_dark') })
  } catch {
    return Response.json({ detail: 'Unable to load default colors' }, { status: 500 })
  }
}