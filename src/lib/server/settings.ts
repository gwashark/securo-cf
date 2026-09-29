import type { D1Database } from './runtime'

export const SETTING_VALIDATORS: Record<string, (value: string) => boolean> = {
  registration_enabled: (value) => value === 'true' || value === 'false',
  credit_card_accounting_mode: (value) => value === 'cash' || value === 'accrual',
  use_provider_categories: (value) => value === 'true' || value === 'false',
  number_format: (value) => ['auto', 'comma_dot', 'dot_comma', 'space_comma'].includes(value),
  date_format: (value) => ['auto', 'dmy', 'mdy', 'ymd'].includes(value),
  theme_color_light: (value) => /^#[0-9A-Fa-f]{6}$/.test(value),
  theme_color_dark: (value) => /^#[0-9A-Fa-f]{6}$/.test(value),
}

export const DEFAULT_SETTINGS: Record<string, string> = {
  registration_enabled: 'true',
  credit_card_accounting_mode: 'cash',
  use_provider_categories: 'true',
  number_format: 'auto',
  date_format: 'auto',
}

export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare('SELECT value FROM app_settings WHERE key = ?').bind(key).first<{ value: string }>()
  return row?.value ?? DEFAULT_SETTINGS[key] ?? null
}