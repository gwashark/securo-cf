import type { APIRoute } from 'astro'
import { providerCatalog } from '../../../lib/server/connections'
import { getRuntimeEnv, isEnabled } from '../../../lib/server/runtime'

export const GET: APIRoute = ({ locals }) => Response.json({
  providers: providerCatalog(isEnabled(getRuntimeEnv(locals).MOCK_BANK_PROVIDER)),
})