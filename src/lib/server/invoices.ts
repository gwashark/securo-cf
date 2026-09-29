import type { D1Database } from './runtime'

export type InvoiceRow = {
  id: string
  user_id: string
  workspace_id: string
  direction: string
  state: string
  number: string | null
  series: string | null
  issue_date: string
  due_date: string | null
  currency: string
  exchange_rate: number | null
  payee_id: string | null
  payee_name: string | null
  payee_email: string | null
  payee_address: string | null
  payee_tax_id: string | null
  issuer_name: string | null
  issuer_address: string | null
  issuer_tax_id: string | null
  issuer_tax_jurisdiction: string | null
  lines: string
  subtotal: number
  tax_amount: number
  total_amount: number
  amount_paid: number
  amount_deducted: number
  balance: number
  status: string
  origin: string
  schedule_id: string | null
  installments: string
  deductions: string
  allocations: string
  notes: string | null
  metadata_json: string | null
  created_at: string
  updated_at: string
  issued_at: string | null
  voided_at: string | null
  paid_at: string | null
}

export type InvoiceAttachmentRow = {
  id: string
  invoice_id: string
  filename: string
  content_type: string
  size: number
  kind: string
  document_number: string | null
  issued_at: string | null
  is_primary: number
  created_at: string
}

export type InvoiceSettingsRow = {
  workspace_id: string
  default_payment_terms: number
  default_currency: string
  default_tax_jurisdiction: string | null
  logo_id: string | null
  logo_content_type: string | null
  logo_data: string | null
  next_number_receivable: number
  next_number_payable: number
  numbering_format: string
  default_payment_terms_receivable: number
  default_payment_terms_payable: number
  auto_issue_on_create: number
  require_approval: number
  allow_partial_payment: number
  default_tax_jurisdiction: string | null
  created_at: string
  updated_at: string
}

export type InvoiceIssuerTaxIdRow = {
  id: string
  workspace_id: string
  kind: string
  value: string
  created_at: string
}

export function serializeInvoice(row: InvoiceRow) {
  return {
    ...row,
    lines: JSON.parse(row.lines || '[]'),
    installments: JSON.parse(row.installments || '[]'),
    deductions: JSON.parse(row.deductions || '[]'),
    allocations: JSON.parse(row.allocations || '[]'),
    metadata_json: row.metadata_json ? JSON.parse(row.metadata_json) : null,
    subtotal: Number(row.subtotal),
    tax_amount: Number(row.tax_amount),
    total_amount: Number(row.total_amount),
    amount_paid: Number(row.amount_paid),
    amount_deducted: Number(row.amount_deducted),
    balance: Number(row.balance),
  }
}

export function serializeInvoiceAttachment(row: InvoiceAttachmentRow) {
  return {
    ...row,
    size: Number(row.size),
    is_primary: Boolean(row.is_primary),
  }
}

export function serializeInvoiceSettings(row: InvoiceSettingsRow) {
  return {
    ...row,
    default_payment_terms: Number(row.default_payment_terms),
    next_number_receivable: Number(row.next_number_receivable),
    next_number_payable: Number(row.next_number_payable),
    auto_issue_on_create: Boolean(row.auto_issue_on_create),
    require_approval: Boolean(row.require_approval),
    allow_partial_payment: Boolean(row.allow_partial_payment),
    default_payment_terms_receivable: Number(row.default_payment_terms_receivable),
    default_payment_terms_payable: Number(row.default_payment_terms_payable),
  }
}