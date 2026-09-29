import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDisplayLocale, useDateLocale } from '../hooks/use-display-locale.js';
import { getAccountName, sortAccountsByDisplayName } from '../lib/account-utils.js';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, ChevronDown, Link2, Receipt, TrendingDown, TrendingUp, Trash2, UserPlus, Wallet, } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, } from 'recharts';
import { groups as groupsApi, accounts as accountsApi, transactions as transactionsApi, } from '../lib/api.js';
import { localDateString } from '../lib/date-utils.js';
import { MemberForm } from '../components/member-form.js';
import { useAuth } from '../contexts/auth-context.js';
import { useWorkspace } from '../contexts/workspace-context.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Skeleton } from '../components/ui/skeleton.js';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, } from '../components/ui/dialog.js';
import { CategoryIcon } from '../components/category-icon.js';
import { DatePickerInput } from '../components/ui/date-picker-input.js';
import { PageHeader } from '../components/page-header.js';
import { formatCurrency } from '../lib/format.js';
function SectionCard({ children }) {
    return (_jsx("div", { className: "bg-card rounded-xl border border-border shadow-sm overflow-hidden", children: children }));
}
function SectionHeader({ title, description, action, }) {
    return (_jsxs("div", { className: "px-4 sm:px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: title }), description && (_jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: description }))] }), action] }));
}
function KpiCard({ label, value, icon: Icon, tone, breakdown, }) {
    const [open, setOpen] = useState(false);
    const toneClass = tone === 'positive'
        ? 'text-emerald-600'
        : tone === 'negative'
            ? 'text-rose-500'
            : 'text-foreground';
    const hasBreakdown = !!breakdown && breakdown.length > 0;
    return (_jsxs("div", { className: "bg-card rounded-xl border border-border shadow-sm p-3 sm:p-4", children: [_jsxs("button", { type: "button", className: `w-full text-left ${hasBreakdown ? 'cursor-pointer' : 'cursor-default'}`, onClick: () => hasBreakdown && setOpen((o) => !o), disabled: !hasBreakdown, "aria-expanded": open, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide", children: label }), _jsxs("div", { className: "flex items-center gap-1 text-muted-foreground", children: [hasBreakdown && (_jsx(ChevronDown, { size: 14, className: `transition-transform ${open ? 'rotate-180' : ''}` })), _jsx(Icon, { size: 14 })] })] }), _jsx("p", { className: `text-base sm:text-2xl font-bold tabular-nums mt-1 ${toneClass}`, children: value })] }), open && hasBreakdown && (_jsx("ul", { className: "mt-2 pt-2 border-t border-border space-y-1 text-xs text-muted-foreground", children: breakdown.map((b, i) => (_jsxs("li", { className: "flex justify-between gap-2", children: [_jsx("span", { className: "truncate", children: b.name }), _jsx("span", { className: "tabular-nums whitespace-nowrap text-foreground", children: b.amountText })] }, i))) }))] }));
}
export default function GroupDetailPage() {
    const { id } = useParams();
    const groupId = id ?? '';
    const { t } = useTranslation();
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { canWrite } = useWorkspace();
    const { data: group, isLoading: loadingGroup } = useQuery({
        queryKey: ['groups', groupId],
        queryFn: () => groupsApi.get(groupId),
        enabled: !!groupId,
    });
    // Linked members get a read-only view of the group.
    const isOwner = group?.is_owner ?? false;
    // The member that represents the current viewer (when linked).
    const viewerMember = useMemo(() => group?.members.find((m) => user && m.linked_user_id === user.id), [group?.members, user]);
    // The "self" member is the owner-payer of the group's transactions.
    const ownerMember = useMemo(() => group?.members.find((m) => m.is_self), [group?.members]);
    const { data: balances } = useQuery({
        queryKey: ['groups', groupId, 'balances'],
        queryFn: () => groupsApi.balances(groupId),
        enabled: !!groupId,
    });
    const { data: settlements } = useQuery({
        queryKey: ['groups', groupId, 'settlements'],
        queryFn: () => groupsApi.settlements.list(groupId),
        enabled: !!groupId,
    });
    const { data: groupTxs } = useQuery({
        queryKey: ['groups', groupId, 'transactions'],
        queryFn: () => groupsApi.transactions(groupId, 20),
        enabled: !!groupId,
    });
    // ── Member management ────────────────────────────────────────
    const [memberDialogOpen, setMemberDialogOpen] = useState(false);
    const [editingMember, setEditingMember] = useState(null);
    const [memberName, setMemberName] = useState('');
    const [memberEmail, setMemberEmail] = useState('');
    // The Securo user this member should be linked to (if any). When set,
    // name+email are derived from that user and the inputs are locked —
    // is_self is auto-inferred (true iff the linked user is the viewer).
    const [memberLinkedUserId, setMemberLinkedUserId] = useState(null);
    const memberMutation = useMutation({
        mutationFn: (payload) => editingMember
            ? groupsApi.members.update(groupId, editingMember.id, payload)
            : groupsApi.members.create(groupId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
            queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'balances'] });
            setMemberDialogOpen(false);
            setEditingMember(null);
            toast.success(editingMember ? t('splitGroups.memberUpdated') : t('splitGroups.memberAdded'));
        },
        onError: (err) => {
            const detail = err && typeof err === 'object' && 'response' in err
                ? err.response?.data?.detail
                : undefined;
            toast.error(detail ?? t('common.error'));
        },
    });
    const deleteMemberMutation = useMutation({
        mutationFn: (memberId) => groupsApi.members.delete(groupId, memberId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
            queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'balances'] });
            setMemberDialogOpen(false);
            setEditingMember(null);
            toast.success(t('splitGroups.memberDeleted'));
        },
        onError: (err) => {
            const detail = err && typeof err === 'object' && 'response' in err
                ? err.response?.data?.detail
                : undefined;
            toast.error(detail ?? t('common.error'));
        },
    });
    const openCreateMember = () => {
        setEditingMember(null);
        setMemberName('');
        setMemberEmail('');
        setMemberLinkedUserId(null);
        setMemberDialogOpen(true);
    };
    const openEditMember = (member) => {
        setEditingMember(member);
        setMemberName(member.name);
        setMemberEmail(member.email ?? '');
        setMemberLinkedUserId(member.linked_user_id);
        setMemberDialogOpen(true);
    };
    const saveMember = () => {
        // is_self is derived: a linked-to-viewer member is always "you".
        // Unlinked members can still represent the viewer if explicitly the
        // first member of their own group (legacy data) — we preserve that
        // flag during edits via the existing record.
        const linkedToViewer = memberLinkedUserId !== null && memberLinkedUserId === user?.id;
        const is_self = linkedToViewer || (!memberLinkedUserId && (editingMember?.is_self ?? false));
        memberMutation.mutate({
            name: memberName.trim(),
            email: memberEmail.trim() || null,
            is_self,
        });
    };
    // ── Settle-up ────────────────────────────────────────────────
    const [settleOpen, setSettleOpen] = useState(false);
    const [settleFrom, setSettleFrom] = useState('');
    const [settleTo, setSettleTo] = useState('');
    const [settleAmount, setSettleAmount] = useState('');
    const [settleDate, setSettleDate] = useState(localDateString);
    const [settleNotes, setSettleNotes] = useState('');
    const [settleCurrency, setSettleCurrency] = useState('USD');
    // Optional ledger integration for the payer: 'none' records the
    // settlement only, 'create' makes a fresh debit, 'existing' links a
    // transaction the payer already has.
    const [settleTxMode, setSettleTxMode] = useState('none');
    const [settleAccountId, setSettleAccountId] = useState('');
    // The transaction picked to link, plus the search box state. We keep
    // the whole object so the selection stays visible even after the
    // search term changes and it drops out of the result list.
    const [settlePickedTx, setSettlePickedTx] = useState(null);
    const [settleTxSearch, setSettleTxSearch] = useState('');
    const [settleTxQuery, setSettleTxQuery] = useState('');
    // Accounts of the requesting user — needed only when the optional
    // "create transaction" toggle is enabled.
    const { data: accountsList } = useQuery({
        queryKey: ['accounts'],
        queryFn: () => accountsApi.list(),
        enabled: settleOpen,
    });
    // Debounce the transaction search so we don't hit the API on every
    // keystroke (mirrors the transactions page pattern).
    useEffect(() => {
        const id = setTimeout(() => setSettleTxQuery(settleTxSearch), 300);
        return () => clearTimeout(id);
    }, [settleTxSearch]);
    // The payer's debit transactions, searched server-side and capped —
    // offered when linking an existing transaction instead of creating one.
    const { data: settleTxOptions } = useQuery({
        queryKey: ['settle-tx-options', settleTxQuery],
        queryFn: () => transactionsApi.list({
            type: 'debit',
            q: settleTxQuery || undefined,
            limit: 20,
            sort_by: 'date',
            sort_dir: 'desc',
        }),
        enabled: settleOpen && settleTxMode === 'existing',
    });
    const settlementMutation = useMutation({
        mutationFn: (payload) => groupsApi.settlements.create(groupId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'settlements'] });
            queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'balances'] });
            setSettleOpen(false);
            toast.success(t('splitGroups.settled'));
        },
        onError: (err) => {
            const detail = err && typeof err === 'object' && 'response' in err
                ? err.response?.data?.detail
                : undefined;
            toast.error(detail ?? t('common.error'));
        },
    });
    const deleteSettlementMutation = useMutation({
        mutationFn: (settlementId) => groupsApi.settlements.delete(groupId, settlementId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'settlements'] });
            queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'balances'] });
        },
    });
    const openSettleUp = (from, to, amount, currency) => {
        setSettleFrom(from ?? '');
        setSettleTo(to ?? '');
        setSettleAmount(amount != null ? amount.toFixed(2) : '');
        setSettleDate(localDateString());
        setSettleNotes('');
        // Use the line's currency when settling a specific debt, falling
        // back to the group's default for free-form settlements. This
        // matters when the same group has cross-currency debts.
        setSettleCurrency(currency ?? group?.default_currency ?? 'USD');
        setSettleTxMode('none');
        setSettleAccountId('');
        setSettlePickedTx(null);
        setSettleTxSearch('');
        setSettleTxQuery('');
        setSettleOpen(true);
    };
    const saveSettlement = () => {
        if (!settleFrom || !settleTo || !settleAmount)
            return;
        const payload = {
            from_member_id: settleFrom,
            to_member_id: settleTo,
            amount: parseFloat(settleAmount),
            currency: settleCurrency,
            date: settleDate,
            notes: settleNotes.trim() || null,
        };
        if (settleTxMode === 'create' && settleAccountId) {
            payload.account_id = settleAccountId;
        }
        else if (settleTxMode === 'existing' && settlePickedTx) {
            payload.transaction_id = settlePickedTx.id;
        }
        settlementMutation.mutate(payload);
    };
    // Lookup helpers
    const memberById = useMemo(() => {
        const map = new Map();
        for (const m of group?.members ?? [])
            map.set(m.id, m);
        return map;
    }, [group?.members]);
    const memberName_ = (memberId) => memberById.get(memberId)?.name ?? '—';
    // ── KPIs ─────────────────────────────────────────────────────
    const groupCurrency = group?.default_currency ?? 'USD';
    // Sum cross-currency rows in the group's primary terms — using
    // amount_primary when available, otherwise the native amount. Without
    // this, EUR rows would silently add as USD (a €100 hotel would count
    // as $100, throwing off the KPI vs. spending-by-category breakdown).
    const totalMoved = useMemo(() => {
        if (!groupTxs)
            return 0;
        return groupTxs.reduce((sum, tx) => sum + Number(tx.amount_primary ?? tx.amount), 0);
    }, [groupTxs]);
    // KPIs roll up across currencies using each line's
    // amount_in_default_currency (FX-converted server-side). Filtering by
    // a single currency would otherwise hide debts in another currency
    // — e.g. a EUR-only line wouldn't show up for a USD-default group.
    const owedToViewer = useMemo(() => {
        if (!balances)
            return 0;
        if (isOwner) {
            return balances.lines
                .filter((l) => l.amount > 0)
                .reduce((s, l) => s + Number(l.amount_in_default_currency), 0);
        }
        if (!viewerMember)
            return 0;
        return balances.lines
            .filter((l) => l.member_id === viewerMember.id && l.amount < 0)
            .reduce((s, l) => s + Math.abs(Number(l.amount_in_default_currency)), 0);
    }, [balances, isOwner, viewerMember]);
    const viewerOwes = useMemo(() => {
        if (!balances)
            return 0;
        if (isOwner) {
            return Math.abs(balances.lines
                .filter((l) => l.amount < 0)
                .reduce((s, l) => s + Number(l.amount_in_default_currency), 0));
        }
        if (!viewerMember)
            return 0;
        return balances.lines
            .filter((l) => l.member_id === viewerMember.id && l.amount > 0)
            .reduce((s, l) => s + Number(l.amount_in_default_currency), 0);
    }, [balances, isOwner, viewerMember]);
    // Per-line breakdown for the two debt KPIs. Each row shows the other
    // party's name and the amount in its native currency — so a EUR line
    // stays "€100" instead of being lossy-rolled into the USD KPI total.
    const memberNameById = useMemo(() => {
        const map = new Map();
        for (const m of group?.members ?? [])
            map.set(m.id, m.name);
        return map;
    }, [group?.members]);
    const owedToViewerBreakdown = useMemo(() => {
        if (!balances)
            return [];
        if (isOwner) {
            return balances.lines
                .filter((l) => l.amount > 0)
                .map((l) => ({
                name: memberNameById.get(l.member_id) ?? '—',
                amountText: formatCurrency(Number(l.amount), l.currency, locale),
            }));
        }
        if (!viewerMember || !ownerMember)
            return [];
        return balances.lines
            .filter((l) => l.member_id === viewerMember.id && l.amount < 0)
            .map((l) => ({
            name: ownerMember.name,
            amountText: formatCurrency(Math.abs(Number(l.amount)), l.currency, locale),
        }));
    }, [balances, isOwner, viewerMember, ownerMember, memberNameById, locale]);
    const viewerOwesBreakdown = useMemo(() => {
        if (!balances)
            return [];
        if (isOwner) {
            return balances.lines
                .filter((l) => l.amount < 0)
                .map((l) => ({
                name: memberNameById.get(l.member_id) ?? '—',
                amountText: formatCurrency(Math.abs(Number(l.amount)), l.currency, locale),
            }));
        }
        if (!viewerMember || !ownerMember)
            return [];
        return balances.lines
            .filter((l) => l.member_id === viewerMember.id && l.amount > 0)
            .map((l) => ({
            name: ownerMember.name,
            amountText: formatCurrency(Number(l.amount), l.currency, locale),
        }));
    }, [balances, isOwner, viewerMember, ownerMember, memberNameById, locale]);
    const monthlyData = useMemo(() => {
        if (!groupTxs || groupTxs.length === 0)
            return [];
        const byMonth = new Map();
        for (const tx of groupTxs) {
            const m = tx.date.slice(0, 7);
            byMonth.set(m, (byMonth.get(m) ?? 0) + Number(tx.amount_primary ?? tx.amount));
        }
        return Array.from(byMonth.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, total]) => ({
            month: new Date(month + '-01').toLocaleString(dateLocale, { month: 'short' }),
            total: Number(total.toFixed(2)),
        }));
    }, [groupTxs, dateLocale]);
    // Group spending broken down by category — for the stacked horizontal
    // bar. We sum debits only (income/credits aren't "spending"). When a
    // tx has amount_primary we use that so cross-currency rows are
    // comparable; otherwise fall back to the native amount, which is fine
    // for single-currency groups.
    const categoryBreakdown = useMemo(() => {
        if (!groupTxs || groupTxs.length === 0)
            return [];
        const map = new Map();
        for (const tx of groupTxs) {
            if (tx.type !== 'debit')
                continue;
            const id = tx.category?.id ?? 'uncategorized';
            const name = tx.category?.name ?? t('splitGroups.uncategorized');
            const color = tx.category?.color ?? '#6B7280';
            const value = Number(tx.amount_primary ?? tx.amount);
            const existing = map.get(id);
            if (existing) {
                existing.total += value;
            }
            else {
                map.set(id, { id, name, color, total: value });
            }
        }
        return Array.from(map.values()).sort((a, b) => b.total - a.total);
    }, [groupTxs, t]);
    const categoryBreakdownTotal = useMemo(() => categoryBreakdown.reduce((s, c) => s + c.total, 0), [categoryBreakdown]);
    if (loadingGroup) {
        return (_jsxs("div", { className: "space-y-4", children: [_jsx(Skeleton, { className: "h-12 w-64" }), _jsx(Skeleton, { className: "h-32 w-full" }), _jsx(Skeleton, { className: "h-32 w-full" })] }));
    }
    if (!group) {
        return _jsx("div", { className: "text-muted-foreground", children: t('splitGroups.notFound') });
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsx(PageHeader, { section: t('splitGroups.section'), title: group.name, action: _jsxs("div", { className: "flex items-center gap-2", children: [!isOwner && (_jsx("span", { className: "text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full", children: t('splitGroups.sharedWithYou') })), _jsxs(Button, { variant: "outline", onClick: () => navigate('/groups'), children: [_jsx(ArrowLeft, { size: 14, className: "mr-1" }), t('common.back')] })] }) }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4", children: [_jsx(KpiCard, { label: t('splitGroups.kpiTotalMoved'), value: formatCurrency(totalMoved, groupCurrency, locale), icon: Wallet }), _jsx(KpiCard, { label: t(isOwner ? 'splitGroups.kpiOwedToYou' : 'splitGroups.kpiOwedToYouAsMember'), value: formatCurrency(owedToViewer, groupCurrency, locale), icon: TrendingUp, tone: owedToViewer > 0 ? 'positive' : 'neutral', breakdown: owedToViewerBreakdown }), _jsx(KpiCard, { label: t('splitGroups.kpiYouOwe'), value: formatCurrency(viewerOwes, groupCurrency, locale), icon: TrendingDown, tone: viewerOwes > 0 ? 'negative' : 'neutral', breakdown: viewerOwesBreakdown })] }), monthlyData.length > 1 && (_jsxs(SectionCard, { children: [_jsx(SectionHeader, { title: t('splitGroups.spendingTrend'), description: t('splitGroups.spendingTrendHint') }), _jsx("div", { className: "px-2 py-3", children: _jsx(ResponsiveContainer, { width: "100%", height: 120, children: _jsxs(BarChart, { data: monthlyData, children: [_jsx(XAxis, { dataKey: "month", tick: { fontSize: 11 }, axisLine: false, tickLine: false }), _jsx(Tooltip, { cursor: { fill: 'var(--muted)' }, contentStyle: {
                                            fontSize: 12,
                                            borderRadius: 8,
                                            border: '1px solid var(--border)',
                                            background: 'var(--card)',
                                        }, formatter: (v) => formatCurrency(Number(v ?? 0), groupCurrency, locale) }), _jsx(Bar, { dataKey: "total", fill: group.color, radius: [4, 4, 0, 0] })] }) }) })] })), categoryBreakdownTotal > 0 && (_jsxs(SectionCard, { children: [_jsx(SectionHeader, { title: t('splitGroups.byCategory'), description: t('splitGroups.byCategoryHint') }), _jsxs("div", { className: "px-4 py-3 space-y-3", children: [_jsx("div", { className: "flex h-3 w-full overflow-hidden rounded-full bg-muted", children: categoryBreakdown.map((c) => {
                                    const pct = (c.total / categoryBreakdownTotal) * 100;
                                    return (_jsx("div", { style: { width: `${pct}%`, backgroundColor: c.color }, title: `${c.name} · ${formatCurrency(c.total, groupCurrency, locale)} (${pct.toFixed(1)}%)` }, c.id));
                                }) }), _jsx("ul", { className: "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs", children: categoryBreakdown.map((c) => {
                                    const pct = (c.total / categoryBreakdownTotal) * 100;
                                    return (_jsxs("li", { className: "flex items-center justify-between gap-2", children: [_jsxs("span", { className: "flex items-center gap-2 min-w-0", children: [_jsx("span", { className: "h-2.5 w-2.5 rounded-full shrink-0", style: { backgroundColor: c.color } }), _jsx("span", { className: "truncate", children: c.name })] }), _jsxs("span", { className: "tabular-nums whitespace-nowrap text-muted-foreground", children: [formatCurrency(c.total, groupCurrency, locale), " \u00B7 ", pct.toFixed(0), "%"] })] }, c.id));
                                }) })] })] })), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4", children: [_jsxs(SectionCard, { children: [_jsx(SectionHeader, { title: t('splitGroups.members'), action: isOwner && canWrite ? (_jsxs(Button, { size: "sm", className: "gap-1.5 h-8", onClick: openCreateMember, children: [_jsx(UserPlus, { size: 13 }), t('splitGroups.addMember')] })) : undefined }), group.members.length === 0 ? (_jsx("div", { className: "text-center py-8 text-muted-foreground text-sm", children: t('splitGroups.noMembers') })) : (_jsx("ul", { className: "divide-y divide-border", children: group.members.map((member) => (_jsxs("li", { className: "flex items-center justify-between px-4 py-3", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm font-medium", children: member.name }), viewerMember?.id === member.id ? (_jsx("span", { className: "text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full", children: t('splitGroups.you') })) : member.is_self && isOwner ? (_jsx("span", { className: "text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full", children: t('splitGroups.you') })) : member.is_self ? (_jsx("span", { className: "text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full", children: t('splitGroups.ownerBadge') })) : null] }), member.email && (_jsxs("p", { className: "text-xs text-muted-foreground inline-flex items-center gap-1", children: [member.linked_user_id && _jsx(Link2, { size: 10 }), member.email] }))] }), isOwner && canWrite && (_jsx(Button, { variant: "ghost", size: "sm", onClick: () => openEditMember(member), children: t('common.edit') }))] }, member.id))) }))] }), _jsxs(SectionCard, { children: [_jsx(SectionHeader, { title: t('splitGroups.balances'), description: t('splitGroups.balancesHint') }), balances && balances.lines.length > 0 ? (_jsx("ul", { className: "divide-y divide-border", children: balances.lines.map((line, idx) => {
                                    const positive = line.amount > 0;
                                    // Reframe the line per viewer:
                                    //   - Owner sees "X owes you" / "you owe X" (their direct relationship).
                                    //   - A linked member sees their own line as "you owe / owes you {owner}",
                                    //     and other lines as "{name} owes / is owed by {owner}".
                                    const ownerName = ownerMember?.name ?? '—';
                                    const otherName = memberName_(line.member_id);
                                    const isViewerLine = viewerMember?.id === line.member_id;
                                    const label = isOwner
                                        ? positive
                                            ? t('splitGroups.owesYou', { name: otherName })
                                            : t('splitGroups.youOwe', { name: otherName })
                                        : isViewerLine
                                            ? positive
                                                ? t('splitGroups.youOwe', { name: ownerName })
                                                : t('splitGroups.ownerOwesYou', { name: ownerName })
                                            : positive
                                                ? t('splitGroups.thirdPartyOwes', { name: otherName, owner: ownerName })
                                                : t('splitGroups.thirdPartyOwed', { name: otherName, owner: ownerName });
                                    return (_jsxs("li", { className: "flex items-center justify-between px-4 py-3", children: [_jsx("div", { className: "text-sm", children: label }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: `text-sm font-semibold tabular-nums ${positive ? 'text-emerald-600' : 'text-rose-500'}`, children: formatCurrency(Math.abs(line.amount), line.currency, locale) }), (() => {
                                                        // Show "Acertar" if the viewer can act on this line:
                                                        // - Owner can act on any line
                                                        // - Linked member can only act on their own debt line
                                                        //   (positive amount = they owe the owner)
                                                        const canActLinked = !isOwner && isViewerLine && positive;
                                                        if (!isOwner && !canActLinked)
                                                            return null;
                                                        if (!canWrite)
                                                            return null;
                                                        return (_jsx(Button, { variant: "outline", size: "sm", onClick: () => {
                                                                if (!balances.self_member_id)
                                                                    return;
                                                                if (positive) {
                                                                    // Member owes the owner → from = member, to = owner
                                                                    openSettleUp(line.member_id, balances.self_member_id, Math.abs(line.amount), line.currency);
                                                                }
                                                                else {
                                                                    // Owner owes the member → from = owner, to = member
                                                                    openSettleUp(balances.self_member_id, line.member_id, Math.abs(line.amount), line.currency);
                                                                }
                                                            }, children: canActLinked ? t('splitGroups.payNow') : t('splitGroups.settleUp') }));
                                                    })()] })] }, `${line.member_id}-${line.currency}-${idx}`));
                                }) })) : (_jsx("div", { className: "text-center py-6 text-muted-foreground text-sm", children: t('splitGroups.allSettled') }))] }), _jsxs(SectionCard, { children: [_jsx(SectionHeader, { title: t('splitGroups.recentTransactions'), description: t('splitGroups.recentTransactionsHint'), action: groupTxs && groupTxs.length > 0 ? (_jsxs(Button, { variant: "ghost", size: "sm", className: "gap-1 h-8 text-xs", onClick: () => navigate(`/transactions?group_id=${groupId}`), children: [t('splitGroups.viewAllTransactions'), _jsx(ArrowRight, { size: 12 })] })) : undefined }), !groupTxs ? (_jsxs("div", { className: "p-4 space-y-2", children: [_jsx(Skeleton, { className: "h-10 w-full" }), _jsx(Skeleton, { className: "h-10 w-full" })] })) : groupTxs.length === 0 ? (_jsxs("div", { className: "text-center py-8 text-muted-foreground text-sm flex flex-col items-center gap-2", children: [_jsx(Receipt, { size: 20, className: "opacity-50" }), t('splitGroups.noTransactions')] })) : (_jsx("ul", { className: "divide-y divide-border", children: groupTxs.slice(0, 8).map((tx) => (_jsxs("li", { className: "flex items-center gap-3 px-4 py-3 hover:bg-muted cursor-pointer transition-colors", onClick: () => navigate(`/transactions?group_id=${groupId}&highlight=${tx.id}`), children: [_jsx(CategoryIcon, { icon: tx.category?.icon, color: tx.category?.color, size: "md" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-foreground truncate", children: tx.description }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [new Date(tx.date + 'T00:00:00').toLocaleDateString(dateLocale), tx.category?.name ? ` · ${tx.category.name}` : '', tx.splits && tx.splits.length > 0
                                                            ? ` · ${t('splitGroups.splitWays', { count: tx.splits.length })}`
                                                            : ''] })] }), _jsx("span", { className: `text-sm font-semibold tabular-nums ml-3 ${tx.type === 'debit' ? 'text-rose-500' : 'text-emerald-600'}`, children: formatCurrency(Number(tx.amount), tx.currency, locale) })] }, tx.id))) }))] }), _jsxs(SectionCard, { children: [_jsx(SectionHeader, { title: t('splitGroups.settlements'), action: isOwner && canWrite ? (_jsx(Button, { size: "sm", variant: "outline", className: "gap-1.5 h-8", onClick: () => openSettleUp(), children: t('splitGroups.recordSettlement') })) : undefined }), settlements && settlements.length > 0 ? (_jsx("ul", { className: "divide-y divide-border", children: settlements.map((s) => (_jsxs("li", { className: "flex items-center justify-between px-4 py-3", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "text-sm flex items-center gap-1.5", children: [_jsx("span", { className: "font-medium", children: memberName_(s.from_member_id) }), _jsx(ArrowRight, { size: 12, className: "text-muted-foreground" }), _jsx("span", { className: "font-medium", children: memberName_(s.to_member_id) })] }), _jsxs("p", { className: "text-xs text-muted-foreground mt-0.5", children: [new Date(s.date + 'T00:00:00').toLocaleDateString(dateLocale), s.notes ? ` · ${s.notes}` : ''] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-sm font-semibold tabular-nums", children: formatCurrency(s.amount, s.currency, locale) }), isOwner && canWrite && (_jsx(Button, { variant: "ghost", size: "sm", onClick: () => deleteSettlementMutation.mutate(s.id), title: t('common.delete'), "aria-label": t('common.delete'), children: _jsx(Trash2, { size: 14 }) }))] })] }, s.id))) })) : (_jsx("div", { className: "text-center py-6 text-muted-foreground text-sm", children: t('splitGroups.noSettlements') }))] })] }), _jsx(Dialog, { open: memberDialogOpen, onOpenChange: setMemberDialogOpen, children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: editingMember ? t('splitGroups.editMember') : t('splitGroups.addMember') }) }), _jsx("div", { className: "space-y-4", children: _jsx(MemberForm, { name: memberName, onChangeName: setMemberName, email: memberEmail, onChangeEmail: setMemberEmail, linkedUserId: memberLinkedUserId, onChangeLinkedUserId: setMemberLinkedUserId }) }), _jsxs(DialogFooter, { className: editingMember ? 'flex justify-between sm:justify-between' : '', children: [editingMember && (_jsxs(Button, { variant: "destructive", onClick: () => deleteMemberMutation.mutate(editingMember.id), disabled: deleteMemberMutation.isPending, children: [_jsx(Trash2, { size: 14, className: "mr-1" }), t('common.delete')] })), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "outline", onClick: () => setMemberDialogOpen(false), children: t('common.cancel') }), _jsx(Button, { onClick: saveMember, disabled: !memberName.trim() || memberMutation.isPending, children: t('common.save') })] })] })] }) }), _jsx(Dialog, { open: settleOpen, onOpenChange: setSettleOpen, children: _jsxs(DialogContent, { className: "sm:max-w-md max-h-[85vh] overflow-y-auto", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('splitGroups.recordSettlement') }) }), (() => {
                            const myMemberId = viewerMember?.id ?? (isOwner ? ownerMember?.id : null);
                            const viewerIsPayer = !!myMemberId && settleFrom === myMemberId;
                            return (_jsxs("div", { className: "space-y-4 min-w-0", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('splitGroups.from') }), _jsxs("select", { className: "w-full border border-border rounded-md px-3 py-2 text-sm bg-card", value: settleFrom, onChange: (e) => {
                                                    setSettleFrom(e.target.value);
                                                    // Reset the ledger-side options: only meaningful
                                                    // when the viewer is the payer.
                                                    setSettleTxMode('none');
                                                    setSettleAccountId('');
                                                    setSettlePickedTx(null);
                                                    setSettleTxSearch('');
                                                }, children: [_jsx("option", { value: "", children: t('splitGroups.selectMember') }), group.members.map((m) => (_jsx("option", { value: m.id, children: m.name }, m.id)))] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('splitGroups.to') }), _jsxs("select", { className: "w-full border border-border rounded-md px-3 py-2 text-sm bg-card", value: settleTo, onChange: (e) => setSettleTo(e.target.value), children: [_jsx("option", { value: "", children: t('splitGroups.selectMember') }), group.members.map((m) => (_jsx("option", { value: m.id, children: m.name }, m.id)))] })] }), viewerIsPayer && (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('splitGroups.txAction') }), _jsxs("select", { className: "w-full border border-border rounded-md px-3 py-2 text-sm bg-card", value: settleTxMode, onChange: (e) => {
                                                    setSettleTxMode(e.target.value);
                                                    setSettleAccountId('');
                                                    setSettlePickedTx(null);
                                                    setSettleTxSearch('');
                                                }, children: [_jsx("option", { value: "none", children: t('splitGroups.txActionNone') }), _jsx("option", { value: "create", children: t('splitGroups.txActionCreate') }), _jsx("option", { value: "existing", children: t('splitGroups.txActionExisting') })] }), settleTxMode === 'create' && (_jsxs("div", { className: "space-y-1", children: [_jsxs("select", { className: "w-full border border-border rounded-md px-3 py-2 text-sm bg-card", value: settleAccountId, onChange: (e) => setSettleAccountId(e.target.value), children: [_jsx("option", { value: "", children: t('splitGroups.selectAccount') }), sortAccountsByDisplayName(accountsList ?? []).map((a) => (_jsx("option", { value: a.id, children: getAccountName(a) }, a.id)))] }), _jsx("p", { className: "text-xs text-muted-foreground", children: t('splitGroups.affectAccountHint') })] })), settleTxMode === 'existing' && (_jsxs("div", { className: "space-y-1.5", children: [_jsx(Input, { type: "text", value: settleTxSearch, onChange: (e) => setSettleTxSearch(e.target.value), placeholder: t('splitGroups.searchTransaction') }), _jsx("div", { className: "max-h-44 overflow-y-auto rounded-md border border-border divide-y divide-border", children: (settleTxOptions?.items ?? []).length === 0 ? (_jsx("p", { className: "text-xs text-muted-foreground px-3 py-4 text-center", children: t('splitGroups.noTransactions') })) : ((settleTxOptions?.items ?? []).map((tx) => {
                                                            const picked = settlePickedTx?.id === tx.id;
                                                            return (_jsxs("button", { type: "button", onClick: () => {
                                                                    // Picking an existing transaction *as* the
                                                                    // settlement: align amount, currency and
                                                                    // date so the two records can't disagree.
                                                                    setSettlePickedTx(tx);
                                                                    setSettleAmount(Number(tx.amount).toFixed(2));
                                                                    setSettleCurrency(tx.currency);
                                                                    setSettleDate(tx.date);
                                                                }, className: `w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-3 ${picked ? 'bg-primary/10' : 'hover:bg-muted/50'}`, children: [_jsxs("span", { className: "min-w-0 truncate", children: [_jsx("span", { className: "text-muted-foreground", children: tx.date }), " \u00B7", ' ', tx.description] }), _jsxs("span", { className: "shrink-0 tabular-nums text-muted-foreground", children: [tx.amount, " ", tx.currency] })] }, tx.id));
                                                        })) }), settlePickedTx && (_jsxs("p", { className: "text-xs text-muted-foreground truncate", children: [t('splitGroups.selectedTransaction'), ": ", settlePickedTx.date, " \u00B7", ' ', settlePickedTx.description] }))] }))] })), _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsxs("div", { className: "space-y-2 col-span-2", children: [_jsx(Label, { children: t('splitGroups.amount') }), _jsx(Input, { type: "number", step: "0.01", value: settleAmount, onChange: (e) => setSettleAmount(e.target.value), disabled: settleTxMode === 'existing' })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('splitGroups.currency') }), _jsx(Input, { value: settleCurrency, maxLength: 3, onChange: (e) => setSettleCurrency(e.target.value.toUpperCase()), disabled: settleTxMode === 'existing' })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('splitGroups.date') }), _jsx(DatePickerInput, { value: settleDate, onChange: setSettleDate, className: "w-full justify-start", disabled: settleTxMode === 'existing' })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('splitGroups.notes') }), _jsx("textarea", { className: "w-full border border-input rounded-md px-3 py-2 text-sm bg-card resize-none", rows: 2, value: settleNotes, onChange: (e) => setSettleNotes(e.target.value) })] })] }));
                        })(), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setSettleOpen(false), children: t('common.cancel') }), _jsx(Button, { onClick: saveSettlement, disabled: !settleFrom ||
                                        !settleTo ||
                                        settleFrom === settleTo ||
                                        !settleAmount ||
                                        (settleTxMode === 'create' && !settleAccountId) ||
                                        (settleTxMode === 'existing' && !settlePickedTx) ||
                                        settlementMutation.isPending, children: t('common.save') })] })] }) })] }));
}
