import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../lib/server/workspaces'

function matchCondition(transaction: any, condition: any): boolean {
  const field = condition.field
  const op = condition.op
  const value = condition.value
  const txValue = transaction[field]
  
  if (txValue === null || txValue === undefined) return false
  
  switch (op) {
    case 'contains':
      return String(txValue).toLowerCase().includes(String(value).toLowerCase())
    case 'not_contains':
      return !String(txValue).toLowerCase().includes(String(value).toLowerCase())
    case 'equals':
      return String(txValue) === String(value)
    case 'not_equals':
      return String(txValue) !== String(value)
    case 'starts_with':
      return String(txValue).toLowerCase().startsWith(String(value).toLowerCase())
    case 'ends_with':
      return String(txValue).toLowerCase().endsWith(String(value).toLowerCase())
    case 'gt':
      return Number(txValue) > Number(value)
    case 'gte':
      return Number(txValue) >= Number(value)
    case 'lt':
      return Number(txValue) < Number(value)
    case 'lte':
      return Number(txValue) <= Number(value)
    default:
      return false
  }
}

function matchConditions(transaction: any, conditions: any[], op: string): boolean {
  if (!conditions.length) return false
  const results = conditions.map((c) => matchCondition(transaction, c))
  return op === 'and' ? results.every(Boolean) : results.some(Boolean)
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId, 'editor')
    
    const rules = await db.prepare('SELECT * FROM rules WHERE workspace_id = ? AND is_active = 1 ORDER BY priority').bind(workspaceId).all<any>()
    
    let applied = 0
    const transactions = await db.prepare('SELECT * FROM transactions WHERE workspace_id = ?').bind(workspaceId).all<any>()
    
    for (const tx of transactions.results) {
      for (const rule of rules.results) {
        const conditions = JSON.parse(rule.conditions || '[]')
        const actions = JSON.parse(rule.actions || '[]')
        const conditionsOp = rule.conditions_op || 'and'
        
        const matches = matchConditions(tx, conditions, rule.conditions_op || 'and')
        if (matches) {
          for (const action of actions) {
            if (action.op === 'set_category' && action.value !== tx.category_id) {
              await db.prepare('UPDATE transactions SET category_id = ? WHERE id = ?').bind(action.value, tx.id).run()
              applied++
              break
            }
          }
        }
      }
    }
    
    return Response.json({ applied })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to apply rules' }, { status: 500 })
  }
}