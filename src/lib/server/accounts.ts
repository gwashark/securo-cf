export type AccountRow = {
  id: string
  user_id: string
  workspace_id: string
  connection_id: string | null
  external_id: string | null
  name: string
  display_name: string | null
  masked_number: string | null
  type: string
  balance: number
  currency: string
  credit_limit: number | null
  statement_close_day: number | null
  payment_due_day: number | null
  minimum_payment: number | null
  card_brand: string | null
  card_level: string | null
  shared_balance_group: string | null
  is_closed: number
  closed_at: string | null
}

export function serializeAccount(row: AccountRow) {
  return {
    id: row.id,
    user_id: row.user_id,
    connection_id: row.connection_id,
    external_id: row.external_id,
    name: row.name,
    display_name: row.display_name,
    masked_number: row.masked_number,
    institution_name: null,
    institution_logo_url: null,
    type: row.type,
    currency: row.currency,
    current_balance: Number(row.balance ?? 0),
    previous_balance: null,
    balance_primary: null,
    credit_limit: row.credit_limit,
    available_credit: row.credit_limit === null ? null : Number(row.credit_limit) + Number(row.balance ?? 0),
    statement_close_day: row.statement_close_day,
    payment_due_day: row.payment_due_day,
    next_close_date: null,
    next_due_date: null,
    minimum_payment: row.minimum_payment,
    card_brand: row.card_brand,
    card_level: row.card_level,
    shared_balance_group: row.shared_balance_group,
    is_closed: Boolean(row.is_closed),
    closed_at: row.closed_at,
  }
}