import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { getAccountName, sortAccountsByDisplayName } from '../lib/account-utils.js';
import { useTranslation } from 'react-i18next';
import { useDisplayLocale, useDateLocale } from '../hooks/use-display-locale.js';
import { useQuery } from '@tanstack/react-query';
import { Button } from './ui/button.js';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, } from './ui/dialog.js';
import { Skeleton } from './ui/skeleton.js';
import { ArrowRight, AlertTriangle, Info, ArrowLeft, Search, Sparkles } from 'lucide-react';
import { transactions as transactionsApi } from '../lib/api.js';
import { formatCurrency } from '../lib/format.js';
function CounterpartCard({ label, description, account, date, amount, currency, sign, locale, dateLocale }) {
    const colorClass = sign === '+' ? 'text-emerald-600' : 'text-rose-500';
    return (_jsxs("div", { className: "min-w-0 rounded-lg border border-border bg-muted/30 p-3", children: [_jsx("p", { className: "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1", children: label }), _jsx("p", { className: "text-sm font-semibold text-foreground truncate", title: description, children: description }), _jsx("p", { className: "text-xs text-muted-foreground truncate", children: account }), _jsx("p", { className: "text-xs text-muted-foreground mt-1", children: new Date(date + 'T00:00:00').toLocaleDateString(dateLocale) }), _jsxs("p", { className: `text-sm font-bold tabular-nums ${colorClass} mt-2`, children: [sign, formatCurrency(amount, currency, locale)] })] }));
}
export function LinkTransferDialog({ open, onClose, debit, credit, anchor, accounts, onConfirm, onCreateCounterpart, loading, }) {
    const { t } = useTranslation();
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const isDirectMode = !!(debit && credit);
    const isPickerMode = !!anchor && !isDirectMode;
    // In picker mode, the user clicks a candidate to "select" it; that promotes
    // us into a small confirm step which reuses the same FROM/TO card layout.
    const [pickedCandidate, setPickedCandidate] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    // Account chosen for auto-creating a counterpart when none exists yet.
    const [counterpartAccountId, setCounterpartAccountId] = useState('');
    // Reset internal picker state when the dialog opens with a new anchor or
    // when it transitions from open → closed. Done during render via the
    // "adjusting state on prop change" pattern to avoid effect cascades.
    const sessionKey = `${open ? '1' : '0'}-${anchor?.id ?? ''}`;
    const [prevSessionKey, setPrevSessionKey] = useState(sessionKey);
    if (sessionKey !== prevSessionKey) {
        setPrevSessionKey(sessionKey);
        setPickedCandidate(null);
        setSearchTerm('');
        setCounterpartAccountId('');
    }
    const { data: candidates, isLoading: candidatesLoading } = useQuery({
        queryKey: ['transfer-candidates', anchor?.id],
        queryFn: () => transactionsApi.transferCandidates(anchor.id),
        enabled: open && isPickerMode,
    });
    const filteredCandidates = useMemo(() => {
        if (!candidates)
            return [];
        const term = searchTerm.trim().toLowerCase();
        if (!term)
            return candidates;
        return candidates.filter((c) => c.description.toLowerCase().includes(term));
    }, [candidates, searchTerm]);
    // The "Best match" badge should only appear when the top-ranked candidate
    // is genuinely close to the anchor — same date neighborhood AND amount
    // close enough to suggest they're the same transfer (allowing for FX/fees).
    const bestMatchId = useMemo(() => {
        if (!candidates || candidates.length === 0 || !anchor)
            return null;
        const top = candidates[0];
        const anchorDate = new Date(anchor.date + 'T00:00:00').getTime();
        const candidateDate = new Date(top.date + 'T00:00:00').getTime();
        const dayDiff = Math.abs(candidateDate - anchorDate) / (1000 * 60 * 60 * 24);
        if (dayDiff > 3)
            return null;
        const anchorAmount = Math.abs(Number(anchor.amount_primary ?? anchor.amount));
        const topAmount = Math.abs(Number(top.amount_primary ?? top.amount));
        if (anchorAmount === 0)
            return null;
        const pctDiff = Math.abs(anchorAmount - topAmount) / anchorAmount;
        if (pctDiff > 0.02)
            return null;
        return top.id;
    }, [candidates, anchor]);
    // Resolve which transactions are currently shown as the FROM/TO pair.
    const effectiveDebit = useMemo(() => {
        if (isDirectMode)
            return debit ?? null;
        if (!anchor || !pickedCandidate)
            return null;
        return anchor.type === 'debit' ? anchor : pickedCandidate;
    }, [isDirectMode, debit, anchor, pickedCandidate]);
    const effectiveCredit = useMemo(() => {
        if (isDirectMode)
            return credit ?? null;
        if (!anchor || !pickedCandidate)
            return null;
        return anchor.type === 'credit' ? anchor : pickedCandidate;
    }, [isDirectMode, credit, anchor, pickedCandidate]);
    if (!open)
        return null;
    if (!isDirectMode && !isPickerMode)
        return null;
    // Picker view (no candidate selected yet)
    if (isPickerMode && !pickedCandidate) {
        const anchorAccount = accounts.find((a) => a.id === anchor.account_id);
        const anchorAmount = Math.abs(Number(anchor.amount));
        // Manual accounts (no bank connection) where we can auto-create the
        // counterpart, since a synced account would already have a real
        // transaction showing in the candidates list above.
        const manualCounterpartAccounts = sortAccountsByDisplayName(accounts.filter((a) => a.connection_id == null && a.id !== anchor.account_id));
        return (_jsx(Dialog, { open: open, onOpenChange: onClose, children: _jsxs(DialogContent, { className: "max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-4 sm:max-w-xl sm:p-6", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('transactions.linkTransferPickerTitle') }) }), _jsxs("div", { className: "min-h-0 min-w-0 space-y-4 overflow-y-auto overscroll-contain pr-1", children: [_jsx(DialogDescription, { children: t('transactions.linkTransferPickerDescription') }), _jsx(CounterpartCard, { label: t('transactions.linkTransferAnchor'), description: anchor.description, account: anchorAccount ? getAccountName(anchorAccount) : '—', date: anchor.date, amount: anchorAmount, currency: anchor.currency, sign: anchor.type === 'debit' ? '−' : '+', locale: locale, dateLocale: dateLocale }), _jsxs("div", { className: "relative", children: [_jsx(Search, { size: 14, className: "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" }), _jsx("input", { type: "text", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), placeholder: t('transactions.linkTransferSearchPlaceholder'), className: "w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border bg-card text-foreground focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]" })] }), _jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2", children: t('transactions.linkTransferCandidatesHeader') }), candidatesLoading ? (_jsx("div", { className: "space-y-2", children: Array.from({ length: 3 }).map((_, i) => (_jsx(Skeleton, { className: "h-14 w-full" }, i))) })) : filteredCandidates.length === 0 ? (_jsx("p", { className: "text-xs text-muted-foreground italic py-4 text-center", children: t('transactions.linkTransferNoCandidates') })) : (_jsx("ul", { className: "max-h-72 overflow-y-auto space-y-1.5 -mx-1 px-1", children: filteredCandidates.map((c) => {
                                            const account = accounts.find((a) => a.id === c.account_id);
                                            const amount = Math.abs(Number(c.amount));
                                            const sign = c.type === 'debit' ? '−' : '+';
                                            const colorClass = c.type === 'debit' ? 'text-rose-500' : 'text-emerald-600';
                                            const isBest = !searchTerm && c.id === bestMatchId;
                                            return (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => setPickedCandidate(c), className: "w-full text-left rounded-lg border border-border bg-card hover:bg-muted/50 hover:border-primary/40 transition-colors p-3 flex items-center gap-3 min-w-0", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx("p", { className: "text-sm font-semibold text-foreground truncate min-w-0 flex-1", children: c.description }), isBest && (_jsxs("span", { className: "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/5 border border-primary/15 px-1.5 py-0.5 rounded-full shrink-0", children: [_jsx(Sparkles, { size: 10 }), t('transactions.linkTransferBestMatch', 'Best match')] }))] }), _jsxs("p", { className: "text-xs text-muted-foreground truncate", children: [account ? getAccountName(account) : '—', " \u00B7 ", new Date(c.date + 'T00:00:00').toLocaleDateString(dateLocale)] })] }), _jsxs("p", { className: `text-sm font-bold tabular-nums ${colorClass} shrink-0`, children: [sign, formatCurrency(amount, c.currency, locale)] })] }) }, c.id));
                                        }) }))] }), onCreateCounterpart && manualCounterpartAccounts.length > 0 && (_jsxs("div", { className: "border-t border-border pt-4", children: [_jsx("p", { className: "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1", children: t('transactions.createCounterpartHeader') }), _jsx("p", { className: "text-xs text-muted-foreground mb-2", children: t('transactions.createCounterpartDescription') }), _jsxs("div", { className: "flex gap-2", children: [_jsxs("select", { value: counterpartAccountId, onChange: (e) => setCounterpartAccountId(e.target.value), className: "flex-1 min-w-0 px-3 py-2 text-sm rounded-md border border-border bg-card text-foreground focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]", children: [_jsx("option", { value: "", children: t('transactions.createCounterpartSelectAccount') }), manualCounterpartAccounts.map((a) => (_jsx("option", { value: a.id, children: getAccountName(a) }, a.id)))] }), _jsx(Button, { type: "button", variant: "outline", disabled: !counterpartAccountId || loading, onClick: () => onCreateCounterpart(anchor.id, counterpartAccountId), className: "shrink-0", children: loading ? t('common.loading') : t('transactions.createCounterpartConfirm') })] })] }))] }), _jsx(DialogFooter, { className: "shrink-0", children: _jsx(Button, { type: "button", variant: "outline", onClick: onClose, disabled: loading, children: t('common.cancel') }) })] }) }));
    }
    // Confirm view — used in direct mode and after picking a candidate.
    if (!effectiveDebit || !effectiveCredit)
        return null;
    const fromAccount = accounts.find((a) => a.id === effectiveDebit.account_id);
    const toAccount = accounts.find((a) => a.id === effectiveCredit.account_id);
    const sameCurrency = effectiveDebit.currency === effectiveCredit.currency;
    const debitAmount = Math.abs(Number(effectiveDebit.amount));
    const creditAmount = Math.abs(Number(effectiveCredit.amount));
    const amountMismatch = sameCurrency && debitAmount !== creditAmount;
    return (_jsx(Dialog, { open: open, onOpenChange: onClose, children: _jsxs(DialogContent, { className: "max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-4 sm:max-w-lg sm:p-6", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('transactions.linkTransferTitle') }) }), _jsxs("div", { className: "min-h-0 space-y-4 overflow-y-auto overscroll-contain pr-1", children: [_jsx(DialogDescription, { children: t('transactions.linkTransferDescription') }), _jsxs("div", { className: "grid grid-cols-1 items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr] sm:gap-3", children: [_jsx(CounterpartCard, { label: t('transactions.linkTransferFrom'), description: effectiveDebit.description, account: fromAccount?.name ?? '—', date: effectiveDebit.date, amount: debitAmount, currency: effectiveDebit.currency, sign: "\u2212", locale: locale, dateLocale: dateLocale }), _jsx("div", { className: "flex items-center justify-center", children: _jsx(ArrowRight, { size: 18, className: "rotate-90 text-muted-foreground sm:rotate-0" }) }), _jsx(CounterpartCard, { label: t('transactions.linkTransferTo'), description: effectiveCredit.description, account: toAccount?.name ?? '—', date: effectiveCredit.date, amount: creditAmount, currency: effectiveCredit.currency, sign: "+", locale: locale, dateLocale: dateLocale })] }), amountMismatch && (_jsxs("div", { className: "flex items-start gap-2 p-3 text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md text-amber-800 dark:text-amber-300", children: [_jsx(AlertTriangle, { size: 14, className: "shrink-0 mt-0.5" }), _jsx("span", { children: t('transactions.linkTransferAmountMismatch') })] })), _jsxs("div", { className: "flex items-start gap-2 p-3 text-xs bg-muted/50 border border-border rounded-md text-muted-foreground", children: [_jsx(Info, { size: 14, className: "shrink-0 mt-0.5" }), _jsx("span", { children: t('transactions.linkTransferCascadeWarning') })] })] }), _jsxs(DialogFooter, { className: "shrink-0 gap-2 sm:gap-2", children: [isPickerMode && (_jsxs(Button, { type: "button", variant: "ghost", onClick: () => setPickedCandidate(null), disabled: loading, className: "mr-auto", children: [_jsx(ArrowLeft, { size: 14, className: "mr-1" }), t('transactions.linkTransferBack')] })), _jsx(Button, { type: "button", variant: "outline", onClick: onClose, disabled: loading, children: t('common.cancel') }), _jsx(Button, { type: "button", onClick: () => onConfirm(effectiveDebit.id, effectiveCredit.id), disabled: loading, children: loading ? t('common.loading') : t('transactions.linkTransferConfirm') })] })] }) }));
}
