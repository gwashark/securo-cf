import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
import { useDateLocale, useDisplayLocale } from '../hooks/use-display-locale.js';
import { formatCurrency } from '../lib/format.js';
/**
 * The invoice as a document.
 *
 * Deliberately not a Securo card. This is the artifact the client
 * receives: a sheet of paper, presented on a recessed surface so it
 * reads as paper on a desk rather than as a panel that forgot the
 * theme. It is light in both themes because the printed thing is light
 * in both themes, and the inset around it is what makes that a decision
 * instead of a bug.
 *
 * A deliberate mirror of `services/invoice_pdf.py`: same blocks, same
 * order, same labels. It recomputes nothing — every value was resolved
 * by the server into one structure both renderers read, so the preview
 * and the file cannot drift apart into two opinions.
 *
 * Labels come from the document rather than from i18n. That reads
 * backwards until you remember whose document it is: the sender chose
 * these words, possibly in their client's language, and translating
 * them into the *viewer's* language would rewrite someone else's
 * invoice. The chrome around the sheet stays translated; the sheet
 * does not.
 */
/** Ink, fixed. The sheet does not follow the app theme, so its colours
 *  cannot come from theme tokens. */
const INK = '#18181b';
const MUTED = '#71717a';
const RULE = '#e4e4e7';
/**
 * A4 at 96dpi, and the same 18mm margin the PDF renderer uses.
 *
 * The point is proportion, not pixel-accuracy: a sheet that is merely
 * "a wide card" reads as a web page, and the whole reason to preview a
 * document is to see the shape of the thing the client will hold. The
 * page keeps its full height even when the invoice is two lines long,
 * because that is what a real page does.
 */
const SHEET_WIDTH = 794;
const SHEET_HEIGHT = 1123;
const SHEET_MARGIN = 68;
function Party({ title, name, legalName, address, email, taxIds, }) {
    return (_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "text-[10px] font-semibold uppercase tracking-[0.14em]", style: { color: MUTED }, children: title }), name && (_jsx("div", { className: "mt-1.5 text-[15px] font-semibold leading-snug break-words", children: name })), legalName && legalName !== name && (_jsx("div", { className: "text-[13px] leading-relaxed break-words", style: { color: MUTED }, children: legalName })), taxIds.map((doc) => (_jsxs("div", { className: "text-[13px] leading-relaxed tabular-nums", style: { color: MUTED }, children: [doc.label, " ", doc.value] }, `${doc.label}-${doc.value}`))), address && (_jsx("div", { className: "text-[13px] leading-relaxed whitespace-pre-line break-words", style: { color: MUTED }, children: address })), email && (_jsx("div", { className: "text-[13px] leading-relaxed break-all", style: { color: MUTED }, children: email }))] }));
}
function Field({ label, value }) {
    return (_jsxs("div", { children: [_jsx("div", { className: "text-[10px] font-semibold uppercase tracking-[0.14em]", style: { color: MUTED }, children: label }), _jsx("div", { className: "mt-0.5 text-[13px] tabular-nums", children: value })] }));
}
export function InvoiceDocumentView({ document }) {
    const { t } = useTranslation();
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const L = document.labels;
    const accent = document.accent_color;
    const hasPaid = Number(document.amount_paid) > 0;
    const hasDeducted = Number(document.amount_deducted ?? 0) > 0;
    const money = (value) => formatCurrency(Number(value), document.currency, locale);
    const showDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(dateLocale);
    const totals = [];
    if (document.lines.length > 0) {
        totals.push({ label: L.subtotal, value: money(document.subtotal) });
    }
    if (Number(document.discount) > 0) {
        totals.push({ label: L.discount, value: `-${money(document.discount)}` });
    }
    if (Number(document.tax_total) > 0) {
        totals.push({ label: L.tax, value: money(document.tax_total) });
    }
    totals.push({ label: L.total, value: money(document.total), strong: true });
    // Paid and balance only once something has settled: on an untouched
    // invoice they restate the total twice and add nothing. Deductions get
    // their own row, or total, paid and balance would not add up.
    if (hasPaid || hasDeducted) {
        if (hasPaid)
            totals.push({ label: L.paid, value: money(document.amount_paid) });
        if (hasDeducted)
            totals.push({ label: L.deducted, value: money(document.amount_deducted) });
        totals.push({ label: L.balance, value: money(document.balance), strong: true });
    }
    const received = document.direction === 'payable';
    return (_jsxs("div", { className: "rounded-xl border border-border bg-muted/50 p-3 sm:p-8 overflow-x-auto", children: [received && (_jsxs("div", { className: "mx-auto mb-3 max-w-[794px] text-xs text-muted-foreground", "data-testid": "document-received-note", children: [_jsx("span", { className: "font-medium text-foreground", children: t('invoices.receivedDocument') }), ' ', t('invoices.receivedDocumentHint')] })), _jsxs("div", { "data-testid": "invoice-document", className: "mx-auto flex flex-col rounded-sm bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08),0_12px_32px_-10px_rgba(0,0,0,0.22)]", style: {
                    color: INK,
                    width: '100%',
                    maxWidth: SHEET_WIDTH,
                    // Full page height from the small breakpoint up. On a phone a
                    // sheet taller than the screen is theatre, so it collapses to
                    // its content there.
                    minHeight: `min(${SHEET_HEIGHT}px, 141.4vw)`,
                    padding: `clamp(28px, 8.5vw, ${SHEET_MARGIN}px)`,
                }, children: [_jsxs("header", { className: "flex flex-wrap items-start justify-between gap-4", children: [_jsxs("div", { className: "flex items-center gap-3 min-w-0", children: [document.logo_url && (_jsx("img", { src: document.logo_url, alt: "", className: "h-9 w-auto max-w-[132px] object-contain", "data-testid": "document-logo" })), _jsx("h2", { className: "text-[26px] font-bold tracking-tight leading-none", children: L.invoice })] }), document.number && (_jsx("div", { className: "text-[17px] font-bold tabular-nums leading-none pt-1", style: { color: accent }, "data-testid": "document-number", children: document.number }))] }), _jsx("div", { className: "mt-4 h-[2px] rounded-full", style: { backgroundColor: accent } }), _jsxs("div", { className: "mt-8 grid gap-8 sm:grid-cols-2", children: [_jsx(Party, { title: L.from, name: document.issuer.name, legalName: document.issuer.legal_name, address: document.issuer.address, taxIds: document.issuer.tax_ids }), _jsx(Party, { title: L.billTo, name: document.client.name, address: document.client.address, email: document.client.email, taxIds: document.client.tax_ids })] }), _jsxs("div", { className: "mt-8 flex flex-wrap gap-x-12 gap-y-4", children: [_jsx(Field, { label: L.issueDate, value: showDate(document.issue_date) }), _jsx(Field, { label: L.dueDate, value: showDate(document.due_date) }), document.custom_fields.map((field) => (_jsx(Field, { label: field.label, value: field.value }, field.label)))] }), document.installments.length > 0 && (_jsxs("div", { className: "mt-6", "data-testid": "document-installments", children: [_jsx("div", { className: "text-[10px] font-semibold uppercase tracking-[0.14em]", style: { color: MUTED }, children: L.schedule }), _jsx("table", { className: "mt-1.5 w-full text-sm", children: _jsx("tbody", { children: document.installments.map((row, index) => (_jsxs("tr", { style: { borderBottom: `1px solid ${RULE}` }, children: [_jsx("td", { className: "py-1.5 pr-4", children: row.label ?? `${index + 1}/${document.installments.length}` }), _jsx("td", { className: "py-1.5 pr-4 tabular-nums", style: { color: MUTED }, children: showDate(row.due_date) }), _jsx("td", { className: "py-1.5 text-right tabular-nums", children: money(row.amount) })] }, index))) }) })] })), document.lines.length > 0 ? (_jsxs("table", { className: "mt-9 w-full", children: [_jsx("thead", { children: _jsxs("tr", { style: { borderBottom: `1px solid ${RULE}` }, children: [_jsx("th", { className: "pb-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em]", style: { color: MUTED }, children: L.description }), _jsx("th", { className: "pb-2 text-right text-[10px] font-semibold uppercase tracking-[0.14em] w-20", style: { color: MUTED }, children: L.quantity }), _jsx("th", { className: "pb-2 text-right text-[10px] font-semibold uppercase tracking-[0.14em] w-28", style: { color: MUTED }, children: L.unitPrice }), _jsx("th", { className: "pb-2 text-right text-[10px] font-semibold uppercase tracking-[0.14em] w-28", style: { color: MUTED }, children: L.amount })] }) }), _jsx("tbody", { children: document.lines.map((line, index) => (_jsxs("tr", { style: { borderBottom: `1px solid ${RULE}` }, children: [_jsx("td", { className: "py-3 pr-4 text-[13.5px] leading-snug", children: line.description }), _jsxs("td", { className: "py-3 text-right text-[13.5px] tabular-nums", children: [Number(line.quantity), line.unit ? ` ${line.unit}` : ''] }), _jsx("td", { className: "py-3 text-right text-[13.5px] tabular-nums", children: money(line.unit_price) }), _jsx("td", { className: "py-3 text-right text-[13.5px] tabular-nums", children: money(line.total) })] }, index))) })] })) : (_jsx("p", { className: "mt-9 text-[13px] leading-relaxed", style: { color: MUTED }, "data-testid": "document-no-lines", children: t('invoices.document.noLines') })), _jsx("div", { className: "mt-7 flex justify-end", children: _jsx("dl", { className: "w-full max-w-[300px]", children: totals.map((row) => (_jsxs("div", { className: "flex items-baseline justify-between gap-8 py-1.5", style: row.strong ? { borderTop: `1px solid ${RULE}` } : undefined, children: [_jsx("dt", { className: row.strong ? 'text-[13px] font-semibold' : 'text-[13px]', style: row.strong ? undefined : { color: MUTED }, children: row.label }), _jsx("dd", { className: "text-[13.5px] tabular-nums", style: row.strong ? { color: accent, fontWeight: 700, fontSize: '15px' } : undefined, children: row.value })] }, row.label))) }) }), _jsxs("div", { className: "mt-auto pt-10", children: [(document.payment_details || document.notes) && (_jsxs("div", { className: "grid gap-6 sm:grid-cols-2", children: [document.payment_details && (_jsxs("div", { children: [_jsx("div", { className: "text-[10px] font-semibold uppercase tracking-[0.14em]", style: { color: MUTED }, children: L.paymentDetails }), _jsx("p", { className: "mt-1.5 text-[13px] leading-relaxed whitespace-pre-line", children: document.payment_details })] })), document.notes && (_jsxs("div", { children: [_jsx("div", { className: "text-[10px] font-semibold uppercase tracking-[0.14em]", style: { color: MUTED }, children: L.notes }), _jsx("p", { className: "mt-1.5 text-[13px] leading-relaxed whitespace-pre-line", children: document.notes })] }))] })), document.footer_note && (_jsx("p", { className: "mt-6 pt-4 text-[11.5px] leading-relaxed", style: { borderTop: `1px solid ${RULE}`, color: MUTED }, children: document.footer_note }))] })] })] }));
}
