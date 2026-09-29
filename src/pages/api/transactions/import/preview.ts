import type { APIRoute } from 'astro'
import { authenticatedUserId } from '../../../../lib/server/auth'
import { getRuntimeEnv, requireDatabase } from '../../../../lib/server/runtime'
import { requireWorkspaceRole } from '../../../../lib/server/workspaces'

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []; let cell = ''; let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"' && text[index + 1] === '"' && quoted) { cell += '"'; index += 1 }
    else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[index + 1] === '\n') index += 1; row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = '' }
    else cell += char
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals)
  const userId = await authenticatedUserId(request, env)
  if (!userId) return Response.json({ detail: 'Unauthorized' }, { status: 401 })
  try {
    const db = requireDatabase(env)
    const workspace = await db.prepare('SELECT w.id FROM workspaces w INNER JOIN workspace_members wm ON wm.workspace_id = w.id WHERE wm.user_id = ? AND w.is_archived = 0 ORDER BY w.created_at LIMIT 1').bind(userId).first<{ id: string }>()
    if (!workspace) return Response.json({ detail: 'Workspace not found' }, { status: 404 })
    await requireWorkspaceRole(db, workspace.id, userId)
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return Response.json({ detail: 'CSV file is required' }, { status: 422 })
    const rows = parseCsv(await file.text())
    if (!rows.length) return Response.json({ transactions: [], detected_format: 'csv', csv_columns: [] })
    const headers = rows[0].map((header) => header.trim().toLowerCase())
    const transactions = rows.slice(1).map((row) => {
      const value = (key: string) => row[headers.indexOf(key)]?.trim() ?? ''
      const amount = Number(value('amount'))
      const explicitType = value('type')
      return { description: value('description'), amount: Math.abs(amount), date: value('date'), type: explicitType === 'credit' || explicitType === 'debit' ? explicitType : amount >= 0 ? 'credit' : 'debit', currency: value('currency') || null, external_id: value('external_id') || null, payee_raw: value('payee') || null, notes: value('notes') || null }
    }).filter((transaction) => transaction.description && transaction.date && transaction.amount > 0)
    return Response.json({ transactions, detected_format: 'csv', csv_columns: headers, failed_rows: [] })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ detail: 'Unable to preview CSV' }, { status: 400 })
  }
}