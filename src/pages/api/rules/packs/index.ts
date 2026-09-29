import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../../lib/server/runtime'
import { requireWorkspaceRole, resolveWorkspaceId } from '../../../../lib/server/workspaces'

const RULE_PACKS: Record<string, { name: string; flag: string; rules: Array<{ name: string; conditions_op: string; conditions: any[]; actions: any[]; priority: number; is_active: boolean }> }> = {
  'br': {
    name: 'Brazil',
    flag: '🇧🇷',
    rules: [
      { name: 'Uber', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'uber' }], actions: [{ op: 'set_category', value: 'transport' }], priority: 10, is_active: true },
      { name: 'iFood', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'ifood' }], actions: [{ op: 'set_category', value: 'food' }], priority: 10, is_active: true },
      { name: 'Rappi', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'rappi' }], actions: [{ op: 'set_category', value: 'food' }], priority: 10, is_active: true },
      { name: 'Netflix', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'netflix' }], actions: [{ op: 'set_category', value: 'entertainment' }], priority: 10, is_active: true },
      { name: 'Spotify', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'spotify' }], actions: [{ op: 'set_category', value: 'entertainment' }], priority: 10, is_active: true },
      { name: 'Amazon', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'amazon' }], actions: [{ op: 'set_category', value: 'shopping' }], priority: 10, is_active: true },
      { name: 'Mercado Livre', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'mercado livre' }], actions: [{ op: 'set_category', value: 'shopping' }], priority: 10, is_active: true },
      { name: 'Shell', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'shell' }], actions: [{ op: 'set_category', value: 'transport' }], priority: 10, is_active: true },
      { name: 'Ipiranga', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'ipiranga' }], actions: [{ op: 'set_category', value: 'transport' }], priority: 10, is_active: true },
      { name: 'Supermercado', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'supermercado' }], actions: [{ op: 'set_category', value: 'groceries' }], priority: 10, is_active: true },
    ]
  },
  'us': {
    name: 'United States',
    flag: '🇺🇸',
    rules: [
      { name: 'Uber', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'uber' }], actions: [{ op: 'set_category', value: 'transport' }], priority: 10, is_active: true },
      { name: 'Lyft', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'lyft' }], actions: [{ op: 'set_category', value: 'transport' }], priority: 10, is_active: true },
      { name: 'Netflix', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'netflix' }], actions: [{ op: 'set_category', value: 'entertainment' }], priority: 10, is_active: true },
      { name: 'Spotify', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'spotify' }], actions: [{ op: 'set_category', value: 'entertainment' }], priority: 10, is_active: true },
      { name: 'Amazon', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'amazon' }], actions: [{ op: 'set_category', value: 'shopping' }], priority: 10, is_active: true },
      { name: 'Whole Foods', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'whole foods' }], actions: [{ op: 'set_category', value: 'groceries' }], priority: 10, is_active: true },
      { name: 'Starbucks', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'starbucks' }], actions: [{ op: 'set_category', value: 'food' }], priority: 10, is_active: true },
      { name: 'Shell', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'shell' }], actions: [{ op: 'set_category', value: 'transport' }], priority: 10, is_active: true },
      { name: 'Costco', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'costco' }], actions: [{ op: 'set_category', value: 'groceries' }], priority: 10, is_active: true },
      { name: 'Target', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'target' }], actions: [{ op: 'set_category', value: 'shopping' }], priority: 10, is_active: true },
    ]
  },
  'pt': {
    name: 'Portugal',
    flag: '🇵🇹',
    rules: [
      { name: 'Uber', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'uber' }], actions: [{ op: 'set_category', value: 'transport' }], priority: 10, is_active: true },
      { name: 'Bolt', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'bolt' }], actions: [{ op: 'set_category', value: 'transport' }], priority: 10, is_active: true },
      { name: 'Netflix', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'netflix' }], actions: [{ op: 'set_category', value: 'entertainment' }], priority: 10, is_active: true },
      { name: 'Continente', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'continente' }], actions: [{ op: 'set_category', value: 'groceries' }], priority: 10, is_active: true },
      { name: 'Pingo Doce', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'pingo doce' }], actions: [{ op: 'set_category', value: 'groceries' }], priority: 10, is_active: true },
      { name: 'Galp', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'galp' }], actions: [{ op: 'set_category', value: 'transport' }], priority: 10, is_active: true },
      { name: 'Repsol', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'repsol' }], actions: [{ op: 'set_category', value: 'transport' }], priority: 10, is_active: true },
      { name: 'Amazon', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'amazon' }], actions: [{ op: 'set_category', value: 'shopping' }], priority: 10, is_active: true },
      { name: 'Spotify', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'spotify' }], actions: [{ op: 'set_category', value: 'entertainment' }], priority: 10, is_active: true },
      { name: 'Continente Online', conditions_op: 'and', conditions: [{ field: 'description', op: 'contains', value: 'continente online' }], actions: [{ op: 'set_category', value: 'groceries' }], priority: 10, is_active: true },
    ]
  }
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
    
    // Check which packs are installed
    const installedRows = await db.prepare('SELECT pack_code FROM rule_packs WHERE workspace_id = ?').bind(workspaceId).all<{ pack_code: string }>()
    const installed = new Set(installedRows.results.map((r) => r.pack_code))
    
    const packs = Object.entries(RULE_PACKS).map(([code, pack]) => ({
      code,
      name: pack.name,
      flag: pack.flag,
      rule_count: pack.rules.length,
      installed: installed.has(code),
    }))
    
    return Response.json(packs)
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load rule packs' }, { status: 500 })
  }
}