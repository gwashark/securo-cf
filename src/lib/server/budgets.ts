import type { D1Database } from './runtime'

export type BudgetRow = {
  id: string
  user_id: string
  workspace_id: string
  category_id: string
  amount: number
  month: string
  is_recurring: number
  created_at: string
}

export function serializeBudget(row: BudgetRow) {
  return { ...row, amount: Number(row.amount), is_recurring: Boolean(row.is_recurring) }
}

export type BudgetVsActualRow = {
  category_id: string
  category_name: string
  category_icon: string
  category_color: string
  group_id: string | null
  group_name: string | null
  budget_amount: number | null
  actual_amount: number
  projected_amount: number
  prev_month_amount: number
  projected_prev_month_amount: number
  percentage_used: number | null
  is_recurring: number
}

export function serializeBudgetVsActual(row: BudgetVsActualRow) {
  return {
    ...row,
    budget_amount: row.budget_amount === null ? null : Number(row.budget_amount),
    actual_amount: Number(row.actual_amount),
    projected_amount: Number(row.projected_amount),
    prev_month_amount: Number(row.prev_month_amount),
    projected_prev_month_amount: Number(row.projected_prev_month_amount),
    percentage_used: row.percentage_used === null ? null : Number(row.percentage_used),
    is_recurring: Boolean(row.is_recurring),
  }
}