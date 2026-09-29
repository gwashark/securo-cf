import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'

function generateNetWorthTrend(months: number, interval: string): Array<{ date: string; value: number; breakdowns: Record<string, number>; change: number | null; composition: Array<{ key: string; label: string; value: number; color: string; group: string }> }> {
  const trend = []
  const today = new Date()
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months)
  
  let current = new Date()
  current.setMonth(current.getMonth() - months)
  let prevValue = 0
  
  while (current <= new Date()) {
    const dateStr = current.toISOString().slice(0, 10)
    const value = 50000 + Math.random() * 50000
    const change = prevValue > 0 ? ((value - prevValue) / prevValue) * 100 : null
    
    trend.push({
      date: current.toISOString().slice(0, 10),
      value: Math.round(value * 100) / 100,
      breakdowns: { assets: Math.round(value * 0.7 * 100) / 100, liabilities: Math.round(value * 0.3 * 100) / 100 },
      change: change !== null ? Math.round(change * 100) / 100 : null,
      composition: [
        { key: 'assets', label: 'Assets', value: Math.round(value * 0.7 * 100) / 100, color: '#22C55E', group: 'assets' },
        { key: 'liabilities', label: 'Liabilities', value: Math.round(value * 0.3 * 100) / 100, color: '#EF4444', group: 'liabilities' }
      ]
    })
    
    prevValue = value
    current.setMonth(current.getMonth() + 1)
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
    
    const trend = generateNetWorthTrend(months, interval)
    const latest = trend[trend.length - 1]
    const netWorth = latest?.value || 0
    const assets = latest?.breakdowns.assets || 0
    const liabilities = latest?.breakdowns.liabilities || 0
    
    const response = {
      summary: {
        primary_value: Math.round(netWorth * 100) / 100,
        change_amount: 0,
        change_percent: null,
        breakdowns: [
          { key: 'assets', label: 'Assets', value: Math.round(assets * 100) / 100, color: '#22C55E' },
          { key: 'liabilities', label: 'Liabilities', value: Math.round(liabilities * 100) / 100, color: '#EF4444' },
        ],
      },
      trend: generateNetWorthTrend(months, interval),
      meta: {
        type: 'net-worth',
        series_keys: ['assets', 'liabilities'],
        currency: 'USD',
        interval: 'monthly',
        forecast_start_date: null,
        baseline_active: false,
        baseline_lookback_days: null,
      },
      composition: [
        { key: 'assets', label: 'Assets', value: Math.round(assets * 100) / 100, color: '#22C55E', group: 'assets' },
        { key: 'liabilities', label: 'Liabilities', value: Math.round(liabilities * 100) / 100, color: '#EF4444', group: 'liabilities' },
      ],
      category_trend: [],
    }
    
    return Response.json(response)
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load net worth report' }, { status: 500 })
  }
}