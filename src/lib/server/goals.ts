import type { D1Database } from './runtime'

export type GoalRow = {
  id: string
  user_id: string
  workspace_id: string
  name: string
  target_amount: number
  current_amount: number
  currency: string
  target_date: string | null
  tracking_type: string
  account_id: string | null
  asset_id: string | null
  asset_group_id: string | null
  status: string
  icon: string | null
  color: string | null
  position: number
  metadata_json: string | null
  created_at: string
  updated_at: string
}

export function serializeGoal(row: GoalRow) {
  const targetAmount = Number(row.target_amount)
  const currentAmount = Number(row.current_amount)
  const percentage = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0
  return {
    ...row,
    target_amount: targetAmount,
    current_amount: currentAmount,
    target_amount_primary: null,
    current_amount_primary: null,
    percentage,
    monthly_contribution: null,
    on_track: null,
    account_name: null,
    asset_name: null,
    asset_group_name: null,
  }
}

export type GoalSummaryRow = {
  id: string
  name: string
  target_amount: number
  current_amount: number
  currency: string
  target_date: string | null
  status: string
  icon: string | null
  color: string | null
  percentage: number
  monthly_contribution: number | null
  on_track: string | null
}

export function serializeGoalSummary(row: GoalSummaryRow) {
  return {
    ...row,
    target_amount: Number(row.target_amount),
    current_amount: Number(row.current_amount),
    percentage: Number(row.percentage),
    monthly_contribution: row.monthly_contribution === null ? null : Number(row.monthly_contribution),
    on_track: row.on_track,
  }
}