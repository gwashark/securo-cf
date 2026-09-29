import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDisplayLocale, useDateLocale } from '../hooks/use-display-locale.js';
import { useQuery } from '@tanstack/react-query';
import { transactions as transactionsApi, dashboard, admin } from '../lib/api.js';
import { AlertTriangle, Clock, Info, Paperclip, X } from 'lucide-react';
import { CategoryIcon } from './category-icon.js';
import { ProjectedTransactionBadge } from './projected-transaction-badge.js';
import { sumDrillDownTotals } from '../lib/drill-down-totals.js';
import { hasOpenDialog, isInsideOverlayLayer } from '../lib/overlay-layers.js';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.js';
import { useAuth } from '../contexts/auth-context.js';
import { usePrivacyMode } from '../hooks/use-privacy-mode.js';
import { formatCurrency } from '../lib/format.js';
export function TransactionDrillDown({ filter, onClose, onTransactionClick, }) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { mask } = usePrivacyMode();
    const userCurrency = user?.preferences?.currency_display ?? 'USD';
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const panelRef = useRef(null);
    const { data, isLoading } = useQuery({
        queryKey: ['drill-down', filter],
        queryFn: () => transactionsApi.list({
            category_id: filter?.category_id,
            uncategorized: filter?.uncategorized,
            account_id: filter?.account_id,
            account_ids: filter?.account_ids,
            type: filter?.type,
            from: filter?.from,
            to: filter?.to,
            limit: 200,
            user_pnl_only: true,
        }),
        enabled: !!filter,
    });
    // Derive month param from filter.from for projected transactions
    const monthParam = filter?.from ? filter.from.slice(0, 7) + '-01' : undefined;
    const { data: projectedTxs } = useQuery({
        queryKey: ['dashboard', 'projected-transactions', monthParam],
        queryFn: () => dashboard.projectedTransactions({ month: monthParam }),
        enabled: !!filter && !!monthParam,
    });
    const { data: accountingModeData } = useQuery({
        queryKey: ['admin', 'accounting-mode'],
        queryFn: () => admin.accountingMode(),
        staleTime: 5 * 60 * 1000,
    });
    const isAccrual = accountingModeData?.mode === 'accrual';
    // Merge real + projected transactions, filtering projected by drill-down criteria
    const displayItems = useMemo(() => {
        const items = [];
        for (const tx of data?.items ?? []) {
            items.push({
                key: tx.id,
                description: tx.description,
                date: tx.date,
                type: tx.type,
                amount: Number(tx.amount),
                amountPrimary: tx.amount_primary != null ? Number(tx.amount_primary) : null,
                currency: tx.currency,
                categoryIcon: tx.category?.icon ?? null,
                categoryName: tx.category?.name ?? null,
                categoryColor: tx.category?.color ?? null,
                isProjected: false,
                isPending: tx.status === 'pending',
                attachmentCount: tx.attachment_count ?? 0,
                transaction: tx,
            });
        }
        for (const pt of projectedTxs ?? []) {
            // Filter projected txs by drill-down criteria
            if (filter?.type && pt.type !== filter.type)
                continue;
            if (filter?.category_id && String(pt.category_id) !== filter.category_id)
                continue;
            if (filter?.uncategorized && pt.category_id != null)
                continue;
            if (filter?.from && pt.date < filter.from)
                continue;
            if (filter?.to && pt.date > filter.to)
                continue;
            items.push({
                key: `proj-${pt.recurring_id}-${pt.date}`,
                description: pt.description,
                date: pt.date,
                type: pt.type,
                amount: pt.amount,
                amountPrimary: pt.amount_primary ?? null,
                currency: pt.currency,
                categoryIcon: pt.category_icon,
                categoryName: pt.category_name,
                categoryColor: pt.category_color ?? null,
                isProjected: true,
                isPending: false,
                attachmentCount: 0,
                transaction: null,
            });
        }
        items.sort((a, b) => a.date.localeCompare(b.date));
        return items;
    }, [data, projectedTxs, filter]);
    // Close on Escape, unless the key belongs to a dialog opened from the
    // panel (Radix marks the Escape it handled as defaultPrevented).
    useEffect(() => {
        if (!filter)
            return;
        const handleKey = (e) => {
            if (e.key !== 'Escape' || e.defaultPrevented || hasOpenDialog())
                return;
            onClose();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [filter, onClose]);
    // Close on click outside. The transaction dialog opened from a row, and its
    // popovers and selects, are portaled to the body; clicks there keep the
    // panel open so the next row can be edited once the dialog closes.
    useEffect(() => {
        if (!filter)
            return;
        const handleClick = (e) => {
            if (!panelRef.current || panelRef.current.contains(e.target))
                return;
            if (isInsideOverlayLayer(e.target) || hasOpenDialog())
                return;
            onClose();
        };
        // Delay to avoid closing immediately from the click that opened it
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClick);
        }, 100);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClick);
        };
    }, [filter, onClose]);
    // Sum in user's primary currency. For foreign-currency rows we need
    // amount_primary; if it's missing we can't convert, so skip the row
    // instead of adding a raw foreign amount as if it were primary. This
    // matches how get_summary computes monthly_*_primary on the backend.
    const { absTotal, postedTotal, pendingTotal, projectedTotal } = sumDrillDownTotals(displayItems, userCurrency);
    // Break the total down whenever some of it is money that has not settled,
    // whether it is pending or still only projected. Gating on pending alone
    // hid the projected line from a panel that happened to have no pending row,
    // even though the total it sits under already counted the projection.
    const hasUnsettledTotal = pendingTotal > 0 || projectedTotal > 0;
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: `fixed inset-0 bg-black/20 z-40 transition-opacity duration-200 ${filter ? 'opacity-100' : 'opacity-0 pointer-events-none'}` }), _jsxs("div", { ref: panelRef, className: `fixed top-0 right-0 h-full w-full max-w-md bg-card shadow-2xl z-50 transform transition-transform duration-200 ease-out flex flex-col ${filter ? 'translate-x-0' : 'translate-x-full'}`, children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b border-border shrink-0", children: [_jsx("h2", { className: "text-sm font-semibold text-foreground truncate pr-4", children: filter?.title }), _jsx("button", { onClick: onClose, className: "w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0", title: t('common.close'), children: _jsx(X, { size: 16 }) })] }), isAccrual && filter?.from && (_jsxs("div", { className: "flex items-start gap-2 px-5 py-2.5 bg-muted/40 border-b border-border text-[11px] text-muted-foreground shrink-0", children: [_jsx(Info, { size: 12, className: "mt-0.5 shrink-0" }), _jsx("span", { children: t('dashboard.accrualNote') })] })), _jsx("div", { className: "flex-1 overflow-auto", children: isLoading ? (_jsx("div", { className: "p-5 space-y-3", children: Array.from({ length: 8 }).map((_, i) => (_jsx("div", { className: "h-12 bg-muted rounded-lg animate-pulse" }, i))) })) : displayItems.length === 0 ? (_jsx("p", { className: "text-muted-foreground text-sm text-center py-12", children: t('dashboard.drillDownEmpty') })) : (_jsx("div", { className: "divide-y divide-border", children: displayItems.map((item) => (_jsxs("div", { className: `flex items-center gap-3 px-5 py-3 hover:bg-muted transition-colors ${!item.isProjected ? 'cursor-pointer' : ''}`, onClick: () => {
                                    if (!item.isProjected && item.transaction) {
                                        onTransactionClick?.(item.transaction);
                                    }
                                }, children: [_jsx(CategoryIcon, { icon: item.categoryIcon, color: item.categoryColor, size: "lg" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("p", { className: "text-sm font-medium text-foreground truncate", children: item.description }), item.isProjected && (_jsx(ProjectedTransactionBadge, {})), item.isPending && (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "shrink-0 inline-flex items-center justify-center rounded-full border border-amber-200 bg-amber-50 p-0.5 dark:border-amber-500/30 dark:bg-amber-500/10", children: _jsx(Clock, { size: 12, className: "text-amber-500", role: "img", "aria-label": t('transactions.pending') }) }) }), _jsx(TooltipContent, { children: t('transactions.pending') })] })), item.attachmentCount > 0 && (_jsx(Paperclip, { size: 12, className: "text-muted-foreground shrink-0" }))] }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [new Date(item.date + 'T00:00:00').toLocaleDateString(dateLocale), item.categoryName && ` · ${item.categoryName}`] })] }), _jsxs("div", { className: "text-right shrink-0", children: [_jsxs("span", { className: `text-sm font-semibold tabular-nums ${item.type === 'credit' ? 'text-emerald-600' : 'text-rose-500'}`, children: [item.type === 'credit' ? '+' : '-', mask(formatCurrency(Math.abs(item.amount), item.currency ?? userCurrency, locale))] }), item.currency !== userCurrency && item.amountPrimary != null && (_jsxs("div", { className: "flex items-center justify-end gap-1", children: [item.transaction?.fx_fallback && (_jsx("span", { title: t('transactions.fxFallbackTooltip'), children: _jsx(AlertTriangle, { size: 11, className: "text-amber-500 shrink-0" }) })), _jsx("span", { className: "text-[10px] text-muted-foreground tabular-nums", children: mask(formatCurrency(Math.abs(item.amountPrimary), userCurrency, locale)) })] }))] })] }, item.key))) })) }), displayItems.length > 0 && (_jsx("div", { className: "px-5 py-3 border-t border-border bg-muted/50 shrink-0", children: hasUnsettledTotal ? (_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex items-center justify-between gap-4 text-xs text-muted-foreground", children: [_jsx("span", { children: t('dashboard.drillDownSettledTotal') }), _jsx("span", { className: "tabular-nums text-foreground", children: mask(formatCurrency(postedTotal, userCurrency, locale)) })] }), _jsxs("div", { className: "flex items-center justify-between gap-4 text-xs text-muted-foreground", children: [_jsx("span", { children: t('dashboard.drillDownPendingTotal') }), _jsx("span", { className: "tabular-nums text-foreground", children: mask(formatCurrency(pendingTotal, userCurrency, locale)) })] }), projectedTotal > 0 && (_jsxs("div", { className: "flex items-center justify-between gap-4 text-xs text-muted-foreground", children: [_jsx("span", { children: t('transactions.projected') }), _jsx("span", { className: "tabular-nums text-foreground", children: mask(formatCurrency(projectedTotal, userCurrency, locale)) })] })), _jsxs("div", { className: "flex items-center justify-between gap-4 border-t border-border pt-2 mt-2", children: [_jsx("span", { className: "text-xs font-medium text-muted-foreground", children: t('dashboard.drillDownShownTotal') }), _jsx("span", { className: "text-sm font-bold tabular-nums text-foreground", children: mask(formatCurrency(absTotal, userCurrency, locale)) })] })] })) : (_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs text-muted-foreground", children: t('dashboard.drillDownTotal', {
                                        count: displayItems.length,
                                        total: mask(formatCurrency(absTotal, userCurrency, locale)),
                                    }) }), _jsx("span", { className: "text-sm font-bold tabular-nums text-foreground", children: mask(formatCurrency(absTotal, userCurrency, locale)) })] })) }))] })] }));
}
