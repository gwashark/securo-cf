import type { APIRoute } from 'astro'
import { requireSuperuser } from '../../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../../lib/server/runtime'
import { SETTING_VALIDATORS, getSetting } from '../../../../lib/server/settings'

export const GET: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  try {
    const db = requireDatabase(env)
    await requireSuperuser(request, env, db)
    const key = params.key ?? ''
    const value = await getSetting(db, key)
    return value === null ? Response.json({ detail: 'Setting not found' }, { status: 404 }) : Response.json({ key, value })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load setting' }, { status: 500 })
  }
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  try {
    const db = requireDatabase(env)
    await requireSuperuser(request, env, db)
    const key = params.key ?? ''
    const body = await request.json().catch(() => null) as { value?: string } | null
    if (!body?.value || !SETTING_VALIDATORS[key] || !SETTING_VALIDATORS[key](body.value)) return Response.json({ detail: `Invalid value for '${key}'` }, { status: 400 })
    await db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, body.value).run()
    return Response.json({ key, value: body.value })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to update setting' }, { status: 400 })
  }
}

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  try {
    const db = requireDatabase(env)
    await requireSuperuser(request, env, db)
    const key = params.key ?? ''
    if (!SETTING_VALIDATORS[key]) return Response.json({ detail: `Setting '${key}' is not configurable` }, { status: 400 })
    await db.prepare('DELETE FROM app_settings WHERE key = ?').bind(key).run()
    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to delete setting' }, { status: 400 })
  }
}