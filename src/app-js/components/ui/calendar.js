import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, addYears, subYears, isSameMonth, isSameDay, isToday, format, setMonth as dfSetMonth, setYear as dfSetYear, } from 'date-fns';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { cn } from '../../lib/utils.js';
const YEAR_PAGE_SIZE = 12;
function Calendar({ selected, defaultMonth, locale, onSelect, className, }) {
    const [viewMonth, setViewMonth] = useState(defaultMonth ?? selected ?? new Date());
    const [view, setView] = useState('days');
    const currentYear = viewMonth.getFullYear();
    const yearPageStart = Math.floor(currentYear / YEAR_PAGE_SIZE) * YEAR_PAGE_SIZE;
    const goPrev = () => {
        if (view === 'days')
            setViewMonth(subMonths(viewMonth, 1));
        else if (view === 'months')
            setViewMonth(subYears(viewMonth, 1));
        else
            setViewMonth(subYears(viewMonth, YEAR_PAGE_SIZE));
    };
    const goNext = () => {
        if (view === 'days')
            setViewMonth(addMonths(viewMonth, 1));
        else if (view === 'months')
            setViewMonth(addYears(viewMonth, 1));
        else
            setViewMonth(addYears(viewMonth, YEAR_PAGE_SIZE));
    };
    const headerLabel = view === 'days'
        ? format(viewMonth, 'LLLL yyyy', { locale })
        : view === 'months'
            ? format(viewMonth, 'yyyy', { locale })
            : `${yearPageStart} – ${yearPageStart + YEAR_PAGE_SIZE - 1}`;
    const onHeaderClick = () => {
        if (view === 'days')
            setView('months');
        else if (view === 'months')
            setView('years');
    };
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const calStart = startOfWeek(monthStart, { locale });
    const calEnd = endOfWeek(monthEnd, { locale });
    const weeks = [];
    let day = calStart;
    while (day <= calEnd) {
        const week = [];
        for (let i = 0; i < 7; i++) {
            week.push(day);
            day = addDays(day, 1);
        }
        weeks.push(week);
    }
    const weekdayLabels = [];
    for (let i = 0; i < 7; i++) {
        weekdayLabels.push(format(addDays(calStart, i), 'EEEEEE', { locale }));
    }
    return (_jsxs("div", { className: cn('p-3 w-[252px]', className), children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("button", { type: "button", onClick: goPrev, className: "size-7 inline-flex items-center justify-center rounded-lg border border-border bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors", children: _jsx(ChevronLeftIcon, { className: "size-4" }) }), _jsx("button", { type: "button", onClick: onHeaderClick, disabled: view === 'years', className: cn('text-sm font-medium text-foreground capitalize px-2 py-1 rounded-md transition-colors', view !== 'years' && 'hover:bg-muted/60 cursor-pointer', view === 'years' && 'cursor-default'), children: headerLabel }), _jsx("button", { type: "button", onClick: goNext, className: "size-7 inline-flex items-center justify-center rounded-lg border border-border bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors", children: _jsx(ChevronRightIcon, { className: "size-4" }) })] }), view === 'days' && (_jsxs(_Fragment, { children: [_jsx("div", { className: "grid grid-cols-7 mb-1", children: weekdayLabels.map((label, i) => (_jsx("div", { className: "text-center text-[11px] font-medium text-muted-foreground py-1", children: label }, i))) }), _jsx("div", { className: "grid grid-cols-7", children: weeks.map((week, wi) => week.map((d, di) => {
                            const inMonth = isSameMonth(d, viewMonth);
                            const isSelected = selected && isSameDay(d, selected);
                            const today = isToday(d);
                            return (_jsx("button", { type: "button", onClick: () => onSelect?.(d), className: cn('size-8 inline-flex items-center justify-center rounded-lg text-sm transition-colors', !inMonth && 'text-muted-foreground/40', inMonth && !isSelected && 'text-foreground hover:bg-muted/60', today && !isSelected && 'bg-accent text-accent-foreground font-medium', isSelected && 'bg-primary text-primary-foreground font-semibold'), children: d.getDate() }, `${wi}-${di}`));
                        })) })] })), view === 'months' && (_jsx("div", { className: "grid grid-cols-3 gap-1", children: Array.from({ length: 12 }).map((_, i) => {
                    const monthDate = dfSetMonth(viewMonth, i);
                    const isCurrent = selected &&
                        selected.getFullYear() === monthDate.getFullYear() &&
                        selected.getMonth() === i;
                    return (_jsx("button", { type: "button", onClick: () => {
                            setViewMonth(monthDate);
                            setView('days');
                        }, className: cn('h-10 rounded-lg text-sm capitalize transition-colors', isCurrent
                            ? 'bg-primary text-primary-foreground font-semibold'
                            : 'text-foreground hover:bg-muted/60'), children: format(monthDate, 'MMM', { locale }) }, i));
                }) })), view === 'years' && (_jsx("div", { className: "grid grid-cols-3 gap-1", children: Array.from({ length: YEAR_PAGE_SIZE }).map((_, i) => {
                    const y = yearPageStart + i;
                    const isCurrent = selected && selected.getFullYear() === y;
                    return (_jsx("button", { type: "button", onClick: () => {
                            setViewMonth(dfSetYear(viewMonth, y));
                            setView('months');
                        }, className: cn('h-10 rounded-lg text-sm transition-colors', isCurrent
                            ? 'bg-primary text-primary-foreground font-semibold'
                            : 'text-foreground hover:bg-muted/60'), children: y }, y));
                }) }))] }));
}
export { Calendar };
