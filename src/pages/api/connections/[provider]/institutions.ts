import type { APIRoute } from 'astro'
import { getRuntimeEnv, isEnabled } from '../../../../lib/server/runtime'

export const GET: APIRoute = ({ locals, params }) => {
  if (!isEnabled(getRuntimeEnv(locals).MOCK_BANK_PROVIDER)) return Response.json({ detail: 'No local bank provider is enabled' }, { status: 503 })
  return Response.json({ countries: ['US'], institutions: [{ name: 'local-test-bank', display_name: 'Local Test Bank', country: 'US', logo: null, bic: null, psu_types: [], max_consent_days: null, max_history_days: null }], provider: params.provider })
}