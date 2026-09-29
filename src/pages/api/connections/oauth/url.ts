import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../../lib/server/auth'
import { getRuntimeEnv, isEnabled } from '../../../../lib/server/runtime'

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  if (!await authenticatedUserId(request, env)) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  if (!isEnabled(env.MOCK_BANK_PROVIDER)) return Response.json({ detail: 'No local bank provider is enabled' }, { status: 503 })
  return Response.json({ url: '/oauth/callback?provider=local&code=local-mock-code' })
}