import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sankey as d3Sankey, sankeyLinkHorizontal, sankeyJustify, } from 'd3-sankey';
import { usePrivacyMode } from '../../hooks/use-privacy-mode.js';
// Colour carries MEANING, not category identity: green = money in, red = money
// out, gray = uncategorised/folded. Tinting by category (the old approach) made
// a green "Groceries" expense look like green "Salary" income — the direction of
// flow was invisible. Category identity is carried by the always-on labels
// instead. Links fade from their source colour to their target colour, so an
// expense flow visibly turns from green (cash flow) to red at the category.
const INCOME_COLOR = '#10B981'; // emerald — money in
const EXPENSE_COLOR = '#F43F5E'; // rose — money out
const INVEST_COLOR = '#0EA5E9'; // sky blue — money set aside (investments)
const CENTER_COLOR = '#059669'; // deeper emerald — the cash-flow hub
const SURPLUS_COLOR = '#10B981'; // emerald — leftover income
const DEFICIT_COLOR = '#F59E0B'; // amber — overspend drawn from reserves
const NEUTRAL_COLOR = '#9CA3AF'; // gray — uncategorised / folded long tail
// Keep the diagram legible: personal-finance Sankeys read best at ~a dozen
// streams per side. Beyond this we fold the smallest categories into "Other".
const MAX_NODES_PER_SIDE = 9;
const NODE_WIDTH = 16;
const NODE_PADDING = 16;
// Vertical space a two-line label (name + amount) needs; labels are pushed
// apart to at least this gap so thin adjacent nodes stay readable.
const LABEL_MIN_GAP = 26;
const TOP_GUTTER = 30; // header room above the nodes for the centre label
function formatMoney(value, currency, locale, compact) {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        notation: compact ? 'compact' : 'standard',
        maximumFractionDigits: compact ? 1 : 0,
    }).format(value);
}
/** Sort largest-first, then fold everything past the cap into a single "Other". */
function collapse(items, otherLabel) {
    const sorted = [...items].sort((a, b) => b.value - a.value);
    if (sorted.length <= MAX_NODES_PER_SIDE)
        return sorted;
    const top = sorted.slice(0, MAX_NODES_PER_SIDE - 1);
    const rest = sorted.slice(MAX_NODES_PER_SIDE - 1);
    const otherValue = rest.reduce((s, c) => s + c.value, 0);
    return [
        ...top,
        { key: 'other', label: otherLabel, value: otherValue, color: NEUTRAL_COLOR, group: rest[0].group },
    ];
}
export function CashflowSankey({ composition, currency, locale }) {
    const { t } = useTranslation();
    const { privacyMode, MASK } = usePrivacyMode();
    const containerRef = useRef(null);
    const [width, setWidth] = useState(0);
    const [hover, setHover] = useState(null);
    useEffect(() => {
        const el = containerRef.current;
        if (!el)
            return;
        const observer = new ResizeObserver((entries) => {
            setWidth(entries[0].contentRect.width);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    const { nodes: rawNodes, links: rawLinks, hasData } = useMemo(() => {
        const income = collapse(composition.filter((c) => c.group === 'income' && c.value > 0), t('reports.other'));
        const expense = collapse(composition.filter((c) => c.group === 'expenses' && c.value > 0), t('reports.other'));
        // Investments are a third outflow lane — money set aside, neither spent nor
        // surplus. Treated like Sure's "Investment Contributions" node.
        const investment = collapse(composition.filter((c) => c.group === 'investments' && c.value > 0), t('reports.other'));
        if (income.length === 0 && expense.length === 0 && investment.length === 0) {
            return { nodes: [], links: [], hasData: false };
        }
        const totalIncome = income.reduce((s, c) => s + c.value, 0);
        const totalExpense = expense.reduce((s, c) => s + c.value, 0);
        const totalInvest = investment.reduce((s, c) => s + c.value, 0);
        // Surplus is what's left after BOTH spending and investing — so investing
        // shrinks surplus instead of silently inflating it.
        const net = totalIncome - totalExpense - totalInvest;
        const nodes = [];
        const links = [];
        const indexOf = new Map();
        const pushNode = (n) => {
            indexOf.set(n.id, nodes.length);
            nodes.push(n);
            return nodes.length - 1;
        };
        const labelFor = (c) => c.key === 'uncategorized' ? t('reports.uncategorized')
            : c.key === 'other' ? t('reports.other')
                : c.label;
        const isNeutral = (c) => c.key === 'uncategorized' || c.key === 'other';
        income.forEach((c, i) => pushNode({
            id: `in-${c.key}-${i}`,
            name: labelFor(c),
            color: isNeutral(c) ? NEUTRAL_COLOR : INCOME_COLOR,
            side: 'income',
        }));
        // Deficit appears as an inflow on the income side so the centre balances.
        if (net < 0) {
            pushNode({ id: 'deficit', name: t('reports.deficit'), color: DEFICIT_COLOR, side: 'income' });
        }
        const centerIdx = pushNode({
            id: 'center',
            name: t('reports.cashFlowNode'),
            color: CENTER_COLOR,
            side: 'center',
        });
        // Right column, top → bottom: expenses (red), investments (teal), surplus
        // (green) — matching the centre bar's stacked split.
        expense.forEach((c, i) => pushNode({
            id: `ex-${c.key}-${i}`,
            name: labelFor(c),
            color: isNeutral(c) ? NEUTRAL_COLOR : EXPENSE_COLOR,
            side: 'expense',
        }));
        investment.forEach((c, i) => pushNode({
            id: `inv-${c.key}-${i}`,
            name: c.key === 'other' ? t('reports.other') : c.label,
            color: c.key === 'other' ? NEUTRAL_COLOR : INVEST_COLOR,
            side: 'investment',
        }));
        if (net > 0) {
            pushNode({ id: 'surplus', name: t('reports.surplus'), color: SURPLUS_COLOR, side: 'expense' });
        }
        income.forEach((c, i) => links.push({ source: indexOf.get(`in-${c.key}-${i}`), target: centerIdx, value: c.value }));
        if (net < 0) {
            links.push({ source: indexOf.get('deficit'), target: centerIdx, value: -net });
        }
        expense.forEach((c, i) => links.push({ source: centerIdx, target: indexOf.get(`ex-${c.key}-${i}`), value: c.value }));
        investment.forEach((c, i) => links.push({ source: centerIdx, target: indexOf.get(`inv-${c.key}-${i}`), value: c.value }));
        if (net > 0) {
            links.push({ source: centerIdx, target: indexOf.get('surplus'), value: net });
        }
        return { nodes, links, hasData: true };
    }, [composition, t]);
    // Tall enough that the busier side's nodes don't crowd; grows with node count.
    const maxSide = useMemo(() => {
        const incomeCount = rawNodes.filter((n) => n.side === 'income').length;
        const outflowCount = rawNodes.filter((n) => n.side === 'expense' || n.side === 'investment').length;
        return Math.max(incomeCount, outflowCount, 1);
    }, [rawNodes]);
    const height = Math.min(780, Math.max(380, maxSide * 60));
    const layout = useMemo(() => {
        if (!hasData || width === 0)
            return null;
        const generator = d3Sankey()
            .nodeWidth(NODE_WIDTH)
            .nodePadding(NODE_PADDING)
            .nodeAlign(sankeyJustify)
            .extent([
            [8, TOP_GUTTER],
            [width - 8, height - 14],
        ]);
        // d3-sankey mutates its input — clone so re-renders stay pure.
        return generator({
            nodes: rawNodes.map((n) => ({ ...n })),
            links: rawLinks.map((l) => ({ ...l })),
        });
    }, [rawNodes, rawLinks, width, height, hasData]);
    // Always-on labels: place each node's label and push overlapping neighbours
    // apart per column so even a 1px-tall node keeps a readable name + amount.
    const labelY = useMemo(() => {
        const pos = new Map();
        if (!layout)
            return pos;
        for (const left of [true, false]) {
            const column = layout.nodes
                .filter((n) => n.id !== 'center')
                .filter((n) => ((n.x0 ?? 0) < width / 2) === left)
                .sort((a, b) => ((a.y0 + a.y1) / 2) - ((b.y0 + b.y1) / 2));
            let prev = -Infinity;
            for (const n of column) {
                let y = (n.y0 + n.y1) / 2;
                if (y < prev + LABEL_MIN_GAP)
                    y = prev + LABEL_MIN_GAP;
                pos.set(n.index, y);
                prev = y;
            }
        }
        return pos;
    }, [layout, width]);
    // Resolve the current hover into the exact set of links/nodes to keep lit.
    const { activeLinks, activeNodes } = useMemo(() => {
        const links = new Set();
        const nodes = new Set();
        if (layout && hover) {
            layout.links.forEach((lk, i) => {
                const s = lk.source;
                const tg = lk.target;
                let on = false;
                if (hover.kind === 'node')
                    on = s.index === hover.index || tg.index === hover.index;
                else if (hover.kind === 'expenses')
                    on = s.id === 'center' && tg.side === 'expense' && tg.id !== 'surplus';
                else if (hover.kind === 'investments')
                    on = s.id === 'center' && tg.side === 'investment';
                else if (hover.kind === 'surplus')
                    on = tg.id === 'surplus';
                if (on) {
                    links.add(i);
                    nodes.add(s.index);
                    nodes.add(tg.index);
                }
            });
        }
        return { activeLinks: links, activeNodes: nodes };
    }, [layout, hover]);
    if (!hasData) {
        return (_jsx("p", { className: "text-muted-foreground text-sm text-center py-16", children: t('reports.noData') }));
    }
    const linkPath = sankeyLinkHorizontal();
    // Percentages are relative to total cash-flow throughput — the centre node's
    // value (d3-sankey sets it to the larger of its in/out sums).
    const total = layout?.nodes.find((n) => n.id === 'center')?.value ?? 0;
    const fmtAmount = (v) => privacyMode ? MASK : formatMoney(v, currency, locale, true);
    // The centre bar's outflow split: spent (red) vs invested (teal) vs kept
    // (green). Links attach top→bottom in node order (expenses, investments,
    // surplus), so stacking the bar's colours in that order lines up with where
    // the flows actually leave the hub.
    const outBy = (pred) => layout
        ? layout.links
            .filter((l) => l.source.id === 'center' && pred(l.target))
            .reduce((s, l) => s + l.value, 0)
        : 0;
    const expenseOut = outBy((n) => n.side === 'expense' && n.id !== 'surplus');
    const investOut = outBy((n) => n.side === 'investment');
    const surplusOut = outBy((n) => n.id === 'surplus');
    const linkDimmed = (i) => hover !== null && !activeLinks.has(i);
    const nodeDimmed = (idx) => hover !== null && !activeNodes.has(idx);
    return (_jsxs("div", { ref: containerRef, className: "w-full privacy-sensitive", children: [layout && (_jsxs("svg", { width: width, height: height, role: "img", "aria-label": t('reports.flowChartAria'), onMouseLeave: () => setHover(null), children: [_jsx("defs", { children: layout.links.map((link, i) => {
                            const src = link.source;
                            const tgt = link.target;
                            return (_jsxs("linearGradient", { id: `flow-grad-${i}`, gradientUnits: "userSpaceOnUse", x1: src.x1, x2: tgt.x0, children: [_jsx("stop", { offset: "0%", stopColor: src.color }), _jsx("stop", { offset: "100%", stopColor: tgt.color })] }, i));
                        }) }), _jsx("g", { fill: "none", children: layout.links.map((link, i) => {
                            const dimmed = linkDimmed(i);
                            const active = hover !== null && activeLinks.has(i);
                            const pct = total > 0 ? ((link.value / total) * 100).toFixed(1) : '0';
                            return (_jsx("path", { d: linkPath(link) ?? undefined, stroke: `url(#flow-grad-${i})`, strokeOpacity: dimmed ? 0.07 : active ? 0.6 : 0.4, strokeWidth: Math.max(1.5, link.width ?? 1), style: { transition: 'stroke-opacity 0.2s ease' }, children: _jsxs("title", { children: [link.target.id === 'center'
                                            ? link.source.name
                                            : link.target.name, ": ", fmtAmount(link.value), " (", pct, "%)"] }) }, i));
                        }) }), _jsx("g", { children: layout.nodes.map((node, i) => {
                            const x0 = node.x0 ?? 0;
                            const x1 = node.x1 ?? 0;
                            const y0 = node.y0 ?? 0;
                            const y1 = node.y1 ?? 0;
                            const nodeHeight = Math.max(1, y1 - y0);
                            const isCenter = node.id === 'center';
                            const dimmed = nodeDimmed(i);
                            const nodeWidthPx = Math.max(1, x1 - x0);
                            // Centre bar is split into spent (red), invested (teal) and kept
                            // (green) zones, each its own hover target so the cursor can
                            // isolate ALL of that flow type at once. Label sits in the top
                            // gutter. Segments are stacked in the same order the links leave
                            // the hub (expenses, investments, surplus).
                            if (isCenter) {
                                const cx = (x0 + x1) / 2;
                                const out = expenseOut + investOut + surplusOut || 1;
                                const redH = nodeHeight * (expenseOut / out);
                                const tealH = nodeHeight * (investOut / out);
                                const segments = [
                                    { h: redH, fill: EXPENSE_COLOR, hover: { kind: 'expenses' }, title: t('reports.expenses'), val: expenseOut },
                                    { h: tealH, fill: INVEST_COLOR, hover: { kind: 'investments' }, title: t('reports.investments'), val: investOut },
                                    { h: Math.max(0, nodeHeight - redH - tealH), fill: SURPLUS_COLOR, hover: { kind: 'surplus' }, title: t('reports.surplus'), val: surplusOut },
                                ];
                                let segY = y0;
                                return (_jsxs("g", { style: { transition: 'opacity 0.2s ease', opacity: dimmed ? 0.4 : 1 }, children: [segments.filter((seg) => seg.val > 0).map((seg, si) => {
                                            const yy = segY;
                                            segY += seg.h;
                                            return (_jsx("rect", { x: x0, y: yy, width: nodeWidthPx, height: Math.max(1, seg.h), fill: seg.fill, rx: 4, style: { cursor: 'pointer' }, onMouseEnter: () => setHover(seg.hover), children: _jsxs("title", { children: [seg.title, ": ", fmtAmount(seg.val)] }) }, si));
                                        }), _jsxs("text", { x: cx, y: 10, textAnchor: "middle", className: "fill-foreground pointer-events-none", style: { fontSize: 11, fontWeight: 600 }, children: [node.name, _jsx("tspan", { x: cx, dy: 13, className: "fill-muted-foreground", style: { fontSize: 10, fontFamily: 'var(--font-mono, monospace)', fontWeight: 400 }, children: fmtAmount(node.value ?? 0) })] })] }, i));
                            }
                            const onLeft = x0 < width / 2;
                            const labelX = onLeft ? x1 + 8 : x0 - 8;
                            const ly = labelY.get(i) ?? (y0 + y1) / 2;
                            return (_jsxs("g", { style: { transition: 'opacity 0.2s ease', opacity: dimmed ? 0.35 : 1 }, onMouseEnter: () => setHover({ kind: 'node', index: i }), children: [_jsx("rect", { x: x0, y: y0, width: Math.max(1, x1 - x0), height: nodeHeight, fill: node.color, rx: 3, children: _jsxs("title", { children: [node.name, ": ", fmtAmount(node.value ?? 0)] }) }), _jsxs("text", { x: labelX, y: ly, textAnchor: onLeft ? 'start' : 'end', dominantBaseline: "middle", className: "fill-foreground", style: { fontSize: 11, fontWeight: 500 }, children: [node.name, _jsx("tspan", { x: labelX, dy: 13, className: "fill-muted-foreground", style: { fontSize: 10, fontFamily: 'var(--font-mono, monospace)' }, children: fmtAmount(node.value ?? 0) })] })] }, i));
                        }) })] })), _jsxs("table", { className: "sr-only", children: [_jsx("caption", { children: t('reports.flowChartAria') }), _jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: t('reports.category') }), _jsx("th", { children: t('reports.amount') })] }) }), _jsx("tbody", { children: rawNodes
                            .filter((n) => n.side !== 'center')
                            .map((n, i) => {
                            const idx = rawNodes.indexOf(n);
                            const value = layout?.nodes[idx]?.value ?? 0;
                            return (_jsxs("tr", { children: [_jsx("td", { children: n.name }), _jsx("td", { children: fmtAmount(value) })] }, i));
                        }) })] })] }));
}
