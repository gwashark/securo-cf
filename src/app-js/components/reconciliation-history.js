import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** What matching did, in one order.
 *
 *  Sits under the queue because the two answer neighbouring questions:
 *  the queue is *what still needs me*, this is *what already happened*.
 *  Newest first here and oldest first there, deliberately: a queue is
 *  work to get through, so its oldest item is the most urgent, while a
 *  history is read to find out what just happened.
 *
 *  One line per event and nothing else. The thing a reader wants from a
 *  history like this is almost always the same: *was that me, or was that
 *  the rules?*, so that distinction is what the row leads with, and the
 *  rest is detail behind it.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { reconciliation as reconciliationApi } from '../lib/api.js';
import { Link2, Link2Off, HelpCircle, Check, X, Clock } from 'lucide-react';
import { formatCurrency } from '../lib/format.js';
import { useDisplayLocale, useDateLocale } from '../hooks/use-display-locale.js';
import { usePrivacyMode } from '../hooks/use-privacy-mode.js';
import { useAuth } from '../contexts/auth-context.js';
import { cn } from '../lib/utils.js';
import { ReconciliationPair } from './reconciliation-pair.js';
function SectionCard({ children }) {
    return (_jsx("div", { className: "bg-card rounded-xl border border-border shadow-sm overflow-hidden", children: children }));
}
/** The six verbs, each with the shape a reader can scan for. */
const LOOK = {
    // A link, not a lightning bolt. The bolt meant "the rules did this",
    // which is a claim about *who*, and a person linking a payment by hand
    // writes a `linked` event too: the row then showed the automatic mark
    // beside the words "by you". Who did it is said once, in the line
    // underneath, where it can be read rather than decoded.
    linked: { icon: Link2, tone: 'text-emerald-600' },
    accepted: { icon: Check, tone: 'text-emerald-600' },
    suggested: { icon: HelpCircle, tone: 'text-amber-600' },
    declined: { icon: X, tone: 'text-muted-foreground' },
    expired: { icon: Clock, tone: 'text-muted-foreground' },
    unlinked: { icon: Link2Off, tone: 'text-rose-500' },
};
const SHOWN_AT_FIRST = 8;
export function ReconciliationHistory() {
    const { t } = useTranslation();
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const { mask } = usePrivacyMode();
    const [expanded, setExpanded] = useState(false);
    // Same panel the queue uses. "Linked to AUR5" tells you what happened;
    // it does not let you check whether it should have.
    const [openId, setOpenId] = useState(null);
    // Only the fallback: an event that lost its promise (deleted, or from
    // before the field existed) still has to render something, and the
    // viewer's own currency is the least wrong guess available.
    const { user } = useAuth();
    const displayCurrency = user?.preferences?.currency_display ?? 'USD';
    const { data: events } = useQuery({
        queryKey: ['reconciliation-history'],
        queryFn: () => reconciliationApi.history(),
    });
    if (!events)
        return null;
    const shown = expanded ? events : events.slice(0, SHOWN_AT_FIRST);
    // The event's own currency, never a guess: a workspace keeping invoices
    // in more than one is ordinary, and a hardcoded code would have read a
    // R$ 1.200,00 settlement back as $1,200.00.
    const money = (value, currency) => mask(formatCurrency(Number(value ?? 0), currency || displayCurrency, locale));
    const when = (iso) => new Date(iso).toLocaleString(dateLocale, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
    return (_jsxs(SectionCard, { children: [_jsxs("div", { className: "px-4 sm:px-5 py-4 border-b border-border", children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: t('reconciliation.history.title') }), _jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: t('reconciliation.history.hint') })] }), events.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground text-center py-10", children: t('reconciliation.history.empty') })) : (_jsx("div", { className: "divide-y divide-border", children: shown.map((event) => {
                    const look = LOOK[event.action];
                    const Icon = look.icon;
                    return (_jsxs("div", { className: "px-4 sm:px-5 py-2.5 text-sm hover:bg-muted/60 transition-colors cursor-pointer", onClick: () => setOpenId((current) => (current === event.id ? null : event.id)), children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx(Icon, { size: 14, className: cn('mt-0.5 shrink-0', look.tone) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("p", { className: "text-foreground", children: [t(`reconciliation.history.action.${event.action}`, {
                                                        name: event.expectation_label ?? '—',
                                                    }), _jsxs("span", { className: "text-muted-foreground", children: [' · ', money(event.amount, event.currency)] })] }), _jsxs("p", { className: "text-xs text-muted-foreground truncate", children: [event.user_id
                                                        ? t('reconciliation.history.byPerson')
                                                        : t('reconciliation.history.byRules'), event.transaction_description
                                                        ? ` · ${event.transaction_description}`
                                                        : ''] })] }), _jsx("span", { className: "text-xs text-muted-foreground shrink-0 tabular-nums", children: when(event.at) })] }), _jsx(ReconciliationPair, { open: openId === event.id, transactionId: event.transaction_id, 
                                // Already written: the invoice reflects it, so the panel
                                // reports rather than projects.
                                pending: false, sides: [
                                    {
                                        kind: event.expectation_kind,
                                        id: event.expectation_id,
                                        label: event.expectation_label,
                                        amount: event.amount,
                                    },
                                ] })] }, event.id));
                }) })), events.length > SHOWN_AT_FIRST && (_jsx("button", { className: "w-full px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border-t border-border", onClick: () => setExpanded((open) => !open), children: expanded
                    ? t('reconciliation.history.less')
                    : t('reconciliation.history.more', {
                        count: events.length - SHOWN_AT_FIRST,
                    }) }))] }));
}
