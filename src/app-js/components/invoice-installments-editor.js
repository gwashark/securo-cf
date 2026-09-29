import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { Switch } from './ui/switch.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from './ui/select.js';
import { formatCurrency } from '../lib/format.js';
import { useDisplayLocale } from '../hooks/use-display-locale.js';
import { cn } from '../lib/utils.js';
import { addMonths, installmentsTotal, splitEvenly } from '../lib/installment-utils.js';
/**
 * The dates the money is expected on, when there is more than one.
 *
 * Off by default and one switch away: the ordinary invoice has one due
 * date and never sees this. On, it is a small table the person fills or
 * seeds with "split in N", and a running check against the total,
 * because the server refuses a schedule that does not add up and the
 * mismatch is better shown here than as an error after the submit.
 */
const TH = 'text-[11px] font-medium text-muted-foreground pb-1.5';
const SPLITS = [2, 3, 4, 6, 12];
export function InvoiceInstallmentsEditor({ value, onChange, total, currency, firstDueDate, minDate, }) {
    const { t } = useTranslation();
    const locale = useDisplayLocale();
    const enabled = value !== null;
    const rows = value ?? [];
    const scheduled = installmentsTotal(rows);
    const mismatch = enabled && Math.abs(scheduled - total) >= 0.005;
    const money = (n) => formatCurrency(n, currency, locale);
    const update = (index, patch) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    return (_jsxs("div", { className: "space-y-2", "data-testid": "invoice-installments-editor", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Label, { htmlFor: "installments-toggle", children: t('invoices.installments.title') }), _jsx(Switch, { id: "installments-toggle", checked: enabled, onCheckedChange: (on) => onChange(on ? splitEvenly(total, 2, firstDueDate) : null) })] }), enabled && (_jsxs("div", { className: "rounded-lg border border-border overflow-hidden", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border", children: [_jsx("span", { className: "text-xs text-muted-foreground", children: t('invoices.installments.splitIn') }), _jsxs(Select, { onValueChange: (n) => onChange(splitEvenly(total, Number(n), firstDueDate)), children: [_jsx(SelectTrigger, { className: "h-8 w-24", "data-testid": "installments-split", children: _jsx(SelectValue, { placeholder: "N" }) }), _jsx(SelectContent, { children: SPLITS.map((n) => (_jsx(SelectItem, { value: String(n), children: `${n}x` }, n))) })] }), _jsx("span", { className: "text-[11px] text-muted-foreground", children: t('invoices.installments.splitHint') }), _jsxs(Button, { size: "sm", variant: "ghost", className: "ml-auto", onClick: () => onChange([
                                    ...rows,
                                    { due_date: addMonths(rows[rows.length - 1]?.due_date ?? firstDueDate, 1), amount: '0', label: null },
                                ]), "data-testid": "installments-add", children: [_jsx(Plus, { className: "h-3.5 w-3.5 mr-1" }), t('invoices.installments.add')] })] }), _jsxs("div", { className: "hidden sm:grid grid-cols-[1fr_8rem_8rem_2rem] gap-2 px-3 pt-2", children: [_jsx("span", { className: TH, children: t('invoices.installments.label') }), _jsx("span", { className: TH, children: t('invoices.column.due') }), _jsx("span", { className: `${TH} text-right`, children: t('invoices.column.amount') }), _jsx("span", { className: TH })] }), _jsx("div", { className: "divide-y divide-border", children: rows.map((row, index) => (_jsxs("div", { "data-testid": "installment-row", className: "grid grid-cols-2 sm:grid-cols-[1fr_8rem_8rem_2rem] gap-2 px-3 py-2 items-center", children: [_jsx(Input, { className: "h-9 col-span-2 sm:col-span-1", placeholder: t('invoices.installments.labelPlaceholder', { n: index + 1, total: rows.length }), value: row.label ?? '', onChange: (e) => update(index, { label: e.target.value || null }), "data-testid": `installment-label-${index}`, maxLength: 60 }), _jsx(Input, { className: "h-9", type: "date", min: minDate, value: row.due_date, onChange: (e) => update(index, { due_date: e.target.value }), "data-testid": `installment-due-${index}`, "aria-label": t('invoices.column.due') }), _jsx(Input, { className: "h-9 text-right", inputMode: "decimal", value: row.amount, onChange: (e) => update(index, { amount: e.target.value }), "data-testid": `installment-amount-${index}`, "aria-label": t('invoices.column.amount') }), _jsx("div", { className: "flex justify-end", children: _jsx(Button, { size: "sm", variant: "ghost", className: "h-8 w-8 p-0 text-muted-foreground hover:text-destructive", disabled: rows.length <= 2, onClick: () => onChange(rows.filter((_, i) => i !== index)), "data-testid": `installment-remove-${index}`, "aria-label": t('common.delete'), children: _jsx(Trash2, { className: "h-4 w-4" }) }) })] }, index))) }), _jsxs("div", { className: cn('flex items-center justify-between px-3 py-2 text-xs border-t border-border', mismatch ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400' : 'bg-muted/40 text-muted-foreground'), "data-testid": "installments-check", children: [_jsx("span", { children: mismatch
                                    ? t('invoices.installments.mismatch', { scheduled: money(scheduled), total: money(total) })
                                    : t('invoices.installments.addsUp', { total: money(total) }) }), _jsx("span", { className: "tabular-nums font-medium", children: money(scheduled) })] })] }))] }));
}
