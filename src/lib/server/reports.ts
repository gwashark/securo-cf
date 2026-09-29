import type { D1Database } from './runtime'

export type ReportSnapshotRow = {
  id: string
  workspace_id: string
  report_type: string
  period: string
  interval: string
  data: string
  created_at: string
}

export type ReportBreakdown = {
  key: string
  label: string
  value: number
  color: string
}

export type ReportSummary = {
  primary_value: number
  change_amount: number
  change_percent: number | null
  breakdowns: ReportBreakdown[]
}

export type ReportCompositionItem = {
  key: string
  label: string
  value: number
  color: string
  group: string
}

export type ReportDataPoint = {
  date: string
  value: number
  breakdowns: Record<string, number>
  change: number | null
  composition: Array<{ key: string; label: string; value: number; color: string; group: string }>
}

export type ReportMeta = {
  type: string
  series_keys: string[]
  currency: string
  interval: string
  forecast_start_date: string | null
  baseline_active: boolean
  baseline_lookback_days: number | null
}

export type CategoryTrendItem = {
  key: string
  label: string
  color: string
  total: number
  group: string
  series: Array<{ date: string; value: number; breakdowns: Record<string, number>; change: number | null; composition: Array<{ key: string; label: string; value: number; color: string; group: string }> }>
}

export type ReportResponse = {
  summary: {
    primary_value: number
    change_amount: number
    change_percent: number | null
    breakdowns: Array<{ key: string; label: string; value: number; color: string }>
  }
  trend: Array<{ date: string; value: number; breakdowns: Record<string, number>; change: number | null; composition: Array<{ key: string; label: string; value: number; color: string; group: string }> }>
  meta: {
    type: string
    series_keys: string[]
    currency: string
    interval: string
    forecast_start_date: string | null
    baseline_active: boolean
    baseline_lookback_days: number | null
  }
  composition: Array<{ key: string; label: string; value: number; color: string; group: string }>
  category_trend: Array<{ key: string; label: string; color: string; total: number; group: string; series: Array<{ date: string; value: number; breakdowns: Record<string, number>; change: number | null; composition: Array<{ key: string; label: string; value: number; color: string; group: string }> }> }>
}

export function emptyReportResponse(type: string, currency: string, interval: string): ReportResponse {
  return {
    summary: { primary_value: 0, change_amount: 0, change_percent: null, breakdowns: [] },
    trend: [],
    meta: { type, series_keys: [], currency, interval, forecast_start_date: null, baseline_active: false, baseline_lookback_days: null },
    composition: [],
    category_trend: [],
  }
}