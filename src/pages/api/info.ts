import type { APIRoute } from 'astro'
import { getRuntimeEnv, isEnabled } from '../../lib/server/runtime'

export const GET: APIRoute = ({ locals }) => {
  const env = getRuntimeEnv(locals)

  return Response.json({
    features: {
      agents: isEnabled(env.AGENTS_ENABLED),
      tesouro_direto: isEnabled(env.TESOURO_DIRETO_ENABLED),
    },
  })
}