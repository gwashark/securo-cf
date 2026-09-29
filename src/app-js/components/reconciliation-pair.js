import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/** The promise and the money, resolved into the arithmetic that decides.
 *
 *  This began as a dialog holding two bordered boxes and an arrow. Three
 *  things were wrong with it, and the structural one came first: a modal
 *  is the answer you reach for before thinking. You inspected, closed,
 *  and the Accept button was behind the thing you had just dismissed. So
 *  this expands the row in place. The list stays put, several can be read
 *  in sequence, and the decision stays under your cursor.
 *
 *  The second was that a reader had to diff two lists in their head. The
 *  question is never "what are the properties of this invoice", it is
 *  "does this money belong to this debt", and that is one subtraction. So
 *  the subtraction is the headline, and everything else is provenance
 *  underneath it, quieter and smaller.
 *
 *  The third was boxes inside a box. There are no cards here: a hairline
 *  between two columns says the same thing and costs nothing.
 */
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { invoices as invoicesApi, transactions as transactionsApi, accounts as accountsApi, } from '../lib/api.js';
import { formatCurrency } from '../lib/format.js';
import { useDisplayLocale, useDateLocale } from '../hooks/use-display-locale.js';
import { usePrivacyMode } from '../hooks/use-privacy-mode.js';
import { cn } from '../lib/utils.js';
/** A figure with its meaning beneath it, sized so the figures read as one
 *  row of numbers and the words stay out of the way. */
function Figure({ value, caption, tone = 'neutral', }) {
    return (_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: cn('text-lg font-semibold tabular-nums leading-none truncate', tone === 'applied' && 'text-emerald-600 dark:text-emerald-400', tone === 'quiet' && 'text-muted-foreground', tone === 'neutral' && 'text-foreground'), children: value }), _jsx("p", { className: "text-[11px] text-muted-foreground mt-1 truncate", children: caption })] }));
}
/** One line of provenance. Deliberately not a label/value table: six rows
 *  of those compete with the figures above, and the figures are what the
 *  decision rests on. */
function Facts({ items }) {
    const shown = items.filter(Boolean);
    return (_jsx("p", { className: "text-xs text-muted-foreground leading-relaxed", children: shown.join(' · ') }));
}
function useInvoice(id, enabled) {
    return useQuery({
        queryKey: ['invoice', id],
        queryFn: () => invoicesApi.get(id),
        enabled,
    });
}
function PromiseLine({ side, open, money, showDate, }) {
    const { t } = useTranslation();
    const { data: invoice } = useInvoice(side.id, open && side.kind === 'invoice');
    const { data: leg } = useQuery({
        queryKey: ['transaction', side.id],
        queryFn: () => transactionsApi.get(side.id),
        enabled: open && side.kind === 'transaction',
    });
    if (side.kind === 'transaction') {
        // The account, then what it did and when. Never the description: on
        // the leg that matters it is a reference number, and the question
        // being asked is about two accounts.
        return (_jsxs("div", { className: "space-y-0.5", children: [_jsx("p", { className: "text-sm font-medium text-foreground truncate", children: side.label ?? t('reconciliation.pair.otherLeg') }), _jsx(Facts, { items: [
                        leg && showDate(leg.date),
                        leg && money(leg.amount, leg.currency),
                        leg?.description,
                    ] })] }));
    }
    if (side.kind !== 'invoice') {
        return (_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-foreground", children: side.label ?? t('reconciliation.pair.recurringBill') }), _jsx(Facts, { items: [t('reconciliation.pair.recurringBill')] })] }));
    }
    if (!invoice) {
        return _jsx("p", { className: "text-xs text-muted-foreground", children: t('common.loading') });
    }
    // The label the API resolved. Composing it from `series` and `number`
    // gets it wrong: `series` is the fiscal year, and the prefix a reader
    // recognises lives in the snapshot taken at issue.
    const name = side.label ?? invoice.external_number ?? null;
    return (_jsxs("div", { className: "space-y-0.5", children: [_jsxs("p", { className: "text-sm font-medium text-foreground flex items-center gap-2", children: [name ?? t('reconciliation.pair.draftInvoice'), invoice.state === 'overdue' && (_jsx("span", { className: "text-[10px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400", children: t('invoices.state.overdue', 'overdue') }))] }), _jsx(Facts, { items: [
                    invoice.payee?.name,
                    t('reconciliation.pair.dueOn', { date: showDate(invoice.due_date) }),
                    t('reconciliation.pair.totalOf', {
                        amount: money(invoice.total, invoice.currency),
                    }),
                ] })] }));
}
export function ReconciliationPair({ open, transactionId, sides, 
/** Pending means the money has not been applied yet, so the arithmetic
 *  can say what *would* be left. Once applied, the invoice already
 *  reflects it, and subtracting again would be a lie told confidently. */
pending, }) {
    const { t } = useTranslation();
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const { mask } = usePrivacyMode();
    const { data: accounts = [] } = useQuery({
        queryKey: ['accounts'],
        queryFn: () => accountsApi.list(),
        enabled: open,
    });
    const { data: transaction } = useQuery({
        queryKey: ['transaction', transactionId],
        queryFn: () => transactionsApi.get(transactionId),
        enabled: open && !!transactionId,
    });
    const first = sides.length > 0 ? sides[0] : undefined;
    const { data: firstInvoice } = useInvoice(first?.id ?? '', open && first?.kind === 'invoice');
    if (!open)
        return null;
    const currency = firstInvoice?.currency ?? transaction?.currency;
    const money = (value, code) => mask(formatCurrency(Number(value ?? 0), code || currency || 'USD', locale));
    const showDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(dateLocale);
    const accountName = accounts.find((a) => a.id === transaction?.account_id)?.name;
    const applied = sides.reduce((sum, side) => sum + Number(side.amount), 0);
    const outstanding = Number(firstInvoice?.balance ?? 0);
    const remaining = outstanding - applied;
    const singleInvoice = sides.length === 1 && first?.kind === 'invoice';
    // A transfer has no balance to subtract from, so the three-figure
    // arithmetic above would be answering a question nobody asked. What
    // matters is the two amounts side by side, because when they differ
    // the difference is the whole reason this is a question.
    const isTransfer = first?.kind === 'transaction';
    return (_jsxs("div", { className: "mt-3 pt-3 border-t border-border", children: [_jsx("div", { className: "flex items-end gap-6 sm:gap-10 flex-wrap", children: singleInvoice ? (_jsxs(_Fragment, { children: [_jsx(Figure, { value: money(outstanding), caption: t('reconciliation.pair.stillOpen'), tone: "quiet" }), _jsx(Figure, { value: money(applied), caption: pending
                                ? t('reconciliation.pair.thisPayment')
                                : t('reconciliation.pair.wasApplied'), tone: "applied" }), pending && (_jsx(Figure, { value: money(remaining > 0 ? remaining : 0), caption: remaining <= 0
                                ? t('reconciliation.pair.wouldClose')
                                : t('reconciliation.pair.wouldRemain'), tone: remaining <= 0 ? 'applied' : 'neutral' }))] })) : isTransfer ? (_jsxs(_Fragment, { children: [_jsx(Figure, { value: money(applied), caption: t('reconciliation.pair.otherLegAmount'), tone: "quiet" }), transaction && (_jsx(Figure, { value: money(transaction.amount, transaction.currency), caption: t('reconciliation.pair.thisLegAmount'), tone: "applied" }))] })) : (_jsxs(_Fragment, { children: [_jsx(Figure, { value: money(applied), caption: t('reconciliation.pair.acrossInvoices', {
                                count: sides.length,
                            }), tone: "applied" }), transaction && (_jsx(Figure, { value: money(transaction.amount, transaction.currency), caption: t('reconciliation.pair.thePayment'), tone: "quiet" }))] })) }), _jsxs("div", { className: "mt-4 grid gap-4 sm:grid-cols-2 sm:divide-x divide-border", children: [_jsxs("div", { className: "space-y-2 sm:pr-5", children: [_jsx("p", { className: "text-[10px] font-semibold text-muted-foreground uppercase tracking-wider", children: t(isTransfer ? 'reconciliation.pair.otherLeg' : 'reconciliation.pair.owed') }), sides.map((side) => (_jsx(PromiseLine, { side: side, open: open, money: money, showDate: showDate }, side.id)))] }), _jsxs("div", { className: "space-y-2 sm:pl-5", children: [_jsx("p", { className: "text-[10px] font-semibold text-muted-foreground uppercase tracking-wider", children: t(isTransfer ? 'reconciliation.pair.thisLeg' : 'reconciliation.pair.arrived') }), transaction ? (_jsxs("div", { className: "space-y-0.5", children: [_jsx("p", { className: "text-sm font-medium text-foreground truncate", children: isTransfer ? (accountName ?? transaction.description) : transaction.description }), _jsx(Facts, { items: isTransfer
                                            ? [
                                                showDate(transaction.date),
                                                money(transaction.amount, transaction.currency),
                                                transaction.description,
                                            ]
                                            : [
                                                showDate(transaction.date),
                                                accountName,
                                                // `payee_name` is the resolved one; `payee` is the
                                                // raw string the bank sent, worth falling back to
                                                // when nothing has been mapped yet.
                                                transaction.payee_name || transaction.payee,
                                            ] })] })) : (_jsx("p", { className: "text-xs text-muted-foreground", children: transactionId ? t('common.loading') : t('reconciliation.pair.noMoney') }))] })] })] }));
}
