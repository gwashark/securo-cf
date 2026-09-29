export const KNOWN_PROVIDERS = [
  { name: 'pluggy', display_name: 'Pluggy', description: 'Open finance provider for Brazilian banks', flow_type: 'widget', requires_institution_select: false, supports_asset_sync: true },
  { name: 'enable_banking', display_name: 'Enable Banking', description: 'European banks via PSD2 open banking', flow_type: 'oauth', requires_institution_select: true, supports_asset_sync: false },
  { name: 'simplefin', display_name: 'SimpleFIN', description: 'US and international banks via SimpleFIN Bridge', flow_type: 'token', requires_institution_select: false, supports_asset_sync: true },
]

export function providerCatalog(mockEnabled: boolean) {
  return KNOWN_PROVIDERS.map((provider) => ({ ...provider, configured: mockEnabled }))
}

export type ConnectionRow = {
  id: string
  user_id: string
  provider: string
  external_id: string
  institution_name: string
  display_name: string | null
  logo_url: string | null
  settings: string
  status: string
  last_sync_at: string | null
  created_at: string
}

export function serializeConnection(row: ConnectionRow) {
  return { ...row, settings: JSON.parse(row.settings || '{}'), institutions: [] }
}