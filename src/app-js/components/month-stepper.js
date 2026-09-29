import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { shiftMonth, monthLabel } from '../lib/month-utils.js';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover.js';
import { MonthPicker } from './ui/monthpicker.js';
import { resolveDateFnsLocale } from '../lib/date-fns-locale.js';
/**
 * Compact month stepper: `‹  Month Year  ›`. Stateless — it only renders the
 * given month and emits onChange. Wiring (URL/date-range/query) lives in the
 * parent so the stepper stays a single source of truth on top of existing filters.
 */
export function MonthStepper({ value, onChange, locale = 'pt-BR', prevLabel, nextLabel }) {
    const [open, setOpen] = useState(false);
    const label = monthLabel(value, locale).replace(/^\w/, (c) => c.toUpperCase());
    const [year, month] = value.split('-').map(Number);
    const compactLabel = new Date(year, month - 1, 2).toLocaleDateString(locale, {
        month: '2-digit',
        year: 'numeric',
    });
    const dateFnsLocale = resolveDateFnsLocale(locale);
    return (_jsxs("div", { className: "flex items-center gap-1 min-w-0", children: [_jsx("button", { type: "button", "aria-label": prevLabel, className: "h-8 w-8 shrink-0 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition-all text-base cursor-pointer", onClick: () => onChange(shiftMonth(value, -1)), children: "\u2039" }), _jsxs(Popover, { open: open, onOpenChange: setOpen, children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs("button", { type: "button", "aria-label": label, title: label, className: "inline-flex min-w-0 items-center justify-center truncate rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground transition-all hover:bg-muted/50 sm:min-w-[160px] sm:px-3", children: [_jsx("span", { className: "sm:hidden", children: compactLabel }), _jsx("span", { className: "hidden sm:inline", children: label })] }) }), _jsx(PopoverContent, { align: "center", className: "w-auto p-0", children: _jsx(MonthPicker, { locale: dateFnsLocale, selectedMonth: new Date(`${value}-01T00:00:00`), onMonthSelect: (date) => {
                                if (!date)
                                    return;
                                const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                                onChange(newMonth);
                                setOpen(false);
                            } }) })] }), _jsx("button", { type: "button", "aria-label": nextLabel, className: "h-8 w-8 shrink-0 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition-all text-base cursor-pointer", onClick: () => onChange(shiftMonth(value, 1)), children: "\u203A" })] }));
}
