import type { D1Database } from './runtime'

export type RuleRow = {
  id: string
  user_id: string
  workspace_id: string
  name: string
  conditions_op: string
  conditions: string
  actions: string
  priority: number
  is_active: number
  created_at: string
  updated_at: string
}

export function serializeRule(row: RuleRow) {
  return {
    ...row,
    conditions: JSON.parse(row.conditions || '[]'),
    actions: JSON.parse(row.actions || '[]'),
    is_active: Boolean(row.is_active),
  }
}