import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Pencil, Trash2 } from 'lucide-react';
import { payees as payeesApi, transactions as transactionsApi } from '../lib/api.js';
import { Button } from './ui/button.js';
import { Skeleton } from './ui/skeleton.js';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, } from './ui/dialog.js';
import { useDisplayLocale, useDateLocale } from '../hooks/use-display-locale.js';
import { usePrivacyMode } from '../hooks/use-privacy-mode.js';
import { useAuth } from '../contexts/auth-context.js';
import { formatCurrency } from '../lib/format.js';
/** What we know about one counterparty, opened from the list.
 *
 *  Takes the whole payee rather than an id so the title is right on the first
 *  frame: the row the user just clicked already carries the name, and a
 *  spinner where the name goes is a spinner over the one thing they came for.
 */
export function PayeeDetailDialog({ payee, canWrite, onOpenChange, onEdit, onDelete, }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const { mask } = usePrivacyMode();
    const { user } = useAuth();
    const userCurrency = user?.preferences?.currency_display ?? 'USD';
    // Closing sets `payee` to null while Radix is still playing the exit
    // animation. Holding the last one keeps the content from blanking out
    // underneath the fade. Adjusted during render rather than in an effect:
    // that is React's own answer for state derived from a changing prop.
    const [lastPayee, setLastPayee] = useState(payee);
    if (payee && payee !== lastPayee)
        setLastPayee(payee);
    const shown = payee ?? lastPayee;
    const { data: summaryData, isLoading: summaryLoading } = useQuery({
        queryKey: ['payees', payee?.id, 'summary'],
        queryFn: () => payeesApi.summary(payee.id),
        enabled: !!payee,
    });
    const { data: recentTxData } = useQuery({
        queryKey: ['payees', payee?.id, 'recent-transactions'],
        queryFn: () => transactionsApi.list({ payee_id: payee.id, limit: 5 }),
        enabled: !!payee,
    });
    return (_jsx(Dialog, { open: !!payee, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "sm:max-w-lg flex flex-col max-h-[calc(100dvh-2rem)]", "aria-describedby": undefined, children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { className: "pr-8 break-words", children: shown?.name }) }), _jsx("div", { className: "space-y-3 overflow-y-auto flex-1 -mx-1 px-1", children: summaryLoading ? (_jsx(Skeleton, { className: "h-24 w-full" })) : summaryData ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-muted-foreground", children: t('payees.totalSpent') }), _jsx("p", { className: "text-lg font-bold text-rose-500 tabular-nums", children: mask(formatCurrency(summaryData.total_spent, userCurrency, locale)) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-muted-foreground", children: t('payees.totalReceived') }), _jsx("p", { className: "text-lg font-bold text-emerald-600 tabular-nums", children: mask(formatCurrency(summaryData.total_received, userCurrency, locale)) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-muted-foreground", children: t('payees.transactionCount') }), _jsx("p", { className: "text-lg font-bold tabular-nums", children: summaryData.transaction_count })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-muted-foreground", children: t('payees.lastTransaction') }), _jsx("p", { className: "text-sm font-medium", children: summaryData.last_transaction_date
                                                    ? new Date(summaryData.last_transaction_date + 'T00:00:00').toLocaleDateString(dateLocale)
                                                    : '—' })] })] }), summaryData.most_common_category && (_jsxs("p", { className: "text-xs text-muted-foreground", children: [t('payees.topCategory'), ": ", _jsx("span", { className: "font-medium text-foreground", children: summaryData.most_common_category.name })] })), recentTxData && recentTxData.items.length > 0 && (_jsxs("div", { className: "pt-3 border-t border-border space-y-2", children: [_jsx("p", { className: "text-xs font-medium text-muted-foreground", children: t('dashboard.recentTransactions') }), _jsx("div", { className: "divide-y divide-border rounded-lg border border-border overflow-hidden", children: recentTxData.items.map((tx) => (_jsxs("div", { className: "flex items-center justify-between px-3 py-2 bg-background text-sm", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-foreground truncate", children: tx.description }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [new Date(tx.date + 'T00:00:00').toLocaleDateString(dateLocale), tx.category?.name && _jsxs(_Fragment, { children: [" \u00B7 ", tx.category.name] })] })] }), _jsx("span", { className: `text-sm font-semibold tabular-nums ml-3 ${tx.type === 'debit' ? 'text-rose-500' : 'text-emerald-600'}`, children: mask(formatCurrency(tx.amount, tx.currency, locale)) })] }, tx.id))) }), summaryData.transaction_count > 0 && (_jsxs(Button, { variant: "ghost", size: "sm", className: "w-full text-xs text-muted-foreground hover:text-foreground gap-1", onClick: () => {
                                            // Close first: navigating out from inside the dialog
                                            // leaves the scroll lock mounted over the next route.
                                            onOpenChange(false);
                                            navigate(`/transactions?payee_id=${summaryData.payee.id}`);
                                        }, children: [t('payees.viewAllTransactions', { count: summaryData.transaction_count }), _jsx(ArrowRight, { size: 12 })] }))] }))] })) : null }), canWrite && shown && (_jsxs(DialogFooter, { className: "flex justify-between sm:justify-between", children: [_jsxs(Button, { variant: "destructive", onClick: () => onDelete(shown), children: [_jsx(Trash2, { size: 14, className: "mr-1" }), t('common.delete')] }), _jsxs(Button, { variant: "outline", onClick: () => onEdit(shown), children: [_jsx(Pencil, { size: 14, className: "mr-1" }), t('common.edit')] })] }))] }) }));
}
