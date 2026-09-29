import type { D1Database } from './runtime'

export type RecurringTransactionRow = {
  id: string
  user_id: string
  workspace_id: string
  account_id: string
  category_id: string | null
  description: string
  amount: number
  currency: string
  type: string
  frequency: string
  weekend_adjustment: string
  day_of_month: number | null
  start_date: string
  end_date: string | null
  is_active: number
  auto_generate: number
  next_occurrence: string
  created_at: string
  updated_at: string
}

export function serializeRecurringTransaction(row: RecurringTransactionRow) {
  return {
    ...row,
    amount: Number(row.amount),
    is_active: Boolean(row.is_active),
    auto_generate: Boolean(row.auto_generate),
    amount_primary: null,
    fx_rate_used: null,
  }
}