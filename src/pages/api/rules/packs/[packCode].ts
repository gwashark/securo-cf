import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../../lib/server/workspaces'

const RULE_PACKS = {
  br: {
    name: 'Brazil',
    flag: '🇧🇷',
    rules: [
      { name: 'Uber/99', conditions_op: 'or', conditions: [{ field: 'description', op: 'contains', value: 'UBER' }, { field: 'description', op: 'contains', value: '99POP' }], actions: [{ op: 'set_category', value: 'transport' }], priority: 10, is_active: true },
      { name: 'iFood/Rappi', conditions_op: 'or', conditions: [{ field: 'description', op: 'contains', value: 'IFOOD' }, { field: 'description', op: 'contains', value: 'RAPPI' }], actions: [{ op: 'set_category', value: 'food' }], priority: 10, is_active: true },
      { name: 'Supermarkets', conditions_op: 'or', conditions: [{ field: 'description', op: 'contains', value: 'CARREFOUR' }, { field: 'description', op: 'contains', value: 'EXTRA' }, { field: 'description', op: 'contains', value: 'PAO DE ACUCAR' }], actions: [{ op: 'set_category', value: 'groceries' }], priority: 10, is_active: true },
    ]
  },
  us: {
    name: 'United States',
    flag: '🇺🇸',
    rules: [
      { name: 'Uber/Lyft', conditions_op: 'or', conditions: [{ field: 'description', op: 'contains', value: 'UBER' }, { field: 'description', op: 'contains', value: 'LYFT' }], actions: [{ op: 'set_category', value: 'transport' }], priority: 10, is_active: true },
      { name: 'Amazon', conditions_op: 'contains', conditions: [{ field: 'description', op: 'contains', value: 'AMAZON' }], actions: [{ op: 'set_category', value: 'shopping' }], priority: 10, is_active: true },
      { name: 'Groceries', conditions_op: 'or', conditions: [{ field: 'description', op: 'contains', value: 'WHOLE FOODS' }, { field: 'description', op: 'contains', value: 'TRADER JOE' }], actions: [{ op: 'set_category', value: 'groceries' }], priority: 10, is_active: true },
    ]
  },
  pt: {
    name: 'Portugal',
    flag: '🇵🇹',
    rules: [
      { name: 'Uber/Bolt', conditions_op: 'or', conditions: [{ field: 'description', op: 'contains', value: 'UBER' }, { field: 'description', op: 'contains', value: 'BOLT' }], actions: [{ op: 'set_category', value: 'transport' }], priority: 10, is_active: true },
      { name: 'Supermarkets', conditions_op: 'or', conditions: [{ field: 'description', op: 'contains', value: 'CONTINENTE' }, { field: 'description', op: 'contains', value: 'PINGO DOCE' }], actions: [{ op: 'set_category', value: 'groceries' }], priority: 10, is_active: true },
    ]
  },
}

export const GET: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId)
    
    const packs = Object.entries(RULE_PACKS).map(([code, pack]) => ({
      code,
      name: pack.name,
      flag: pack.flag,
      rule_count: pack.rules.length,
      installed: false,
    }))
    return Response.json(packs)
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load rule packs' }, { status: 500 })
  }
}

export const POST: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspaceId = await resolveWorkspaceId(db, userId, request.headers.get('X-Workspace-Id'))
    if (!workspaceId) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspaceId, userId, 'editor')
    
    const packCode = params.packCode
    const pack = RULE_PACKS[packCode]
    if (!pack) return Response.json({ detail: 'Rule pack not found' }, { status: 404 })
    
    const body = await request.json().catch(() => null) as { create_missing_categories?: boolean } | null
    let installed = 0, unresolved = 0, categories_created = 0
    
    for (const rule of pack.rules) {
      const existing = await db.prepare('SELECT id FROM rules WHERE workspace_id = ? AND name = ?').bind(workspaceId, rule.name).first<{ id: string }>()
      if (existing) continue
      const id = crypto.randomUUID()
      await db.prepare('INSERT INTO rules (id, user_id, workspace_id, name, conditions_op, conditions, actions, priority, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), userId, workspaceId, rule.name, rule.conditions_op, JSON.stringify(rule.conditions), JSON.stringify(rule.actions), rule.priority ?? 10, rule.is_active ?? true ? 1 : 0).run()
      installed++
    }
    
    return Response.json({ installed, unresolved: 0, categories_created: 0 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to install rule pack' }, { status: 400 })
  }
}