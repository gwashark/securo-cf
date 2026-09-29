import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'

function generateCashFlowTrend(months: number, interval: string): Array<{ date: string; value: number; breakdowns: Record<string, number>; change: number | null; composition: Array<{ key: string; label: string; value: number; color: string; group: string }> }> {
  const trend = []
  const today = new Date()
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months)
  
  let current = new Date(startDate)
  let prevValue = 0
  
  while (current <= new Date()) {
    const dateStr = current.toISOString().slice(0, 10)
    const value = (Math.random() - 0.3) * 2000
    const change = prevValue !== 0 ? ((value - prevValue) / Math.abs(prevValue)) * 100 : null
    
    trend.push({
      date: current.toISOString().slice(0, 10),
      value: Math.round(value * 100) / 100,
      breakdowns: { inflow: Math.max(0, value), outflow: Math.min(0, value) },
      change: change !== null ? Math.round(change * 100) / 100 : null,
      composition: [
        { key: 'inflow', label: 'Inflow', value: Math.max(0, Math.round(value * 100) / 100), color: '#22C55E', group: 'inflow' },
        { key: 'outflow', label: 'Outflow', value: Math.min(0, Math.round(value * 100) / 100), color: '#EF4444', group: 'outflow' }
      ]
    })
    
    prevValue = value
    
    if (interval === 'daily') {
      current.setDate(current.getDate() + 1)
    } else if (interval === 'weekly') {
      current.setDate(current.getDate() + 7)
    } else if (interval === 'monthly') {
      current.setMonth(current.getMonth() + 1)
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
    
    const months = Math.min(Math.max(Number(url.searchParams.get('months') ?? 6), 1), 12)
    const interval = url.searchParams.get('interval') ?? 'daily'
    const baseline = url.searchParams.get('baseline') === 'true'
    
    const trend = generateCashFlowTrend(months, interval)
    const totalInflow = trend.reduce((sum, p) => sum + Math.max(0, p.value), 0)
    const totalOutflow = trend.reduce((sum, p) => sum + Math.min(0, p.value), 0)
    const net = totalInflow + totalOutflow
    
    const response = {
      summary: {
        primary_value: Math.round(net * 100) / 100,
        change_amount: 0,
        change_percent: null,
        breakdowns: [
          { key: 'inflow', label: 'Inflow', value: Math.round(totalInflow * 100) / 100, color: '#22C55E' },
          { key: 'outflow', label: 'Outflow', value: Math.round(totalOutflow * 100) / 100, color: '#EF4444' },
        ],
      },
      trend: generateCashFlowTrend(months, interval),
      meta: {
        type: 'cash-flow',
        series_keys: ['inflow', 'outflow'],
        currency: 'USD',
        interval,
        forecast_start_date: null,
        baseline_active: baseline,
        baseline_lookback_days: baseline ? 30 : null,
      },
      composition: [
        { key: 'inflow', label: 'Inflow', value: Math.round(totalInflow * 100) / 100, color: '#22C55E', group: 'inflow' },
        { key: 'outflow', label: 'Outflow', value: Math.round(totalOutflow * 100) / 100, color: '#EF4444', group: 'outflow' },
      ],
      category_trend: [],
    }
    
    return Response.json(response)
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load cash flow report' }, { status: 500 })
  }
}