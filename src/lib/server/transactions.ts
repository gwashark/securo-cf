export type TransactionRow = {
  id: string
  user_id: string
  workspace_id: string
  account_id: string
  category_id: string | null
  external_id: string | null
  description: string
  original_description: string | null
  amount: number
  currency: string
  date: string
  type: 'debit' | 'credit'
  source: string
  status: 'posted' | 'pending'
  payee: string | null
  payee_id: string | null
  notes: string | null
  transfer_pair_id: string | null
  amount_primary: number | null
  fx_rate_used: number | null
  installment_number: number | null
  total_installments: number | null
  installment_total_amount: number | null
  installment_purchase_date: string | null
  effective_bill_date: string | null
  bill_id: string | null
  is_ignored: number
  exclude_from_pnl: number
}

export type TransactionSplitRow = {
  id: string
  transaction_id: string
  group_member_id: string
  share_amount: number
  share_type: string
  share_pct: number | null
  notes: string | null
  created_at: string
}

export function serializeTransaction(row: TransactionRow, category?: Record<string, unknown> | null, splits: TransactionSplitRow[] = []) {
  return {
    ...row,
    category: category ?? null,
    amount: Number(row.amount),
    amount_primary: row.amount_primary === null ? null : Number(row.amount_primary),
    fx_rate_used: row.fx_rate_used === null ? null : Number(row.fx_rate_used),
    installment_total_amount: row.installment_total_amount === null ? null : Number(row.installment_total_amount),
    is_ignored: Boolean(row.is_ignored),
    exclude_from_pnl: Boolean(row.exclude_from_pnl),
    fx_fallback: false,
    splits: splits.map((split) => ({ ...split, share_amount: Number(split.share_amount), share_pct: split.share_pct === null ? null : Number(split.share_pct) })),
    attachment_count: 0,
  }
}

export function normalizeSplits(
  entries: Array<{ group_member_id: string; share_amount?: number; share_pct?: number; notes?: string }>,
  shareType: 'equal' | 'exact' | 'percent',
  amount: number,
) {
  if (!entries.length || !amount) throw new Error('Splits require members and a positive transaction amount')
  if (shareType === 'exact' && Math.abs(entries.reduce((sum, entry) => sum + Number(entry.share_amount ?? 0), 0) - amount) > 0.005) throw new Error('Exact split amounts must equal the transaction amount')
  if (shareType === 'percent' && Math.abs(entries.reduce((sum, entry) => sum + Number(entry.share_pct ?? 0), 0) - 100) > 0.005) throw new Error('Split percentages must equal 100')
  return entries.map((entry) => ({
    group_member_id: entry.group_member_id,
    share_amount: shareType === 'equal' ? amount / entries.length : shareType === 'percent' ? amount * Number(entry.share_pct ?? 0) / 100 : Number(entry.share_amount ?? 0),
    share_pct: shareType === 'percent' ? Number(entry.share_pct ?? 0) : null,
    notes: entry.notes ?? null,
  }))
}

export function balanceDelta(type: string, amount: number): number {
  return type === 'credit' ? amount : -amount
}