import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Repeat } from 'lucide-react';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from './ui/select.js';
import { cn } from '../lib/utils.js';
import { periodLabel, scheduleLabel, scheduleTone } from '../lib/invoice-schedule-utils.js';
import { useDateLocale } from '../hooks/use-display-locale.js';
/** Status pill for an agreement, in the invoice badge's shape. */
export function ScheduleBadge({ schedule, }) {
    const { t } = useTranslation();
    const label = scheduleLabel(schedule);
    return (_jsx("span", { "data-testid": `schedule-state-${label}`, className: cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap', scheduleTone(schedule)), children: t(`invoices.schedules.state.${label}`) }));
}
/**
 * The chip an invoice wears when it answers for a period of an
 * agreement: the agreement's name and the period, linking to it. Small
 * on purpose: the invoice is the subject, this is its provenance.
 */
export function SchedulePeriodChip({ invoice }) {
    const dateLocale = useDateLocale();
    if (!invoice.schedule || !invoice.period_start || !invoice.period_end)
        return null;
    return (_jsxs(Link, { to: `/invoices/schedules/${invoice.schedule.id}`, onClick: (e) => e.stopPropagation(), "data-testid": "invoice-schedule-chip", className: "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors", children: [_jsx(Repeat, { className: "h-3 w-3" }), _jsx("span", { className: "truncate max-w-[160px]", children: invoice.schedule.name }), _jsx("span", { className: "text-muted-foreground/70 tabular-nums", children: periodLabel(invoice.period_start, invoice.period_end, dateLocale) })] }));
}
/**
 * The end condition, as one control. Three shapes (never, a date, a
 * count) share a select, and the field for the chosen one appears
 * beside it. Used by the create and edit dialogs and the "make
 * recurring" one on the invoice page, so the three agree.
 */
export function EndConditionFields({ endType, endDate, endCount, onChange, idPrefix, }) {
    const { t } = useTranslation();
    return (_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: t('invoices.schedules.field.ends') }), _jsxs(Select, { value: endType, onValueChange: (value) => onChange({ endType: value, endDate, endCount }), children: [_jsx(SelectTrigger, { "data-testid": `${idPrefix}-end-type`, children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: ['never', 'on_date', 'after_count'].map((value) => (_jsx(SelectItem, { value: value, children: t(`invoices.schedules.endType.${value}`) }, value))) })] })] }), endType === 'on_date' && (_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: `${idPrefix}-end-date`, children: t('invoices.schedules.field.endDate') }), _jsx(Input, { id: `${idPrefix}-end-date`, "data-testid": `${idPrefix}-end-date`, type: "date", value: endDate, onChange: (e) => onChange({ endType, endDate: e.target.value, endCount }) })] })), endType === 'after_count' && (_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: `${idPrefix}-end-count`, children: t('invoices.schedules.field.endCount') }), _jsx(Input, { id: `${idPrefix}-end-count`, "data-testid": `${idPrefix}-end-count`, type: "number", min: 1, value: endCount, onChange: (e) => onChange({ endType, endDate, endCount: e.target.value }) })] }))] }));
}
