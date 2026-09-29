import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
import { Package, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { formatCurrency } from '../lib/format.js';
import { useDisplayLocale } from '../hooks/use-display-locale.js';
import { linesTotal } from '../lib/invoice-utils.js';
import { lineFromProduct } from '../lib/product-utils.js';
import { ProductPicker } from './product-picker.js';
/**
 * Line items on a draft.
 *
 * Optional by design, and the empty state says so: under the tracking
 * preset the fiscal document was issued elsewhere and an invoice with no
 * lines is the normal case, not an unfinished one.
 *
 * The layout is a table with real headers rather than a row of bare
 * boxes. A field holding `1` next to a field holding `0` tells the
 * person nothing about which is a quantity and which is a price, and a
 * placeholder disappears the moment they type. Each row also shows what
 * it comes to, because the arithmetic between a rate and a total is the
 * thing most worth checking before sending an invoice out.
 *
 * The running totals here are a convenience while typing; the server
 * recomputes on save from the same quantities and prices, and its answer
 * is the one that gets stored.
 */
const BLANK = { description: '', quantity: '1', unit_price: '0' };
/** Table header cell, matching the module's other tables. */
const TH = 'text-[11px] font-medium text-muted-foreground pb-1.5';
function lineAmount(line) {
    const quantity = Number(line.quantity);
    const price = Number(line.unit_price);
    if (!Number.isFinite(quantity) || !Number.isFinite(price))
        return 0;
    return quantity * price;
}
export function InvoiceLineEditor({ lines, onChange, currency, showTax, required = false, }) {
    const { t } = useTranslation();
    const locale = useDisplayLocale();
    // A render decision, not state: seeding the parent's array from an
    // effect would fight the parent for ownership of it.
    const rows = lines.length === 0 && required ? [BLANK] : lines;
    const update = (index, patch) => {
        onChange(rows.map((line, i) => (i === index ? { ...line, ...patch } : line)));
    };
    const add = () => onChange([...rows, { ...BLANK }]);
    const money = (value) => formatCurrency(value, currency, locale);
    const total = linesTotal(rows);
    return (_jsxs("div", { className: "space-y-2", "data-testid": "invoice-line-editor", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Label, { children: t('invoices.field.lines') }), rows.length > 0 && (_jsxs(Button, { size: "sm", variant: "ghost", onClick: add, "data-testid": "invoice-add-line", children: [_jsx(Plus, { className: "h-3.5 w-3.5 mr-1" }), t('invoices.field.addLine')] }))] }), rows.length === 0 ? (_jsxs("button", { type: "button", onClick: add, "data-testid": "invoice-add-line", className: "w-full rounded-lg border border-dashed border-border px-4 py-5 text-center hover:border-primary/40 hover:bg-primary/[0.02] transition-colors", children: [_jsxs("span", { className: "flex items-center justify-center gap-1.5 text-sm font-medium text-foreground", children: [_jsx(Plus, { className: "h-4 w-4" }), t('invoices.field.addLine')] }), _jsx("span", { className: "mt-1 block text-xs text-muted-foreground", children: t('invoices.field.linesOptional') })] })) : (_jsxs("div", { className: "rounded-lg border border-border overflow-hidden", children: [_jsxs("div", { className: "hidden sm:grid grid-cols-[1fr_4.5rem_5rem_7rem_6rem_2rem] gap-2 px-3 pt-2.5 bg-muted/40", children: [_jsx("span", { className: TH, children: t('invoices.field.lineDescription') }), _jsx("span", { className: `${TH} text-right`, children: t('invoices.column.quantity') }), _jsx("span", { className: TH, children: t('invoices.field.unit') }), _jsx("span", { className: `${TH} text-right`, children: t('invoices.field.unitPrice') }), _jsx("span", { className: `${TH} text-right`, children: t('invoices.column.amount') }), _jsx("span", { className: TH })] }), _jsx("div", { className: "divide-y divide-border", children: rows.map((line, index) => (_jsxs("div", { "data-testid": "invoice-line-row", className: "grid grid-cols-2 sm:grid-cols-[1fr_4.5rem_5rem_7rem_6rem_2rem] gap-2 px-3 py-2.5 items-center", children: [_jsxs("div", { className: "col-span-2 sm:col-span-1 flex items-center gap-1.5", children: [_jsx(ProductPicker, { currency: currency, onPick: (product, price) => onChange(rows.map((row, i) => (i === index ? lineFromProduct(row, product, price) : row))) }), _jsx(Input, { className: "h-9", placeholder: t('invoices.field.lineDescription'), value: line.description, onChange: (e) => update(index, { description: e.target.value }), "data-testid": `invoice-line-description-${index}`, "aria-label": t('invoices.field.lineDescription') }), line.product_id && (_jsx("span", { className: "inline-flex shrink-0 items-center text-muted-foreground", title: t('invoices.products.fromCatalog'), "aria-label": t('invoices.products.fromCatalog'), "data-testid": `invoice-line-from-catalog-${index}`, children: _jsx(Package, { className: "h-3.5 w-3.5" }) }))] }), _jsx(Field, { label: t('invoices.column.quantity'), children: _jsx(Input, { className: "h-9 text-right", inputMode: "decimal", value: line.quantity, onChange: (e) => update(index, { quantity: e.target.value }), "data-testid": `invoice-line-quantity-${index}`, "aria-label": t('invoices.column.quantity') }) }), _jsx(Field, { label: t('invoices.field.unit'), children: _jsx(Input, { className: "h-9", placeholder: t('invoices.field.unitPlaceholder'), value: line.unit ?? '', onChange: (e) => update(index, { unit: e.target.value || null }), "data-testid": `invoice-line-unit-${index}`, "aria-label": t('invoices.field.unit'), maxLength: 20 }) }), _jsx(Field, { label: t('invoices.field.unitPrice'), children: _jsx(Input, { className: "h-9 text-right", inputMode: "decimal", value: line.unit_price, onChange: (e) => update(index, { unit_price: e.target.value }), "data-testid": `invoice-line-price-${index}`, "aria-label": t('invoices.field.unitPrice') }) }), _jsxs("div", { className: "text-right", children: [_jsx("span", { className: "sm:hidden text-[11px] text-muted-foreground block", children: t('invoices.column.amount') }), _jsx("span", { className: "text-sm font-medium tabular-nums", "data-testid": `invoice-line-amount-${index}`, children: money(lineAmount(line)) })] }), _jsx("div", { className: "flex justify-end", children: _jsx(Button, { size: "sm", variant: "ghost", className: "h-8 w-8 p-0 text-muted-foreground hover:text-destructive", onClick: () => onChange(rows.filter((_, i) => i !== index)), "data-testid": `invoice-remove-line-${index}`, "aria-label": t('common.delete'), children: _jsx(Trash2, { className: "h-4 w-4" }) }) }), showTax && (_jsxs("div", { className: "col-span-2 sm:col-span-6 flex items-center gap-2 pt-1", children: [_jsx("span", { className: "text-[11px] text-muted-foreground", children: t('invoices.field.taxRate') }), _jsx(Input, { className: "h-8 w-20 text-right", inputMode: "decimal", placeholder: "%", value: line.tax_rate ?? '', onChange: (e) => update(index, { tax_rate: e.target.value || null }), "data-testid": `invoice-line-tax-${index}`, "aria-label": t('invoices.field.taxRate') })] }))] }, index))) }), _jsxs("div", { className: "flex items-center justify-between px-3 py-2.5 bg-muted/40 border-t border-border", children: [_jsx("span", { className: "text-xs text-muted-foreground", children: t('invoices.field.lineCount', { count: rows.length }) }), _jsxs("span", { className: "text-sm", children: [_jsx("span", { className: "text-muted-foreground mr-2", children: t('invoices.column.total') }), _jsx("span", { className: "font-semibold tabular-nums", "data-testid": "invoice-lines-total", children: money(total) })] })] })] }))] }));
}
/** A field whose label shows only on the stacked layout, where the table
 *  header is not there to explain it. */
function Field({ label, children }) {
    return (_jsxs("div", { children: [_jsx("span", { className: "sm:hidden text-[11px] text-muted-foreground block mb-0.5", children: label }), children] }));
}
