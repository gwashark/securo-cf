import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/** The questions matching could not answer, where the invoice is.
 *
 *  Matching produced these, and until now the only place they existed was
 *  a tab on the rules page. That is the wrong place for them to be the
 *  *only* place: somebody looking at an unpaid invoice is exactly the
 *  person who can say whether that payment is it, and they had no way of
 *  knowing a question was waiting unless they went looking for a queue
 *  they had no reason to visit.
 *
 *  So the same question appears here, answerable in place. The queue is
 *  still where you go to clear a backlog; this is where you find one
 *  without having gone looking.
 */
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, HelpCircle, X } from 'lucide-react';
import { Button } from './ui/button.js';
import { reconciliation as reconciliationApi } from '../lib/api.js';
import { extractApiError } from '../lib/api-errors.js';
import { invalidateFinancialQueries } from '../lib/invalidate-queries.js';
import { formatCurrency } from '../lib/format.js';
import { useDisplayLocale, useDateLocale } from '../hooks/use-display-locale.js';
import { usePrivacyMode } from '../hooks/use-privacy-mode.js';
import { suggestionsFor } from '../lib/invoice-suggestions.js';
export function InvoiceSuggestions({ invoiceId, canWrite, }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const { mask } = usePrivacyMode();
    // The same key the queue uses, so answering in either place updates
    // both without either knowing the other exists.
    const { data: pending = [] } = useQuery({
        queryKey: ['reconciliation-suggestions'],
        queryFn: reconciliationApi.suggestions,
    });
    const answer = useMutation({
        mutationFn: ({ id, accept }) => accept ? reconciliationApi.accept(id) : reconciliationApi.decline(id),
        onSuccess: (_result, { accept }) => {
            void queryClient.invalidateQueries({ queryKey: ['reconciliation-suggestions'] });
            void queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
            void queryClient.invalidateQueries({ queryKey: ['reconciliation-history'] });
            // Accepting moves money against a debt, so the figures everywhere
            // else are now stale. Declining changes nothing but the question.
            if (accept)
                invalidateFinancialQueries(queryClient);
            // The same words the queue says for the same act. Two vocabularies
            // for one decision would read as two features.
            toast.success(t(accept ? 'reconciliation.queue.linked' : 'reconciliation.queue.declined'));
        },
        onError: (error) => toast.error(extractApiError(error, t('common.error'))),
    });
    const mine = suggestionsFor(pending, invoiceId);
    if (mine.length === 0)
        return null;
    const showDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(dateLocale);
    const money = (value, code) => mask(formatCurrency(Number(value), code || 'USD', locale));
    return (_jsxs("div", { className: "bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/60 overflow-hidden", children: [_jsxs("div", { className: "px-4 sm:px-5 py-3 flex items-center gap-2 border-b border-amber-200 dark:border-amber-900/60", children: [_jsx(HelpCircle, { className: "h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" }), _jsx("p", { className: "text-sm font-semibold text-foreground", children: t('invoices.suggestions.title', { count: mine.length }) })] }), _jsx("ul", { className: "divide-y divide-amber-200 dark:divide-amber-900/60", children: mine.map((suggestion) => (_jsxs("li", { className: "px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3", "data-testid": "invoice-suggestion", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-foreground truncate", children: suggestion.transaction?.description ?? t('invoices.linkedPayment') }), _jsxs("p", { className: "text-xs text-muted-foreground tabular-nums mt-0.5", children: [suggestion.transaction?.date ? showDate(suggestion.transaction.date) : '', ' · ', t('invoices.suggestions.wouldApply', {
                                            amount: money(suggestion.amount, suggestion.transaction?.currency),
                                        }), (suggestion.covers?.length ?? 0) > 1 && (_jsxs(_Fragment, { children: [" \u00B7 ", t('invoices.suggestions.alsoCovers', {
                                                    count: (suggestion.covers?.length ?? 1) - 1,
                                                })] }))] })] }), canWrite && (_jsxs("div", { className: "flex items-center gap-1 shrink-0", children: [_jsxs(Button, { size: "sm", className: "h-8 gap-1.5", disabled: answer.isPending, onClick: () => answer.mutate({ id: suggestion.id, accept: true }), children: [_jsx(Check, { size: 13 }), t('reconciliation.queue.accept')] }), _jsx(Button, { size: "sm", variant: "ghost", className: "h-8 gap-1 text-muted-foreground", disabled: answer.isPending, title: t('reconciliation.queue.declineHint'), onClick: () => answer.mutate({ id: suggestion.id, accept: false }), children: _jsx(X, { size: 13 }) })] }))] }, suggestion.id))) })] }));
}
