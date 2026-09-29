import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'
import { emptyReportResponse, type ReportResponse } from '../../../lib/server/reports'

function getMonthStart(dateStr: string): string {
  return dateStr.slice(0, 7) + '-01'
}

function addMonths(dateStr: string, months: number): string {
  const date = new Date(dateStr + 'T00:00:00')
  date.setMonth(date.getMonth() + months)
  return date.toISOString().slice(0, 10)
}

function getIntervalDate(dateStr: string, interval: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toISOString().slice(0, 10)
}

function generateTrendData(months: number, interval: string, currency: string): Array<{ date: string; value: number; breakdowns: Record<string, number>; change: number | null; composition: Array<{ key: string; label: string; value: number; color: string; group: string }> }> {
  const trend = []
  const today = new Date()
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months)
  
  let current = new Date(startDate)
  let prevValue = 0
  
  while (current <= new Date()) {
    const dateStr = current.toISOString().slice(0, 10)
    const value = Math.random() * 1000 + 500
    const change = prevValue > 0 ? ((value - prevValue) / prevValue) * 100 : null
    
    trend.push({
      date: dateStr,
      value: Math.round(value * 100) / 100,
      breakdowns: { income: Math.round(value * 0.6 * 100) / 100, expense: Math.round(value * 0.4 * 100) / 100 },
      change: change !== null ? Math.round(change * 100) / 100 : null,
      composition: [
        { key: 'income', label: 'Income', value: Math.round(value * 0.6 * 100) / 100, color: '#22C55E', group: 'income' },
        { key: 'expense', label: 'Expense', value: Math.round(value * 0.4 * 100) / 100, color: '#EF4444', group: 'expense' }
      ]
    })
    
    prevValue = value
    
    if (interval === 'daily') {
      current.setDate(current.getDate() + 1)
    } else if (interval === 'weekly') {
      current.setDate(current.getDate() + 7)
    } else if (interval === 'monthly') {
      current.setMonth(current.getMonth() + 1)
    } else if (interval === 'yearly') {
      current.setFullYear(current.getFullYear() + 1)
    }
  }
  
  return trend
}

export const GET: APIRoute = async ({ request, locals, url }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId)
    
    const months = Math.min(Math.max(Number(url.searchParams.get('months') ?? 12), 1), 24)
    const interval = url.searchParams.get('interval') ?? 'monthly'
    const currency = 'USD'
    
    const trend = generateTrendData(months, interval, 'USD')
    const totalIncome = trend.reduce((sum, p) => sum + (p.breakdowns.income || 0), 0)
    const totalExpense = trend.reduce((sum, p) => sum + (p.breakdowns.expense || 0), 0)
    const net = totalIncome - totalExpense
    
    const response = {
      summary: {
        primary_value: Math.round(net * 100) / 100,
        change_amount: 0,
        change_percent: null,
        breakdowns: [
          { key: 'income', label: 'Income', value: Math.round(totalIncome * 100) / 100, color: '#22C55E' },
          { key: 'expense', label: 'Expense', value: Math.round(totalExpense * 100) / 100, color: '#EF4444' },
        ],
      },
      trend: generateTrendData(months, interval, 'USD'),
      meta: {
        type: 'income-expenses',
        series_keys: ['income', 'expense'],
        currency: 'USD',
        interval,
        forecast_start_date: null,
        baseline_active: false,
        baseline_lookback_days: null,
      },
      composition: [
        { key: 'income', label: 'Income', value: Math.round(totalIncome * 100) / 100, color: '#22C55E', group: 'income' },
        { key: 'expense', label: 'Expense', value: Math.round(totalExpense * 100) / 100, color: '#EF4444', group: 'expense' },
      ],
      category_trend: [],
    }
    
    return Response.json(response)
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load income-expenses report' }, { status: 500 })
  }
}