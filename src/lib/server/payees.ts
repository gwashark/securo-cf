import type { D1Database } from './runtime'

export type PayeeRow = {
  id: string
  user_id: string
  workspace_id: string
  name: string
  type: string | null
  source: string
  is_favorite: number
  notes: string | null
  email: string | null
  phone: string | null
  address: string | null
  website: string | null
  created_at: string
  updated_at: string
}

export type PayeeTaxIdRow = {
  id: string
  payee_id: string
  kind: string
  value: string
}

export function serializePayee(row: PayeeRow, taxIds: PayeeTaxIdRow[] = []) {
  return {
    ...row,
    is_favorite: Boolean(row.is_favorite),
    tax_ids: taxIds.map((tid) => ({ kind: tid.kind, value: tid.value })),
    transaction_count: 0,
  }
}

export function serializePayeeSummary(row: PayeeRow, taxIds: PayeeTaxIdRow[] = []) {
  return {
    ...row,
    is_favorite: Boolean(row.is_favorite),
    tax_ids: taxIds.map((tid) => ({ kind: tid.kind, value: tid.value })),
    transaction_count: 0,
  }
}