import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, CalendarDays, ChartNoAxesColumn, CircleDot, Clock, EyeClosed, Minus } from 'lucide-react';
import { Skeleton } from './ui/skeleton.js';
import { AccountIcon } from './account-icon.js';
import { CategoryIcon } from './category-icon.js';
import { ProjectedTransactionBadge } from './projected-transaction-badge.js';
import { getAccountName } from '../lib/account-utils.js';
import { activityChartData, dayActivity, isCalendarItemInteractive } from '../lib/calendar-activity.js';
import { todayInTimezone, weekdayShortLabels } from '../lib/date-utils.js';
import { useEffectiveTimezone } from '../hooks/use-timezone.js';
import { cn } from '../lib/utils.js';
import { formatCurrency } from '../lib/format.js';
import { shouldShowPendingBadge } from '../lib/transaction-status.js';
function parseLocalDate(value) {
    return new Date(`${value}T00:00:00`);
}
function compactCurrency(value, currency = 'USD', locale = 'en-US') {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);
}
function signedAmount(item) {
    return item.type === 'credit' ? Math.abs(item.amount) : -Math.abs(item.amount);
}
function displayDayNumber(date) {
    return parseLocalDate(date).getDate();
}
// A busy day can hold dozens of rows, and only three fit. Showing the biggest movers
// makes those three worth reading; showing an arbitrary three did not.
function itemSize(item) {
    return Math.abs(item.amount_primary ?? item.amount);
}
function topItemsBySize(items, limit) {
    return [...items].sort((a, b) => itemSize(b) - itemSize(a)).slice(0, limit);
}
const CALENDAR_DENSITY_STORAGE_KEY = 'securo.transactionCalendar.density';
const CALENDAR_METRIC_STORAGE_KEY = 'securo.transactionCalendar.metric';
function readCalendarDensity() {
    if (typeof window === 'undefined')
        return 'compact';
    return window.localStorage.getItem(CALENDAR_DENSITY_STORAGE_KEY) === 'detailed' ? 'detailed' : 'compact';
}
function readCalendarMetric() {
    if (typeof window === 'undefined')
        return 'balance';
    return window.localStorage.getItem(CALENDAR_METRIC_STORAGE_KEY) === 'activity' ? 'activity' : 'balance';
}
export function TransactionCalendarView({ calendar, isLoading, locale, dateLocale, mask, selectedDate, onSelectedDateChange, onOpenTransaction, accounts, userCurrency, }) {
    const [density, setDensity] = useState(readCalendarDensity);
    const [metric, setMetric] = useState(readCalendarMetric);
    // The server decides which rows are actual and which are projected by its
    // own idea of today, so the highlighted day has to be the same one.
    const timeZone = useEffectiveTimezone();
    const today = todayInTimezone(timeZone);
    const accountById = useMemo(() => {
        const map = new Map();
        for (const account of accounts ?? [])
            map.set(account.id, account);
        return map;
    }, [accounts]);
    useEffect(() => {
        window.localStorage.setItem(CALENDAR_DENSITY_STORAGE_KEY, density);
    }, [density]);
    useEffect(() => {
        window.localStorage.setItem(CALENDAR_METRIC_STORAGE_KEY, metric);
    }, [metric]);
    useEffect(() => {
        if (!calendar?.days.length)
            return;
        if (selectedDate && calendar.days.some((day) => day.date === selectedDate))
            return;
        const inCalendarToday = calendar.days.find((day) => day.date === today);
        const firstInMonth = calendar.days.find((day) => day.in_month);
        onSelectedDateChange((inCalendarToday ?? firstInMonth ?? calendar.days[0]).date);
    }, [calendar, onSelectedDateChange, selectedDate, today]);
    const selectedDay = calendar?.days.find((day) => day.date === selectedDate);
    const weekDays = useMemo(() => weekdayShortLabels(dateLocale), [dateLocale]);
    if (isLoading) {
        return (_jsxs("div", { className: "bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-4", children: [_jsxs("div", { className: "p-4 border-b border-border flex items-center justify-between", children: [_jsx(Skeleton, { className: "h-6 w-44" }), _jsx(Skeleton, { className: "h-8 w-32" })] }), _jsx("div", { className: "grid grid-cols-7", children: Array.from({ length: 35 }).map((_, index) => (_jsxs("div", { className: "min-h-32 border-r border-b border-border p-3", children: [_jsx(Skeleton, { className: "h-4 w-8 mb-4" }), _jsx(Skeleton, { className: "h-4 w-24" })] }, index))) })] }));
    }
    if (!calendar)
        return null;
    return (_jsxs("div", { className: "mb-4 flex flex-col gap-4 md:flex-row md:items-start", children: [_jsxs("section", { className: "min-w-0 flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border sm:px-5", children: [_jsx(CalendarLegend, {}), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(CalendarMetricToggle, { value: metric, onChange: setMetric }), _jsx(CalendarDensityToggle, { value: density, onChange: setDensity })] })] }), metric === 'balance' ? (_jsx(BalanceTrend, { days: calendar.days.filter((day) => day.in_month), currency: calendar.currency, locale: locale, mask: mask, selectedDate: selectedDate, onSelectDate: onSelectedDateChange })) : (_jsx(ActivityBars, { days: calendar.days.filter((day) => day.in_month), currency: calendar.currency, locale: locale, mask: mask, selectedDate: selectedDate, onSelectDate: onSelectedDateChange })), _jsx("div", { className: "hidden md:grid grid-cols-7 border-b border-border bg-muted/30", children: weekDays.map((day) => (_jsx("div", { className: "px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: day }, day))) }), _jsx("div", { className: "hidden md:grid grid-cols-7", children: calendar.days.map((day, index) => (_jsx(DayCell, { day: day, selected: day.date === selectedDate, today: day.date === today, currency: calendar.currency, locale: locale, mask: mask, density: density, metric: metric, onSelect: () => onSelectedDateChange(day.date), 
                            // The container clips the grid with rounded-xl + overflow-hidden, so the
                            // two bottom corner cells carry a matching radius (12px outer − 1px
                            // border) — otherwise their selection/focus ring loses its corner.
                            className: cn(index === calendar.days.length - 7 && 'rounded-bl-[11px]', index === calendar.days.length - 1 && 'rounded-br-[11px]') }, day.date))) }), _jsx("div", { className: "md:hidden divide-y divide-border", children: calendar.days.filter((day) => day.in_month || day.date === selectedDate).map((day) => {
                            const selected = day.date === selectedDate;
                            const panelId = `transaction-calendar-day-details-${day.date}`;
                            return (_jsxs("div", { children: [_jsx(MobileDayRow, { day: day, selected: selected, panelId: panelId, currency: calendar.currency, locale: locale, dateLocale: dateLocale, mask: mask, density: density, metric: metric, onSelect: () => onSelectedDateChange(day.date) }), selected && (_jsx(SelectedDayPanel, { id: panelId, variant: "mobile", day: day, currency: calendar.currency, locale: locale, dateLocale: dateLocale, mask: mask, metric: metric, accountById: accountById, userCurrency: userCurrency, onOpenTransaction: onOpenTransaction }))] }, day.date));
                        }) })] }), _jsx(SelectedDayPanel, { variant: "desktop", day: selectedDay, currency: calendar.currency, locale: locale, dateLocale: dateLocale, mask: mask, metric: metric, accountById: accountById, userCurrency: userCurrency, onOpenTransaction: onOpenTransaction })] }));
}
// The grid tells you what happened on a day. It cannot show the shape of the month,
// which is the actual question: when does the balance fall, and does it cross zero.
// Reading 31 separate numbers to answer that is the thing this strip removes.
function BalanceTrend({ days, currency, locale, mask, selectedDate, onSelectDate, }) {
    const { t } = useTranslation();
    const W = 1000;
    const H = 120;
    const geometry = useMemo(() => {
        if (days.length < 2)
            return null;
        const values = days.map((day) => day.ending_balance);
        const rawMin = Math.min(...values, 0);
        const rawMax = Math.max(...values, 0);
        const pad = (rawMax - rawMin) * 0.12 || Math.abs(rawMax || 1) * 0.12;
        const min = rawMin - pad;
        const max = rawMax + pad;
        const span = max - min || 1;
        const x = (i) => (i / (days.length - 1)) * W;
        const y = (v) => H - ((v - min) / span) * H;
        const points = days.map((day, i) => ({ x: x(i), y: y(day.ending_balance), day }));
        const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
        const zeroY = y(0);
        // Close the area on the zero line rather than the bottom edge. Clipped above zero it
        // paints the surplus green; clipped below it paints only the actual shortfall red.
        const area = `${line} L${W},${zeroY.toFixed(2)} L0,${zeroY.toFixed(2)} Z`;
        return { points, line, area, zeroY };
    }, [days]);
    if (!geometry)
        return null;
    const { points, line, area, zeroY } = geometry;
    const selectedPoint = points.find((p) => p.day.date === selectedDate);
    return (_jsxs("div", { className: "hidden border-b border-border px-4 pb-3 pt-2 sm:px-5 md:block", children: [_jsx("p", { className: "mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", children: t('transactions.calendarBalanceTrend') }), _jsxs("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", className: "h-16 w-full overflow-visible", role: "img", "aria-label": t('transactions.calendarBalanceTrend'), children: [_jsxs("defs", { children: [_jsxs("linearGradient", { id: "cal-trend-fill", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "rgb(16 185 129)", stopOpacity: "0.28" }), _jsx("stop", { offset: "100%", stopColor: "rgb(16 185 129)", stopOpacity: "0.02" })] }), _jsx("clipPath", { id: "cal-trend-positive", children: _jsx("rect", { x: "0", y: "0", width: W, height: Math.max(0, zeroY) }) }), _jsx("clipPath", { id: "cal-trend-negative", children: _jsx("rect", { x: "0", y: zeroY, width: W, height: Math.max(0, H - zeroY) }) })] }), _jsx("path", { d: area, fill: "url(#cal-trend-fill)", clipPath: "url(#cal-trend-positive)" }), _jsx("path", { d: area, fill: "rgb(244 63 94)", fillOpacity: "0.25", clipPath: "url(#cal-trend-negative)" }), _jsx("line", { x1: "0", x2: W, y1: zeroY, y2: zeroY, stroke: "currentColor", strokeWidth: "1", strokeDasharray: "4 4", vectorEffect: "non-scaling-stroke", className: "text-rose-400/70" }), _jsx("path", { d: line, fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinejoin: "round", strokeLinecap: "round", vectorEffect: "non-scaling-stroke", className: "text-emerald-600 dark:text-emerald-400" }), selectedPoint && (_jsxs(_Fragment, { children: [_jsx("line", { x1: selectedPoint.x, x2: selectedPoint.x, y1: "0", y2: H, stroke: "currentColor", strokeWidth: "1", vectorEffect: "non-scaling-stroke", className: "text-primary/40" }), _jsx("circle", { cx: selectedPoint.x, cy: selectedPoint.y, r: "4", vectorEffect: "non-scaling-stroke", className: "fill-background stroke-primary", strokeWidth: "2" })] })), points.map((p, i) => (_jsx("rect", { x: i === 0 ? 0 : p.x - W / (points.length - 1) / 2, y: "0", width: W / (points.length - 1), height: H, fill: "transparent", className: "cursor-pointer", onClick: () => onSelectDate(p.day.date), children: _jsx("title", { children: `${displayDayNumber(p.day.date)} · ${mask(formatCurrency(p.day.ending_balance, currency, locale))}` }) }, p.day.date)))] })] }));
}
// The activity strip answers the other monthly question: how much came in and went
// out each day. Actual amounts are solid bars around a zero axis; projected amounts
// stack on top as dashed violet outlines so a forecasted bill never reads as settled.
function ActivityBars({ days, currency, locale, mask, selectedDate, onSelectDate, }) {
    const { t } = useTranslation();
    const W = 1000;
    const H = 120;
    const data = useMemo(() => activityChartData(days), [days]);
    if (days.length === 0)
        return null;
    if (!data.hasActivity) {
        return (_jsxs("div", { className: "hidden border-b border-border px-4 pb-3 pt-2 sm:px-5 md:block", children: [_jsx("p", { className: "mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", children: t('transactions.calendarActivityTrend') }), _jsx("p", { className: "flex h-16 items-center justify-center text-sm text-muted-foreground", children: t('transactions.calendarNoActivity') })] }));
    }
    const totalSpan = data.maxUp + data.maxDown || 1;
    // Leave breathing room so the tallest bar never touches the strip edges.
    const scale = (H * 0.92) / totalSpan;
    const axisY = data.maxUp * scale + H * 0.04;
    const slot = W / data.days.length;
    const barW = slot * 0.55;
    const barHeight = (value) => (value > 0 ? Math.max(value * scale, 1.5) : 0);
    const tooltipFor = (activity) => {
        const amount = (value) => mask(compactCurrency(value, currency, locale));
        const actualParts = [];
        if (activity.actualIncome > 0)
            actualParts.push(`${t('transactions.summaryIncome')} +${amount(activity.actualIncome)}`);
        if (activity.actualExpense > 0)
            actualParts.push(`${t('transactions.summaryExpenses')} −${amount(activity.actualExpense)}`);
        const projectedParts = [];
        if (activity.projectedIncome > 0)
            projectedParts.push(`+${amount(activity.projectedIncome)}`);
        if (activity.projectedExpense > 0)
            projectedParts.push(`−${amount(activity.projectedExpense)}`);
        const segments = [
            String(displayDayNumber(activity.date)),
            actualParts.length > 0 ? actualParts.join(' · ') : t('transactions.calendarNoMovements'),
        ];
        if (projectedParts.length > 0) {
            segments.push(`${t('transactions.calendarProjected')} ${projectedParts.join(' · ')}`);
        }
        return segments.join(' · ');
    };
    return (_jsxs("div", { className: "hidden border-b border-border px-4 pb-3 pt-2 sm:px-5 md:block", children: [_jsx("p", { className: "mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", children: t('transactions.calendarActivityTrend') }), _jsxs("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", className: "h-16 w-full overflow-visible", role: "img", "aria-label": t('transactions.calendarActivityTrend'), children: [_jsx("line", { x1: "0", x2: W, y1: axisY, y2: axisY, stroke: "currentColor", strokeWidth: "1", vectorEffect: "non-scaling-stroke", className: "text-border" }), data.days.map((activity, i) => {
                        const x = slot * i + (slot - barW) / 2;
                        const selected = activity.date === selectedDate;
                        const actualIncomeH = barHeight(activity.actualIncome);
                        const actualExpenseH = barHeight(activity.actualExpense);
                        const projectedIncomeH = barHeight(activity.projectedIncome);
                        const projectedExpenseH = barHeight(activity.projectedExpense);
                        return (_jsxs("g", { children: [selected && (_jsx("line", { x1: slot * i + slot / 2, x2: slot * i + slot / 2, y1: "0", y2: H, stroke: "currentColor", strokeWidth: "1", vectorEffect: "non-scaling-stroke", className: "text-primary/40" })), actualIncomeH > 0 && (_jsx("rect", { x: x, y: axisY - actualIncomeH, width: barW, height: actualIncomeH, className: "fill-emerald-500/80 dark:fill-emerald-400/80" })), projectedIncomeH > 0 && (_jsx("rect", { x: x, y: axisY - actualIncomeH - projectedIncomeH, width: barW, height: projectedIncomeH, strokeWidth: "1", strokeDasharray: "3 2", vectorEffect: "non-scaling-stroke", className: "fill-violet-500/10 stroke-violet-500 dark:stroke-violet-400" })), actualExpenseH > 0 && (_jsx("rect", { x: x, y: axisY, width: barW, height: actualExpenseH, className: "fill-rose-500/80 dark:fill-rose-400/80" })), projectedExpenseH > 0 && (_jsx("rect", { x: x, y: axisY + actualExpenseH, width: barW, height: projectedExpenseH, strokeWidth: "1", strokeDasharray: "3 2", vectorEffect: "non-scaling-stroke", className: "fill-violet-500/10 stroke-violet-500 dark:stroke-violet-400" })), _jsx("rect", { x: slot * i, y: "0", width: slot, height: H, fill: "transparent", role: "button", tabIndex: 0, "aria-label": tooltipFor(activity), "aria-pressed": selected, className: "cursor-pointer focus:outline-none focus-visible:fill-primary/10", onClick: () => onSelectDate(activity.date), onKeyDown: (event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            onSelectDate(activity.date);
                                        }
                                    }, children: _jsx("title", { children: tooltipFor(activity) }) })] }, activity.date));
                    })] })] }));
}
function CalendarLegend() {
    const { t } = useTranslation();
    return (_jsxs("div", { className: "flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground", children: [_jsx("span", { className: "font-semibold uppercase tracking-wide", children: t('transactions.calendarLegend') }), _jsx(LegendItem, { tone: "income", label: t('transactions.summaryIncome') }), _jsx(LegendItem, { tone: "expense", label: t('transactions.summaryExpenses') }), _jsx(LegendItem, { tone: "transfer", label: t('transactions.transfer'), children: _jsx(ArrowLeftRight, { size: 9 }) }), _jsx(LegendItem, { tone: "projected", label: t('transactions.calendarProjected'), children: _jsx(CalendarDays, { size: 9 }) })] }));
}
function SegmentedToggle({ value, onChange, options, label, }) {
    return (_jsx("div", { className: "inline-flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5 text-xs", role: "group", "aria-label": label, children: options.map((option) => (_jsx("button", { type: "button", onClick: () => onChange(option.value), className: cn('rounded-md px-2.5 py-1 font-semibold text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40', value === option.value && 'bg-card text-foreground shadow-sm dark:bg-background'), "aria-pressed": value === option.value, children: option.label }, option.value))) }));
}
function CalendarDensityToggle({ value, onChange }) {
    const { t } = useTranslation();
    return (_jsx(SegmentedToggle, { value: value, onChange: onChange, label: t('transactions.calendarDensity'), options: [
            { value: 'compact', label: t('transactions.calendarCompact') },
            { value: 'detailed', label: t('transactions.calendarDetailed') },
        ] }));
}
function CalendarMetricToggle({ value, onChange }) {
    const { t } = useTranslation();
    return (_jsx(SegmentedToggle, { value: value, onChange: onChange, label: t('transactions.calendarMetric'), options: [
            { value: 'balance', label: t('transactions.calendarBalanceMode') },
            { value: 'activity', label: t('transactions.calendarActivityMode') },
        ] }));
}
function LegendItem({ tone, label, children }) {
    return (_jsxs("span", { className: "inline-flex items-center gap-1 whitespace-nowrap", children: [_jsx(BadgeDot, { tone: tone, label: label, children: children }), _jsx("span", { children: label })] }));
}
function DayCell({ day, selected, today, currency, locale, mask, density, metric, onSelect, className, }) {
    const { t } = useTranslation();
    // The negative-balance warning belongs to the balance metric; activity mode has
    // no running balance to warn about.
    const isLowBalance = metric === 'balance' && day.ending_balance < 0;
    const detailed = density === 'detailed';
    const previewItems = detailed ? topItemsBySize(day.items, 3) : [];
    const moreCount = detailed ? Math.max(0, day.items.length - previewItems.length) : 0;
    return (_jsxs("div", { role: "button", tabIndex: 0, onClick: onSelect, onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect();
            }
        }, className: cn(
        // Column flex so a quiet day's marker can claim the leftover height and
        // sit in the middle of the cell instead of hanging under the date.
        'flex flex-col border-r border-b border-border p-3 text-left transition-colors hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/40', detailed ? 'min-h-44' : 'min-h-24', !day.in_month && 'bg-muted/20 text-muted-foreground', day.in_month && isLowBalance && 'bg-rose-50/60 dark:bg-rose-950/20', 
        // Selection is a ring, not a fill, on low-balance days: tinting the cell
        // would hide the negative-balance warning exactly when the user opens it.
        // Inset so the container's overflow-hidden never clips it on edge rows.
        selected && 'z-10 ring-2 ring-inset ring-primary/70', selected && !isLowBalance && 'bg-primary/5 dark:bg-primary/10', className), children: [_jsxs("div", { className: "flex items-center justify-between gap-1", children: [_jsx("span", { className: cn('inline-flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums', today && 'bg-primary text-primary-foreground', !today && day.in_month && 'text-foreground', !today && !day.in_month && 'text-muted-foreground'), children: displayDayNumber(day.date) }), _jsx(CalendarBadges, { day: day })] }), metric === 'balance' ? (_jsx("div", { className: "mt-3 flex items-center gap-1", children: _jsx("p", { title: mask(formatCurrency(day.ending_balance, currency, locale)), className: cn('whitespace-nowrap text-sm tabular-nums', isLowBalance
                        ? 'rounded-full border border-rose-300 bg-rose-100 px-1.5 py-0.5 font-bold text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-300'
                        : 'font-semibold text-muted-foreground'), children: mask(compactCurrency(day.ending_balance, currency, locale)) }) })) : (_jsx(DayCellActivity, { day: day, currency: currency, locale: locale, mask: mask })), detailed && previewItems.length > 0 && (_jsxs("div", { className: "mt-3 space-y-1.5 pr-1", children: [previewItems.map((item) => (_jsx(DayPreviewRow, { item: item, locale: locale, mask: mask }, `${item.kind}-${item.id ?? item.recurring_id}-${item.date}`))), moreCount > 0 && (_jsx("p", { className: "truncate text-[11px] font-semibold text-muted-foreground", children: t('transactions.calendarMoreItems', { count: moreCount }) }))] }))] }));
}
// The row is only ~70px wide, which truncated descriptions to two or three characters.
// That carried no meaning and starved the amount, so the row now shows the category icon
// and the amount only. The description stays available on hover and in the selected-day
// panel. Projected items get a dashed border to read as not yet settled.
// Hard cap for the mobile preview description: sliced, not just CSS-truncated,
// so the row keeps a single line even on the narrowest screens.
const PREVIEW_DESCRIPTION_MAX_CHARS = 20;
function previewDescription(description) {
    if (description.length <= PREVIEW_DESCRIPTION_MAX_CHARS)
        return description;
    return `${description.slice(0, PREVIEW_DESCRIPTION_MAX_CHARS).trimEnd()}…`;
}
function DayPreviewRow({ item, locale, mask, showDescription = false, }) {
    const amount = signedAmount(item);
    const label = [item.description, item.category_name].filter(Boolean).join(' · ');
    return (_jsxs("div", { title: label, className: cn('flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] shadow-sm', item.kind === 'projected'
            ? 'border border-dashed border-violet-400/70 bg-violet-500/5 dark:border-violet-400/50'
            : 'bg-background/45 dark:bg-background/25'), children: [_jsx(CategoryIcon, { icon: item.category_icon ?? undefined, color: item.category_color ?? undefined, size: "xs" }), showDescription && (_jsx("span", { className: "min-w-0 flex-1 truncate whitespace-nowrap text-muted-foreground", children: previewDescription(item.description) })), _jsx("span", { className: cn('font-bold tabular-nums whitespace-nowrap', showDescription ? 'shrink-0' : 'min-w-0 flex-1 truncate text-right', amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'), children: mask(`${amount >= 0 ? '+' : '−'}${compactCurrency(Math.abs(item.amount), item.currency, locale)}`) })] }));
}
// Activity cells report what actually moved: green income and red expense, real
// amounts only. Projected amounts get a secondary violet line so a forecast never
// blends into settled money. A day with nothing at all gets a centred dash rather
// than a sentence: in a quiet month the same string repeated 30 times is noise,
// and the eye should land on the days that moved. A day whose only entry is a
// projection is not empty, so it shows the violet figure and no dash.
function DayCellActivity({ day, currency, locale, mask, align = 'left', }) {
    const { t } = useTranslation();
    const activity = dayActivity(day);
    const projectedParts = [
        activity.projectedIncome > 0 ? mask(`+${compactCurrency(activity.projectedIncome, currency, locale)}`) : null,
        activity.projectedExpense > 0 ? mask(`−${compactCurrency(activity.projectedExpense, currency, locale)}`) : null,
    ].filter(Boolean);
    if (!activity.hasActual && !activity.hasProjected) {
        return (_jsxs("div", { className: cn('flex items-center text-muted-foreground/40', align === 'right' ? 'mt-0 justify-end' : 'flex-1 justify-center'), children: [_jsx(Minus, { size: 16, "aria-hidden": "true" }), _jsx("span", { className: "sr-only", children: t('transactions.calendarNoMovements') })] }));
    }
    return (_jsxs("div", { className: cn('mt-3 space-y-0.5', align === 'right' && 'mt-0 text-right'), children: [activity.hasActual && (_jsxs("p", { className: cn('flex flex-wrap items-center gap-x-1.5 text-sm font-semibold tabular-nums', align === 'right' && 'justify-end'), children: [activity.actualIncome > 0 && (_jsx("span", { className: "text-emerald-600 dark:text-emerald-400", children: mask(`+${compactCurrency(activity.actualIncome, currency, locale)}`) })), activity.actualExpense > 0 && (_jsx("span", { className: "text-rose-600 dark:text-rose-400", children: mask(`−${compactCurrency(activity.actualExpense, currency, locale)}`) }))] })), projectedParts.length > 0 && (_jsx("p", { title: t('transactions.calendarProjected'), className: "text-[11px] font-semibold tabular-nums text-violet-600 dark:text-violet-300", children: projectedParts.join(' · ') }))] }));
}
// Markers stay on one line beside the day number. A cell header is ~100px wide and the
// date takes 28px, so the four badges are sized to fit the remainder rather than wrap
// onto a second row, which used to push the balance chip down. They render the same
// in both metrics so a day always reads the same way regardless of the toggle.
function CalendarBadges({ day }) {
    const { t } = useTranslation();
    return (_jsxs("div", { className: "flex shrink-0 items-center gap-0.5", children: [day.has_income && _jsx(BadgeDot, { tone: "income", label: t('transactions.summaryIncome') }), day.has_expense && _jsx(BadgeDot, { tone: "expense", label: t('transactions.summaryExpenses') }), day.has_transfer && (_jsx(BadgeDot, { tone: "transfer", label: t('transactions.transfer'), children: _jsx(ArrowLeftRight, { size: 9 }) })), day.projected_count > 0 && (_jsx(BadgeDot, { tone: "projected", label: t('transactions.calendarProjected'), children: _jsx(CalendarDays, { size: 9 }) }))] }));
}
function BadgeDot({ tone, label, children, }) {
    return (_jsx("span", { title: label, "aria-label": label, className: cn('inline-flex size-3.5 shrink-0 items-center justify-center rounded border bg-background/80 shadow-sm', tone === 'income' && 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400', tone === 'expense' && 'border-rose-500/40 text-rose-600 dark:text-rose-400', tone === 'transfer' && 'border-sky-500/40 text-sky-600 dark:text-sky-400', tone === 'projected' && 'border-violet-500/40 text-violet-600 dark:text-violet-300'), children: children ?? _jsx(CircleDot, { size: 9 }) }));
}
function MobileDayRow({ day, selected, panelId, currency, locale, dateLocale, mask, density, metric, onSelect, }) {
    const { t } = useTranslation();
    const isLowBalance = metric === 'balance' && day.ending_balance < 0;
    const previewItems = density === 'detailed' ? day.items.slice(0, 3) : [];
    const moreCount = density === 'detailed' ? Math.max(0, day.items.length - previewItems.length) : 0;
    return (_jsxs("button", { type: "button", onClick: onSelect, "aria-expanded": selected, "aria-controls": selected ? panelId : undefined, className: cn('w-full border-l-4 border-transparent px-4 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary', isLowBalance && !selected && 'bg-rose-50/75 dark:bg-rose-950/25', selected && 'border-primary bg-primary/10 dark:bg-primary/15'), children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: parseLocalDate(day.date).toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric', month: 'short' }) }), _jsx("p", { className: "text-xs text-muted-foreground", children: t('transactions.calendarItemCount', { count: day.actual_count + day.projected_count }) })] }), _jsxs("div", { className: "flex flex-col items-end gap-0.5 text-right", children: [metric === 'balance' ? (_jsx("p", { className: cn('text-sm font-bold tabular-nums', day.ending_balance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'), children: mask(formatCurrency(day.ending_balance, currency, locale)) })) : (_jsx(DayCellActivity, { day: day, currency: currency, locale: locale, mask: mask, align: "right" })), _jsx(CalendarBadges, { day: day })] })] }), previewItems.length > 0 && (_jsxs("div", { className: "mt-2 space-y-1.5", children: [previewItems.map((item) => (_jsx(DayPreviewRow, { item: item, locale: locale, mask: mask, showDescription: true }, `${item.kind}-${item.id ?? item.recurring_id}-${item.date}`))), moreCount > 0 && (_jsx("p", { className: "truncate text-[11px] font-semibold text-muted-foreground", children: t('transactions.calendarMoreItems', { count: moreCount }) }))] }))] }));
}
function SelectedDayPanel({ id, variant, day, currency, locale, dateLocale, mask, metric, accountById, userCurrency, onOpenTransaction, }) {
    const { t } = useTranslation();
    if (!day)
        return null;
    const activity = dayActivity(day);
    const headline = metric === 'balance' ? day.ending_balance : activity.actualNet;
    const headlineLabel = metric === 'balance'
        ? mask(formatCurrency(day.ending_balance, currency, locale))
        : mask(`${activity.actualNet >= 0 ? '+' : '−'}${formatCurrency(Math.abs(activity.actualNet), currency, locale)}`);
    return (_jsxs("aside", { id: id, className: cn('bg-card overflow-hidden', variant === 'mobile' && 'mx-3 mt-2 mb-3 rounded-xl border border-border shadow-sm md:hidden', variant === 'desktop' && 'hidden rounded-xl border border-border shadow-sm md:sticky md:top-4 md:max-h-[calc(100vh-7rem)] md:w-[320px] md:shrink-0 md:self-start md:flex md:flex-col lg:w-[340px]'), children: [_jsx("div", { className: "px-4 py-4 border-b border-border", children: _jsxs("div", { className: "flex items-end justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: metric === 'balance' ? t('transactions.calendarSelectedDay') : t('transactions.calendarActualNet') }), _jsx("h3", { className: "truncate text-lg font-bold text-foreground", children: parseLocalDate(day.date).toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' }) })] }), _jsx("p", { title: headlineLabel, className: cn('shrink-0 text-right text-lg font-bold tabular-nums', headline < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'), children: headlineLabel })] }) }), metric === 'activity' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-2 border-b border-border px-4 py-3", children: [_jsx(DayPanelRow, { label: t('transactions.summaryIncome'), value: mask(`+${formatCurrency(activity.actualIncome, currency, locale)}`), amount: activity.actualIncome }), _jsx(DayPanelRow, { label: t('transactions.summaryExpenses'), value: mask(`−${formatCurrency(activity.actualExpense, currency, locale)}`), amount: -activity.actualExpense }), day.has_transfer && (_jsxs("p", { className: "flex items-center gap-1.5 pt-0.5 text-xs text-muted-foreground", children: [_jsx(ArrowLeftRight, { size: 12, className: "shrink-0 text-sky-600 dark:text-sky-400" }), t('transactions.calendarTransfersExcluded')] }))] }), activity.hasProjected && (_jsxs("div", { className: "space-y-2 border-b border-border px-4 py-3", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400", children: t('transactions.calendarProjected') }), activity.projectedIncome > 0 && (_jsx(DayPanelRow, { label: t('transactions.summaryIncome'), value: mask(`+${formatCurrency(activity.projectedIncome, currency, locale)}`), amount: activity.projectedIncome })), activity.projectedExpense > 0 && (_jsx(DayPanelRow, { label: t('transactions.summaryExpenses'), value: mask(`−${formatCurrency(activity.projectedExpense, currency, locale)}`), amount: -activity.projectedExpense })), activity.projectedIncome > 0 && activity.projectedExpense > 0 && (_jsx(DayPanelRow, { label: t('transactions.summaryNet'), value: mask(`${activity.projectedNet >= 0 ? '+' : '−'}${formatCurrency(Math.abs(activity.projectedNet), currency, locale)}`), amount: activity.projectedNet }))] }))] })), _jsx("div", { className: "min-h-0 divide-y divide-border overflow-y-auto md:flex-1", children: day.items.length === 0 ? (_jsx("p", { className: "px-4 py-8 text-sm text-muted-foreground text-center", children: t('transactions.calendarNoItems') })) : (day.items.map((item) => (_jsx(CalendarItemRow, { item: item, account: item.account_id ? accountById.get(item.account_id) : undefined, locale: locale, userCurrency: userCurrency, mask: mask, onOpenTransaction: onOpenTransaction }, `${item.kind}-${item.id ?? item.recurring_id}-${item.date}`)))) })] }));
}
// One label/value line, the shape the rest of the panel and the page already use.
// `amount` only picks the colour, so the caller stays free to format the string.
function DayPanelRow({ label, value, amount }) {
    return (_jsxs("div", { className: "flex items-center justify-between gap-3 text-sm", children: [_jsx("span", { className: "text-muted-foreground", children: label }), _jsx("span", { className: cn('font-semibold tabular-nums', amount < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'), children: value })] }));
}
// Mirrors MobileTransactionRow so a transaction reads the same in the list and
// in the calendar: category icon, description with inline badges, account row,
// colour-coded signed amount with the primary-currency conversion underneath.
function CalendarItemRow({ item, account, locale, userCurrency, mask, onOpenTransaction, }) {
    const { t } = useTranslation();
    const interactive = isCalendarItemInteractive(item);
    const amountColor = item.is_ignored
        ? 'text-gray-500'
        : item.type === 'credit'
            ? 'text-emerald-600'
            : 'text-rose-500';
    return (_jsxs("button", { type: "button", disabled: !interactive, onClick: () => { if (item.id)
            onOpenTransaction(item.id); }, className: cn('w-full flex items-center gap-3 pl-3 pr-3 py-3 text-left', interactive
            ? 'hover:bg-muted/50 active:bg-muted/60 transition-colors'
            : 'cursor-default opacity-80'), children: [_jsx("div", { className: "shrink-0", children: _jsx(CategoryIcon, { icon: item.category_icon ?? undefined, color: item.category_color ?? undefined, size: "md" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("p", { className: "text-sm font-semibold text-foreground truncate leading-tight", children: item.description }), item.kind === 'projected' && item.source === 'recurring' && item.status !== 'pending' && (_jsx(ProjectedTransactionBadge, {})), item.is_transfer && (_jsx(ArrowLeftRight, { className: "h-3 w-3 text-blue-600 shrink-0" })), item.is_ignored && (_jsx(EyeClosed, { className: "h-3 w-3 text-gray-500 shrink-0" })), item.exclude_from_pnl && !item.is_ignored && (_jsx(ChartNoAxesColumn, { className: "h-3 w-3 text-slate-500 shrink-0", "aria-label": t('transactions.excludedFromReports') })), shouldShowPendingBadge(item) && (_jsx("span", { title: t('transactions.pending'), className: "shrink-0 inline-flex items-center justify-center rounded-full border border-amber-200 bg-amber-50 p-0.5 dark:border-amber-500/30 dark:bg-amber-500/10", children: _jsx(Clock, { size: 12, className: "text-amber-500", role: "img", "aria-label": t('transactions.pending') }) }))] }), (account || item.account_name) && (_jsxs("div", { className: "flex items-center gap-1.5 mt-0.5", children: [account && _jsx(AccountIcon, { account: account, size: "xs" }), _jsx("span", { className: "text-xs text-muted-foreground truncate", children: account ? getAccountName(account) : item.account_name })] }))] }), _jsxs("div", { className: "shrink-0 text-right", children: [_jsx("span", { className: cn('text-sm font-bold tabular-nums', amountColor), children: mask(`${item.is_ignored ? ' ' : item.type === 'credit' ? '+' : '−'}${formatCurrency(Math.abs(item.amount), item.currency, locale)}`) }), item.amount_primary != null && item.currency !== userCurrency && (_jsx("div", { className: "text-[10px] text-muted-foreground tabular-nums mt-0.5", children: mask(formatCurrency(Math.abs(item.amount_primary), userCurrency, locale)) }))] })] }));
}
