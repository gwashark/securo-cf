import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../lib/server/workspaces'

export const GET: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.categoryId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const category = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(params.categoryId).first<Record<string, unknown>>()
    if (!category) return Response.json({ detail: 'Category not found' }, { status: 404 })
    await requireWorkspaceRole(db, String(category.workspace_id), userId)
    return Response.json({ ...category, is_system: Boolean(category.is_system), is_hidden: Boolean(category.is_hidden), treat_as_transfer: Boolean(category.treat_as_transfer), is_ignored: Boolean(category.is_ignored) })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to load category' }, { status: 500 })
  }
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.categoryId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const category = await db.prepare('SELECT workspace_id, is_system FROM categories WHERE id = ?').bind(params.categoryId).first<{ workspace_id: string; is_system: number }>()
    if (!category) return Response.json({ detail: 'Category not found' }, { status: 404 })
    await requireWorkspaceRole(db, category.workspace_id, userId, 'editor')
    if (category.is_system) return Response.json({ detail: 'System categories cannot be edited' }, { status: 400 })
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const allowed = ['name', 'icon', 'color', 'group_id', 'treat_as_transfer', 'is_ignored', 'is_hidden'].filter((field) => body && field in body)
    if (!allowed.length) return Response.json({ detail: 'No changes supplied' }, { status: 422 })
    const values = allowed.map((field) => typeof body?.[field] === 'boolean' ? (body[field] ? 1 : 0) : body?.[field])
    await db.prepare(`UPDATE categories SET ${allowed.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`).bind(...values, params.categoryId).run()
    const updated = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(params.categoryId).first<Record<string, unknown>>()
    return updated ? Response.json({ ...updated, is_system: Boolean(updated.is_system), is_hidden: Boolean(updated.is_hidden), treat_as_transfer: Boolean(updated.treat_as_transfer), is_ignored: Boolean(updated.is_ignored) }) : Response.json({ detail: 'Category not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to update category' }, { status: 400 })
  }
}

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId || !params.categoryId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const category = await db.prepare('SELECT workspace_id, is_system FROM categories WHERE id = ?').bind(params.categoryId).first<{ workspace_id: string; is_system: number }>()
    if (!category) return Response.json({ detail: 'Category not found' }, { status: 400 })
    await requireWorkspaceRole(db, category.workspace_id, userId, 'editor')
    if (category.is_system) return Response.json({ detail: 'System categories cannot be deleted' }, { status: 409 })
    await db.prepare('DELETE FROM categories WHERE id = ?').bind(params.categoryId).run()
    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to delete category' }, { status: 400 })
  }
}