import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from 'recharts';
import { formatCurrency } from '../../lib/format.js';
/**
 * In-chat chart, rendered when an assistant message contains a fenced
 * code block tagged `securo-chart`. The body is JSON in this shape:
 *
 *   { type: "line"|"bar"|"area"|"pie", title?, currency?, data, series? }
 *
 * Multi-series example:
 *   {
 *     "type": "line",
 *     "title": "Income vs expenses",
 *     "currency": "BRL",
 *     "data": [{"x":"Jan","income":3000,"expense":1800}, ...],
 *     "series": [
 *       {"key":"income","name":"Income","color":"#10B981"},
 *       {"key":"expense","name":"Expense","color":"#F43F5E"}
 *     ]
 *   }
 *
 * Single-series shorthand (no `series` array, default key is `y`):
 *   { "type":"bar", "data":[{"x":"Food","y":500},{"x":"Rent","y":1200}] }
 *
 * Pie:
 *   { "type":"pie", "data":[{"name":"Food","value":500},{"name":"Rent","value":1200}] }
 */
// Same palette as reports.tsx so chats look like the rest of the app.
const PALETTE = [
    '#6366F1', // indigo
    '#10B981', // emerald
    '#F59E0B', // amber
    '#F43F5E', // rose
    '#8B5CF6', // violet
    '#06B6D4', // cyan
    '#EC4899', // pink
    '#84CC16', // lime
];
const tooltipStyle = {
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    fontSize: 12,
};
function formatY(v, currency) {
    if (v == null)
        return '';
    if (typeof v === 'string')
        return v;
    if (currency)
        return formatCurrency(v, currency, undefined);
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(v);
}
/**
 * Compact axis labels — "R$100K", "R$1.2M", "12K" — so big numbers
 * actually fit in the axis gutter. Tooltips still get the full
 * precision via formatY().
 */
function formatYAxis(v, currency) {
    if (v == null)
        return '';
    if (typeof v === 'string')
        return v;
    if (Math.abs(v) < 1000) {
        if (currency) {
            try {
                return new Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency,
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                }).format(v);
            }
            catch {
                return `${currency} ${v.toFixed(0)}`;
            }
        }
        return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(v);
    }
    if (currency) {
        try {
            return new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency,
                notation: 'compact',
                maximumFractionDigits: 1,
            }).format(v);
        }
        catch {
            return `${currency} ${v}`;
        }
    }
    return new Intl.NumberFormat(undefined, {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(v);
}
function AgentChartImpl({ spec }) {
    const { t } = useTranslation();
    if (!spec || !Array.isArray(spec.data) || spec.data.length === 0) {
        return (_jsx("div", { className: "my-3 rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground text-center", children: t('agents.chart.noData') }));
    }
    const series = spec.series && spec.series.length > 0
        ? spec.series
        : [{ key: 'y' }];
    const seriesWithColor = series.map((s, i) => ({ ...s, color: s.color || PALETTE[i % PALETTE.length] }));
    return (_jsxs("figure", { className: "my-3 rounded-lg border border-border bg-card overflow-hidden", children: [(spec.title || spec.subtitle) && (_jsxs("figcaption", { className: "px-3 py-2 border-b border-border", children: [spec.title && _jsx("div", { className: "text-sm font-semibold", children: spec.title }), spec.subtitle && _jsx("div", { className: "text-xs text-muted-foreground mt-0.5", children: spec.subtitle })] })), _jsx("div", { className: "h-[260px] px-2 pt-3 pb-2", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: renderChart(spec.type, spec.data, seriesWithColor, spec.currency) }) })] }));
}
function renderChart(type, data, series, currency) {
    if (type === 'pie') {
        // Pie expects { name, value } shape. Map a friendly fallback.
        const items = data.map((d, i) => ({
            name: String(d.name ?? d.x ?? d.label ?? `Slice ${i + 1}`),
            value: Number(d.value ?? d.y ?? 0),
        }));
        return (_jsxs(PieChart, { children: [_jsx(Pie, { data: items, dataKey: "value", nameKey: "name", outerRadius: 90, innerRadius: 48, paddingAngle: 1, stroke: "var(--background)", strokeWidth: 1.5, children: items.map((_, i) => (_jsx(Cell, { fill: PALETTE[i % PALETTE.length] }, i))) }), _jsx(Tooltip, { contentStyle: tooltipStyle, formatter: (v) => formatY(v, currency) }), _jsx(Legend, { wrapperStyle: { fontSize: 11 } })] }));
    }
    const ChartCmp = type === 'bar' ? BarChart : type === 'area' ? AreaChart : LineChart;
    return (_jsxs(ChartCmp, { data: data, margin: { top: 4, right: 12, left: 0, bottom: 0 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "var(--border)", vertical: false }), _jsx(XAxis, { dataKey: "x", tick: { fontSize: 10, fill: 'var(--muted-foreground)' }, axisLine: false, tickLine: false, interval: "preserveStartEnd" }), _jsx(YAxis, { tickFormatter: (v) => formatYAxis(v, currency), tick: { fontSize: 10, fill: 'var(--muted-foreground)' }, axisLine: false, tickLine: false, width: 56, tickCount: 5 }), _jsx(Tooltip, { contentStyle: tooltipStyle, formatter: (v, name) => [formatY(v, currency), String(name ?? '')] }), series.length > 1 && _jsx(Legend, { wrapperStyle: { fontSize: 11 } }), series.map((s) => {
                const common = {
                    key: s.key,
                    dataKey: s.key,
                    name: s.name || s.key,
                    stroke: s.color,
                };
                if (type === 'bar') {
                    return _jsx(Bar, { dataKey: s.key, name: s.name || s.key, fill: s.color, radius: [4, 4, 0, 0] }, s.key);
                }
                if (type === 'area') {
                    return (_jsx(Area, { ...common, type: "monotone", fill: s.color, fillOpacity: 0.18, strokeWidth: 2, dot: false, activeDot: { r: 3 } }));
                }
                // line
                return (_jsx(Line, { ...common, type: "monotone", strokeWidth: 2, dot: false, activeDot: { r: 3 } }));
            })] }));
}
/** Memoized export. The whole reason this exists: every keystroke in
 *  the chat textarea triggers a parent re-render, and Recharts treats
 *  any new prop reference as new data — reanimating slices and bars.
 *  We compare specs by serialized string (cheap; specs are tiny JSON
 *  blobs the LLM emitted once) so a re-render with the same spec is a
 *  no-op. */
export const AgentChart = memo(AgentChartImpl, (prev, next) => JSON.stringify(prev.spec) === JSON.stringify(next.spec));
