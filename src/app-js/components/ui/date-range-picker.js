import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Calendar as CalendarIcon } from 'lucide-react';
import { addYears } from 'date-fns';
import { Button } from './button.js';
import { Calendar } from './calendar.js';
import { Popover, PopoverContent, PopoverTrigger, } from './popover.js';
import { cn } from '../../lib/utils.js';
import { localDateString } from '../../lib/date-utils.js';
import { formatDateRange } from '../../lib/date-range-format.js';
import { resolveDateFnsLocale } from '../../lib/date-fns-locale.js';
import { useDisplayLocale } from '../../hooks/use-display-locale.js';
/**
 * A self-contained "from → to" date picker, mirroring the popover the
 * transactions filter bar uses. Isolated so multiple pages (Reports, Assets,
 * …) can share the same interaction without duplicating state juggling.
 *
 * Deliberately independent of the transactions filter bar's rich chip UI:
 * this variant is a single trigger + popover, which is what report toolbars
 * actually need.
 */
export function DateRangePicker({ from, to, onChange, label, className, size = 'sm', placeholder, variant = 'button', active = false, onOpen, defaultFrom, defaultTo, disallowFuture = false, maxRangeYears, }) {
    const { t, i18n } = useTranslation();
    const dateLocale = useDisplayLocale();
    const dateFnsLocale = resolveDateFnsLocale(i18n.resolvedLanguage ?? i18n.language);
    const [open, setOpen] = useState(false);
    const [draftFrom, setDraftFrom] = useState(from);
    const [draftTo, setDraftTo] = useState(to);
    // Mirrors the Apply-time normalization (a one-sided pick mirrors into the
    // other bound; a reversed pick swaps) so validation always judges the same
    // range Apply would actually commit.
    const normalizeDraft = (f, toDate) => {
        const nextFrom = f || toDate;
        const nextTo = toDate || f;
        return nextFrom && nextTo && nextFrom > nextTo
            ? { from: nextTo, to: nextFrom }
            : { from: nextFrom, to: nextTo };
    };
    const normalizedDraft = normalizeDraft(draftFrom, draftTo);
    // An empty draft is always valid — it's how Apply clears a saved range.
    const draftError = (() => {
        const { from: draftStart, to: draftEnd } = normalizedDraft;
        if (!draftStart && !draftEnd)
            return null;
        if (disallowFuture && draftEnd > localDateString()) {
            return t('transactions.filtersBar.futureDateError');
        }
        if (maxRangeYears && draftStart && draftEnd) {
            // Compare against the calendar-year anniversary of the start date,
            // not a fixed day count — a day count would let leap days inside the
            // window push the effective cap past the intended N years.
            const maxEnd = addYears(new Date(draftStart + 'T00:00:00'), maxRangeYears);
            if (new Date(draftEnd + 'T00:00:00') > maxEnd) {
                return t('transactions.filtersBar.rangeTooWideError', { years: maxRangeYears });
            }
        }
        return null;
    })();
    // Reset the drafts every time the popover opens so a preset switch above
    // the picker (which mutates the controlled `from`/`to` props) doesn't
    // surface stale values the next time the user opens it. Done via the
    // Popover callback rather than an effect on props to avoid the cascading
    // renders that react-hooks/set-state-in-effect flags.
    const handleOpenChange = (next) => {
        if (next) {
            onOpen?.();
            // Seed only drafts; closing without Apply leaves the controlled range intact.
            const seedFrom = from || to ? from : defaultFrom ?? from;
            const seedTo = from || to ? to : defaultTo ?? to;
            setDraftFrom(seedFrom);
            setDraftTo(seedTo);
        }
        setOpen(next);
    };
    const headerLabel = label ?? t('transactions.filtersBar.customRange');
    const emptyLabel = placeholder ?? t('transactions.filtersBar.pickRange');
    const triggerLabel = from || to ? formatDateRange(from, to, dateLocale) : emptyLabel;
    // Segment mode sits inline among short preset labels (6M, 1Y, …), so it
    // drops the year even across a year boundary — the same compact form the
    // transactions filter bar's applied-range chip uses. The year is still
    // visible while the calendar is open, which is the only place picking it
    // actually matters.
    const compactLabel = from || to ? formatDateRange(from, to, dateLocale, { compact: true }) : emptyLabel;
    return (_jsxs(Popover, { open: open, onOpenChange: handleOpenChange, children: [_jsx(PopoverTrigger, { asChild: true, children: variant === 'segment' ? (_jsx("button", { type: "button", className: cn('px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors', active
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50', className), "aria-label": headerLabel, children: active ? compactLabel : (label ?? emptyLabel) })) : (_jsxs(Button, { type: "button", variant: "outline", size: size, className: cn('gap-1.5 whitespace-nowrap font-normal', !(from || to) && 'text-muted-foreground', className), "aria-label": headerLabel, children: [_jsx(CalendarIcon, { size: 14 }), triggerLabel] })) }), _jsxs(PopoverContent, { align: "end", sideOffset: 8, className: "w-auto p-0", onOpenAutoFocus: (e) => e.preventDefault(), children: [_jsxs("div", { className: "border-b border-border/70 px-4 py-3", children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground", children: headerLabel }), _jsx("p", { className: "mt-0.5 text-[11px] text-muted-foreground/70", children: draftFrom || draftTo
                                    ? formatDateRange(draftFrom, draftTo, dateLocale)
                                    : emptyLabel })] }), _jsxs("div", { className: "flex flex-col gap-4 p-3 sm:flex-row sm:gap-0", children: [_jsxs("div", { className: "sm:border-r sm:border-border/60 sm:pr-2", children: [_jsx("p", { className: "px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80", children: t('transactions.filtersBar.fromLabel') }), _jsx(Calendar, { selected: draftFrom ? new Date(draftFrom + 'T00:00:00') : undefined, defaultMonth: draftFrom ? new Date(draftFrom + 'T00:00:00') : new Date(), locale: dateFnsLocale, onSelect: (d) => setDraftFrom(d ? localDateString(d) : '') })] }), _jsxs("div", { className: "sm:pl-2", children: [_jsx("p", { className: "px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80", children: t('transactions.filtersBar.toLabel') }), _jsx(Calendar, { selected: draftTo ? new Date(draftTo + 'T00:00:00') : undefined, defaultMonth: draftTo
                                            ? new Date(draftTo + 'T00:00:00')
                                            : draftFrom
                                                ? new Date(draftFrom + 'T00:00:00')
                                                : new Date(), locale: dateFnsLocale, onSelect: (d) => setDraftTo(d ? localDateString(d) : '') })] })] }), draftError && (_jsxs("div", { className: "flex items-center gap-1.5 px-3 pb-2 text-[11px] text-rose-600 dark:text-rose-400", children: [_jsx(AlertCircle, { size: 12, className: "shrink-0" }), _jsx("span", { children: draftError })] })), _jsxs("div", { className: "flex items-center justify-between gap-2 border-t border-border/70 px-3 py-2", children: [_jsx("button", { type: "button", onClick: () => {
                                    setDraftFrom('');
                                    setDraftTo('');
                                }, className: "text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground", children: t('transactions.filtersBar.reset') }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: () => {
                                            setDraftFrom(from);
                                            setDraftTo(to);
                                            setOpen(false);
                                        }, children: t('transactions.filtersBar.cancel') }), _jsx(Button, { type: "button", size: "sm", disabled: !!draftError, onClick: () => {
                                            onChange(normalizedDraft.from, normalizedDraft.to);
                                            setOpen(false);
                                        }, children: t('transactions.filtersBar.apply') })] })] })] })] }));
}
