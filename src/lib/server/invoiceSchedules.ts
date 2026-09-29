import type { D1Database } from './runtime'

export type InvoiceScheduleRow = {
  id: string
  user_id: string
  workspace_id: string
  payee_id: string | null
  payee_name: string | null
  payee_email: string | null
  payee_address: string | null
  payee_tax_id: string | null
  name: string
  description: string | null
  frequency: string
  weekend_adjustment: string
  day_of_month: number | null
  start_date: string
  end_date: string | null
  status: string
  next_sequence: number
  currency: string
  lines: string
  discount: number
  notes: string | null
  metadata_json: string | null
  created_at: string
  updated_at: string
  ended_at: string | null
  ended_reason: string | null
}

export type InvoiceScheduleTermRow = {
  id: string
  schedule_id: string
  effective_from: string
  lines: string
  discount: number
  created_at: string
}

export function serializeInvoiceSchedule(row: InvoiceScheduleRow, terms: InvoiceScheduleTermRow[] = []) {
  return {
    ...row,
    lines: JSON.parse(row.lines || '[]'),
    discount: Number(row.discount),
    terms: terms.map((t) => ({
      ...t,
      lines: JSON.parse(t.lines || '[]'),
      discount: Number(t.discount),
    })),
  }
}