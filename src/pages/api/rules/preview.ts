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
    await requireWorkspaceRole(db, workspaceId, userId)
    
    const body = await request.json().catch(() => null) as { conditions_op?: string; conditions?: any[]; actions?: any[]; is_active?: boolean; apply_to_existing?: boolean; overwrite_existing_categories?: boolean; limit?: number; offset?: number } | null
    if (!body?.conditions?.length || !body?.actions?.length) return Response.json({ detail: 'Invalid preview request' }, { status: 422 })
    
    const conditionsOp = body.conditions_op ?? 'and'
    const limit = Math.min(Math.max(Number(body?.limit ?? 20), 1), 100)
    const offset = Math.max(Number(body?.offset ?? 0), 0)
    
    const transactions = await db.prepare('SELECT * FROM transactions WHERE workspace_id = ? ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?').bind(workspaceId, limit + offset, offset).all<any>()
    
    let matched = 0
    let willChange = 0
    const sample = []
    
    for (const tx of transactions.results) {
      const matches = matchConditions(tx, body.conditions, body.conditions_op ?? 'and')
      if (matches) {
        matched++
        const currentCategoryId = tx.category_id
        const newCategoryId = body.actions.find((a: any) => a.op === 'set_category')?.value
        const willChangeTx = newCategoryId !== undefined && newCategoryId !== currentCategoryId
        if (willChangeTx) willChange++
        
        if (sample.length < 20) {
          sample.push({
            id: tx.id,
            date: tx.date,
            description: tx.description,
            amount: Number(tx.amount),
            currency: tx.currency,
            type: tx.type,
            current_category_id: tx.category_id,
            current_category_name: null,
            new_category_id: newCategoryId ?? null,
            new_category_name: null,
            will_change: willChangeTx,
          })
        }
      }
    }
    
    return Response.json({
      matched,
      will_change: willChange,
      will_apply: body.apply_to_existing ?? true,
      sample,
      offset: 0,
    })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to preview rule' }, { status: 500 })
  }
}