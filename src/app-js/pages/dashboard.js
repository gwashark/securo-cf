import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useMemo, useRef } from 'react';
import { getAccountLabel, getAccountName, sumAccountBalances } from '../lib/account-utils.js';
import { currentMonth, shiftMonth, monthLastDay, monthLabel, monthRange } from '../lib/month-utils.js';
import { useTranslation } from 'react-i18next';
import { useDisplayLocale, useDateLocale } from '../hooks/use-display-locale.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { dashboard, transactions, budgets, categories as categoriesApi, categoryGroups as categoryGroupsApi, accounts as accountsApi, goals as goalsApi, groups as groupsApi, payees as payeesApi, rules as rulesApi } from '../lib/api.js';
import { invalidateFinancialQueries } from '../lib/invalidate-queries.js';
import { toast } from 'sonner';
import { Skeleton } from '../components/ui/skeleton.js';
import { Button } from '../components/ui/button.js';
import { ProjectedTransactionBadge } from '../components/projected-transaction-badge.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '../components/ui/select.js';
import { Popover, PopoverTrigger, PopoverContent } from '../components/ui/popover.js';
import { Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip.js';
import { MonthPicker } from '../components/ui/monthpicker.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '../components/ui/table.js';
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, } from 'recharts';
import { CheckCircle2, CalendarIcon, Clock, Paperclip, Target, ArrowUpDown, HelpCircle, EyeClosed, AlertCircle } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ICON_MAP } from '../lib/category-icons.js';
import { PageHeader } from '../components/page-header.js';
import { CategoryIcon } from '../components/category-icon.js';
import { AccountIcon } from '../components/account-icon.js';
import { TransactionDrillDown } from '../components/transaction-drill-down.js';
import { TransactionDialog } from '../components/transaction-dialog.js';
import { extractApiError } from '../lib/api-errors.js';
import { TransactionCalendarView } from '../components/transaction-calendar-view.js';
import { TransactionsViewSwitcher } from '../components/transactions-view-switcher.js';
import { RuleDialog } from '../components/rule-dialog.js';
import { usePrivacyMode } from '../hooks/use-privacy-mode.js';
import { useIsMobile } from '../hooks/use-mobile.js';
import { useAuth } from '../contexts/auth-context.js';
import { useCollectionFilter } from '../contexts/collection-filter-context.js';
import { resolveDateFnsLocale } from '../lib/date-fns-locale.js';
import { formatCurrency } from '../lib/format.js';
import { shouldShowPendingBadge } from '../lib/transaction-status.js';
function formatDate(dateStr, locale = 'pt-BR') {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString(locale);
}
function parseHashtags(notes) {
    if (!notes)
        return [];
    const matches = notes.match(/#[\w\u00C0-\u017E-]+/g);
    return matches ?? [];
}
const MONTH_REGEX = /^\d{4}-\d{2}$/;
const MONTH_STRING_LENGTH = 7;
function parseMonthFromParams(params) {
    const monthParam = params.get('month');
    if (monthParam && MONTH_REGEX.test(monthParam)) {
        return monthParam;
    }
    const fromParam = params.get('from');
    if (fromParam && fromParam.length >= MONTH_STRING_LENGTH) {
        const parsedMonth = fromParam.substring(0, MONTH_STRING_LENGTH);
        if (MONTH_REGEX.test(parsedMonth)) {
            return parsedMonth;
        }
    }
    return null;
}
export default function DashboardPage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { mask, privacyMode, MASK } = usePrivacyMode();
    const isMobile = useIsMobile();
    const { user } = useAuth();
    const userCurrency = user?.preferences?.currency_display ?? 'USD';
    const displayName = user?.preferences?.display_name || '';
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const greeting = (() => {
        const hour = new Date().getHours();
        const key = hour < 12 ? 'greetingMorning' : hour < 18 ? 'greetingAfternoon' : 'greetingEvening';
        const base = t(`dashboard.${key}`);
        return displayName ? `${base}, ${displayName}` : base;
    })();
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedMonth, setSelectedMonth] = useState(() => {
        return parseMonthFromParams(searchParams) ?? currentMonth();
    });
    const [drillDown, setDrillDown] = useState(null);
    // Transactions section view, mirroring the transactions page: the choice
    // lives in the URL so the section can be refreshed, bookmarked or shared.
    const [txViewMode, setTxViewMode] = useState(() => (searchParams.get('view') === 'calendar' ? 'calendar' : 'list'));
    const [calendarSelectedDate, setCalendarSelectedDate] = useState(() => searchParams.get('day') ?? '');
    const prevSearchRef = useRef(null);
    // Sync state from URL when navigating (e.g. back/forward button)
    useEffect(() => {
        const search = searchParams.toString();
        if (prevSearchRef.current === search)
            return;
        const isInitial = prevSearchRef.current === null;
        prevSearchRef.current = search;
        const parsedMonth = parseMonthFromParams(searchParams);
        if (parsedMonth) {
            setSelectedMonth(parsedMonth);
        }
        else if (!isInitial) {
            setSelectedMonth(currentMonth());
        }
        setTxViewMode(searchParams.get('view') === 'calendar' ? 'calendar' : 'list');
        setCalendarSelectedDate(searchParams.get('day') ?? '');
    }, [searchParams]);
    // Sync selectedMonth and the transactions view back to URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (selectedMonth) {
            params.set('month', selectedMonth);
            params.delete('from');
            params.delete('to');
        }
        else {
            params.delete('month');
        }
        if (txViewMode === 'calendar') {
            params.set('view', 'calendar');
            if (calendarSelectedDate)
                params.set('day', calendarSelectedDate);
            else
                params.delete('day');
        }
        else {
            params.delete('view');
            params.delete('day');
        }
        setSearchParams(params, { replace: true });
    }, [selectedMonth, txViewMode, calendarSelectedDate, setSearchParams]);
    const [editingTx, setEditingTx] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [createRuleOpen, setCreateRuleOpen] = useState(false);
    const [createRuleInitialData, setCreateRuleInitialData] = useState(undefined);
    const queryClient = useQueryClient();
    const [headerCalOpen, setHeaderCalOpen] = useState(false);
    const [hoveredDay, setHoveredDay] = useState(null);
    const dateFnsLocale = resolveDateFnsLocale(i18n.resolvedLanguage ?? i18n.language);
    const { from: monthStart, to: monthEnd } = monthRange(selectedMonth);
    const monthParam = monthStart;
    const uiLocale = i18n.resolvedLanguage ?? i18n.language;
    const monthLabelStr = monthLabel(selectedMonth, uiLocale);
    const handleMonthChange = (newMonth) => {
        setSelectedMonth(newMonth);
    };
    // Active Collection filter (issue #105): scope dashboard cards to its
    // accounts. undefined when "All accounts".
    const { activeAccountIds, activeWalletIds } = useCollectionFilter();
    const acctIds = activeAccountIds ?? undefined;
    const walletIds = activeWalletIds ?? undefined;
    // A wallet-only collection (active, but with zero accounts) has no account
    // data — skip the account-only cards so they render empty instead of
    // silently falling back to "all accounts".
    const noAccounts = activeAccountIds !== null && activeAccountIds.length === 0;
    const { data: summary, isLoading: summaryLoading } = useQuery({
        queryKey: ['dashboard', 'summary', selectedMonth, activeAccountIds, activeWalletIds],
        queryFn: () => dashboard.summary(monthParam, undefined, acctIds, walletIds),
    });
    const { data: spending, isLoading: spendingLoading } = useQuery({
        queryKey: ['dashboard', 'spending', selectedMonth, activeAccountIds],
        queryFn: () => dashboard.spendingByCategory(monthParam, acctIds),
        enabled: !noAccounts,
    });
    const prevMonth = shiftMonth(selectedMonth, -1);
    const { data: balanceHistory, isLoading: balanceHistoryLoading } = useQuery({
        queryKey: ['dashboard', 'balance-history', selectedMonth, activeAccountIds],
        queryFn: () => dashboard.balanceHistory(monthParam, acctIds),
        enabled: !noAccounts,
    });
    const { data: currentMonthTxs, isLoading: currentTxLoading } = useQuery({
        queryKey: ['transactions', 'cumulative', selectedMonth, activeAccountIds],
        queryFn: () => transactions.list({
            from: monthStart,
            to: monthEnd,
            limit: 500,
            exclude_transfers: true,
            account_ids: acctIds,
        }),
        enabled: !noAccounts,
    });
    // Same month grid the transactions page renders, scoped to the active
    // collection's accounts. Only fetched while the calendar is on screen.
    const calendarAccountIds = acctIds && acctIds.length > 0 ? acctIds : undefined;
    const { data: calendarData, isLoading: calendarLoading } = useQuery({
        queryKey: ['transactions', 'calendar', selectedMonth, activeAccountIds],
        enabled: txViewMode === 'calendar' && !noAccounts,
        queryFn: () => transactions.calendar({
            month: monthStart,
            account_ids: calendarAccountIds,
        }),
    });
    // Resolve group_id → name for the badge on split transactions.
    const { data: allGroups } = useQuery({
        queryKey: ['groups', 'all'],
        queryFn: () => groupsApi.list(true),
        staleTime: 60_000,
    });
    const groupNameById = useMemo(() => {
        const map = new Map();
        for (const g of allGroups ?? [])
            map.set(g.id, g.name);
        return map;
    }, [allGroups]);
    const { data: projectedTxs, isLoading: projectedTxLoading } = useQuery({
        queryKey: ['dashboard', 'projected-transactions', selectedMonth],
        queryFn: () => dashboard.projectedTransactions({ month: monthParam }),
    });
    const { data: budgetComparison } = useQuery({
        queryKey: ['budgets', 'comparison', selectedMonth],
        queryFn: () => budgets.comparison(monthParam),
    });
    const { data: categoriesList } = useQuery({
        queryKey: ['categories'],
        queryFn: categoriesApi.list,
    });
    const { data: categoryGroupsList } = useQuery({
        queryKey: ['categoryGroups'],
        queryFn: categoryGroupsApi.list,
    });
    const { data: accountsList, isLoading: accountsLoading, isError: accountsError } = useQuery({
        queryKey: ['accounts'],
        queryFn: () => accountsApi.list(),
    });
    const { data: payeesList } = useQuery({
        queryKey: ['payees'],
        queryFn: payeesApi.list,
    });
    const { data: goalsSummary } = useQuery({
        queryKey: ['goals', 'summary'],
        queryFn: () => goalsApi.summary(3),
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }) => transactions.update(id, data),
        onSuccess: () => {
            invalidateFinancialQueries(queryClient);
            setDialogOpen(false);
            setEditingTx(null);
        },
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => transactions.delete(id),
        onSuccess: () => {
            invalidateFinancialQueries(queryClient);
            setDialogOpen(false);
            setEditingTx(null);
        },
    });
    const unlinkTransferMutation = useMutation({
        mutationFn: (pairId) => transactions.unlinkTransfer(pairId),
        onSuccess: () => {
            invalidateFinancialQueries(queryClient);
            setDialogOpen(false);
            setEditingTx(null);
        },
    });
    const createRuleMutation = useMutation({
        mutationFn: (data) => rulesApi.create(data),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['rules'] });
            setCreateRuleOpen(false);
            setCreateRuleInitialData(undefined);
            const applied = result.applied_count ?? 0;
            if (applied > 0) {
                invalidateFinancialQueries(queryClient);
                queryClient.invalidateQueries({ queryKey: ['payees'] });
                toast.success(t('rules.createdAndApplied', { count: applied }));
            }
            else {
                toast.success(t('rules.created'));
            }
        },
        onError: (error) => {
            const err = error;
            if (err?.response?.status === 409) {
                toast.error(t('rules.duplicateName'));
            }
            else {
                toast.error(t('common.error'));
            }
        },
    });
    const handleCreateRuleFromTransaction = (tx) => {
        const conditions = [
            { field: 'description', op: 'contains', value: tx.description },
        ];
        if (tx.payee_id) {
            conditions.push({ field: 'payee_id', op: 'equals', value: tx.payee_id });
        }
        const actions = tx.category_id
            ? [{ op: 'set_category', value: tx.category_id }]
            : [{ op: 'set_category', value: '' }];
        const tags = parseHashtags(tx.notes);
        if (tags.length > 0) {
            actions.push({ op: 'append_notes', value: tags.join(' ') });
        }
        setCreateRuleInitialData({ conditions, actions });
        setCreateRuleOpen(true);
    };
    // Calendar rows carry only an id, so the full transaction is fetched before
    // the edit dialog opens (same as the transactions page).
    const handleOpenCalendarTransaction = async (id) => {
        try {
            const tx = await transactions.get(id);
            setEditingTx(tx);
            setDialogOpen(true);
        }
        catch {
            toast.error(t('common.error'));
        }
    };
    const cumulativeData = useMemo(() => {
        if (!balanceHistory)
            return [];
        const daysInMonth = monthLastDay(selectedMonth);
        const result = [];
        let lastPrevBalance = 0;
        for (let day = 1; day <= daysInMonth; day++) {
            const cur = balanceHistory.current.find(d => d.day === day);
            const prev = balanceHistory.previous.find(d => d.day === day);
            if (prev?.balance != null) {
                lastPrevBalance = prev.balance;
            }
            result.push({
                day,
                current: cur?.balance ?? null,
                previous: prev?.balance ?? lastPrevBalance,
            });
        }
        return result;
    }, [balanceHistory, selectedMonth]);
    const lastCurrentPoint = [...cumulativeData].reverse().find(d => d.current !== null);
    const lastDay = lastCurrentPoint?.day ?? 0;
    const currentStartBalance = balanceHistory?.current.find(d => d.day === 1)?.balance ?? 0;
    const currentLatestBalance = lastCurrentPoint?.current ?? 0;
    const monthVariation = currentLatestBalance - currentStartBalance;
    const primaryCurrency = summary?.primary_currency ?? userCurrency;
    const totalBalance = summary?.total_balance_primary ?? Object.values(summary?.total_balance ?? {}).reduce((a, b) => a + Number(b), 0);
    const projectedBalance = summary?.projected_balance_primary ?? Object.values(summary?.projected_balance ?? {}).reduce((a, b) => a + Number(b), 0);
    const hasProjectedBalance = Math.abs(projectedBalance - totalBalance) >= 0.01;
    const assetsValue = summary?.assets_value_primary ?? Object.values(summary?.assets_value ?? {}).reduce((a, b) => a + b, 0);
    // Available balance: checking/savings accounts only — what's actually
    // spendable today, as opposed to `totalBalance` (net worth: accounts +
    // investments - open card bills). Scoped to the active Collection filter,
    // same as the rest of the dashboard.
    const availableBalanceAccounts = useMemo(() => {
        const all = accountsList ?? [];
        const scoped = activeAccountIds ? all.filter((a) => activeAccountIds.includes(a.id)) : all;
        return scoped.filter((a) => a.type === 'checking' || a.type === 'savings');
    }, [accountsList, activeAccountIds]);
    const availableBalance = availableBalanceAccounts.reduce((sum, a) => sum + Number(a.balance_primary ?? a.current_balance), 0);
    // While accounts are loading or failed to load, treat their balance
    // components as unavailable rather than silently rendering zero.
    const accountsUnavailable = accountsLoading || accountsError;
    const creditCardBalance = sumAccountBalances((accountsList ?? [])
        .filter((a) => (activeAccountIds ? activeAccountIds.includes(a.id) : true) && a.type === 'credit_card'));
    // Net worth's "Available balance" breakdown row: every non-card account
    // (unlike the headline `availableBalance`, which is checking/savings only),
    // so it reconciles with `totalBalance` — which sums all account types.
    const nonCardAccountsBalance = (accountsList ?? [])
        .filter((a) => (activeAccountIds ? activeAccountIds.includes(a.id) : true) && a.type !== 'credit_card')
        .reduce((sum, a) => sum + Number(a.balance_primary ?? a.current_balance), 0);
    // Savings rate & projection
    const income = Number(summary?.monthly_income_primary ?? summary?.monthly_income ?? 0);
    const expenses = Number(summary?.monthly_expenses_primary ?? summary?.monthly_expenses ?? 0);
    // What the month is still expected to close at, once recurring entries that
    // have not posted yet are counted. Rendered only when it differs from the
    // realised figure, so a month with nothing pending stays quiet.
    const projectedIncome = Number(summary?.projected_income_primary ?? summary?.projected_income ?? income);
    const projectedExpenses = Number(summary?.projected_expenses_primary ?? summary?.projected_expenses ?? expenses);
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
    const isCurrentMonth = selectedMonth === currentMonth();
    const daysElapsed = isCurrentMonth ? new Date().getDate() : monthLastDay(selectedMonth);
    const daysInMonth = monthLastDay(selectedMonth);
    const projectedSpend = expenses > 0 && isCurrentMonth && daysElapsed > 0
        ? (expenses / daysElapsed) * daysInMonth
        : null;
    // Uncategorized data
    const uncategorizedCount = summary?.pending_categorization ?? 0;
    const uncategorizedAmount = summary?.pending_categorization_amount ?? 0;
    const [catSortDesc, setCatSortDesc] = useState(true);
    // Merged category bars data
    const mergedCategories = useMemo(() => {
        if (!spending)
            return [];
        const budgetMap = new Map();
        if (budgetComparison) {
            for (const b of budgetComparison) {
                budgetMap.set(b.category_id, b);
            }
        }
        return spending
            .filter(s => s.category_id !== null)
            .map(s => {
            const budget = s.category_id ? budgetMap.get(s.category_id) : undefined;
            // The category widget must show the same spend set as its drill-down:
            // settled transactions plus pending/future rows and recurring
            // projections. The API keeps `total` as settled-only for callers that
            // need the actual/forecast split, while `projected_total` is the
            // user-visible all-in amount.
            const actual = s.projected_total;
            const prevAmount = budget ? Number(budget.projected_prev_month_amount) : 0;
            let momPct = null;
            if (prevAmount > 0) {
                momPct = ((actual - prevAmount) / prevAmount) * 100;
            }
            else if (actual > 0) {
                momPct = 100;
            }
            return {
                category_id: s.category_id,
                category_name: s.category_name,
                category_icon: s.category_icon,
                category_color: s.category_color,
                actual,
                budget_amount: budget ? Number(budget.budget_amount) : null,
                percentage_used: budget?.percentage_used ?? null,
                momPct,
            };
        })
            .sort((a, b) => catSortDesc ? b.actual - a.actual : a.actual - b.actual);
    }, [spending, budgetComparison, catSortDesc]);
    const [txPage, setTxPage] = useState(1);
    const [txSortDesc, setTxSortDesc] = useState(true);
    useEffect(() => setTxPage(1), [selectedMonth]);
    const [txPerPage, setTxPerPage] = useState(() => {
        try {
            const stored = localStorage.getItem('securo.dashboard.pageSize');
            return stored ? Number(stored) : 10;
        }
        catch {
            return 10;
        }
    });
    const allDisplayRows = useMemo(() => {
        const rows = [];
        for (const tx of currentMonthTxs?.items ?? []) {
            const isShared = !!tx.is_shared;
            const displayAmount = isShared && tx.viewer_share != null ? Number(tx.viewer_share) : Number(tx.amount);
            const groupId = tx.group_id ?? null;
            // Owner-side share: backend populates viewer_share for owners
            // who participate in their own split. Suppress when it equals
            // the parent amount (sole-member case = no useful info).
            const ownerShareRaw = !isShared && tx.viewer_share != null ? Number(tx.viewer_share) : null;
            const ownerShare = ownerShareRaw != null && Math.abs(ownerShareRaw) !== Math.abs(Number(tx.amount))
                ? ownerShareRaw
                : null;
            rows.push({
                key: tx.id,
                description: tx.description,
                date: tx.date,
                type: tx.type,
                amount: displayAmount,
                amountPrimary: tx.amount_primary != null ? Number(tx.amount_primary) : null,
                currency: tx.currency,
                categoryIcon: tx.category?.icon ?? null,
                categoryName: tx.category?.name ?? null,
                categoryColor: tx.category?.color ?? null,
                accountId: tx.account_id ?? null,
                isProjected: false,
                attachmentCount: tx.attachment_count ?? 0,
                isShared,
                parentTotal: isShared ? Number(tx.amount) : null,
                ownerShare,
                groupId,
                parentOwnerName: isShared ? tx.parent_owner_name ?? null : null,
                groupName: groupId ? groupNameById.get(groupId) ?? null : null,
                isIgnored: tx.is_ignored,
                installmentNumber: tx.installment_number,
                totalInstallments: tx.total_installments,
                showPendingBadge: shouldShowPendingBadge(tx),
            });
        }
        for (const pt of projectedTxs ?? []) {
            rows.push({
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
                accountId: pt.account_id,
                isProjected: true,
                attachmentCount: 0,
                isShared: false,
                parentTotal: null,
                ownerShare: null,
                groupId: null,
                parentOwnerName: null,
                groupName: null,
                isIgnored: false,
                installmentNumber: null,
                totalInstallments: null,
                showPendingBadge: false,
            });
        }
        rows.sort((a, b) => txSortDesc ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
        return rows;
    }, [currentMonthTxs, projectedTxs, txSortDesc, groupNameById]);
    const txTotalPages = Math.ceil(allDisplayRows.length / txPerPage);
    const pagedRows = allDisplayRows.slice((txPage - 1) * txPerPage, txPage * txPerPage);
    const txListLoading = currentTxLoading || projectedTxLoading;
    // Savings rate display
    const savingsRateColor = income === 0 && expenses > 0
        ? 'text-rose-500'
        : savingsRate > 0
            ? 'text-emerald-600'
            : savingsRate < 0
                ? 'text-rose-500'
                : 'text-muted-foreground';
    const savingsRateDisplay = income === 0 && expenses > 0
        ? '---'
        : `${savingsRate.toFixed(0)}%`;
    return (_jsxs("div", { children: [_jsx(PageHeader, { section: greeting, title: monthLabel(selectedMonth, uiLocale).replace(/^\w/, c => c.toUpperCase()), action: _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { className: "h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-border hover:text-foreground transition-all text-base", onClick: () => handleMonthChange(shiftMonth(selectedMonth, -1)), children: "\u2039" }), _jsxs(Popover, { open: headerCalOpen, onOpenChange: setHeaderCalOpen, children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs("button", { type: "button", className: "inline-flex items-center justify-center gap-2 border border-border rounded-lg px-3 py-1.5 text-sm bg-card text-foreground hover:bg-muted/50 transition-all cursor-pointer min-w-[180px]", children: [_jsx(CalendarIcon, { className: "size-3.5 text-muted-foreground" }), monthLabel(selectedMonth, uiLocale).replace(/^\w/, c => c.toUpperCase())] }) }), _jsx(PopoverContent, { align: "center", className: "w-auto p-0", children: _jsx(MonthPicker, { locale: dateFnsLocale, selectedMonth: new Date(`${selectedMonth}-01T00:00:00`), onMonthSelect: (date) => {
                                            if (!date)
                                                return;
                                            const newMonth = format(date, 'yyyy-MM');
                                            setSelectedMonth(newMonth);
                                            setHeaderCalOpen(false);
                                        } }) })] }), _jsx("button", { className: "h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-border hover:text-foreground transition-all text-base", onClick: () => handleMonthChange(shiftMonth(selectedMonth, 1)), children: "\u203A" })] }) }), _jsxs("div", { className: "bg-card rounded-xl border border-border shadow-sm mb-5 px-5 pt-5 pb-4", children: [_jsxs("div", { className: "pb-4 mb-4 border-b border-border", children: [_jsx("p", { className: "text-xs font-semibold text-muted-foreground mb-1", children: t('dashboard.availableBalance') }), summaryLoading || accountsUnavailable ? (_jsx(Skeleton, { className: "h-9 w-40" })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: `text-3xl font-bold tabular-nums leading-tight ${availableBalance < 0 ? 'text-rose-500' : 'text-foreground'}`, children: mask(formatCurrency(availableBalance, primaryCurrency, locale)) }), availableBalanceAccounts.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1.5 mt-3", children: availableBalanceAccounts.map((acc) => {
                                            const bal = Number(acc.balance_primary ?? acc.current_balance);
                                            const balCurrency = acc.balance_primary != null ? primaryCurrency : acc.currency;
                                            // A link, not a click handler: the chip is a navigation
                                            // target, so it gets keyboard focus and cmd-click into a
                                            // new tab for free. Scale on hover only, which the
                                            // compositor handles without touching layout.
                                            return (_jsxs(Link, { to: `/accounts/${acc.id}`, className: "group inline-flex items-center gap-1 text-[11px] pl-1 pr-2 py-0.5 rounded-full border border-border bg-background transition-transform duration-150 ease-out hover:scale-105 hover:border-foreground/25 focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]", children: [_jsx(AccountIcon, { account: acc, size: "xs", className: "w-4 h-4 rounded-md" }), _jsx("span", { className: "text-muted-foreground group-hover:text-foreground transition-colors", children: getAccountLabel(acc) }), _jsx("span", { className: `font-semibold tabular-nums ${bal < 0 ? 'text-rose-500' : 'text-foreground'}`, children: mask(formatCurrency(bal, balCurrency, locale)) })] }, acc.id));
                                        }) })), summary && Math.abs(summary.pending_shares_net) >= 0.01 && (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("p", { className: "text-xs tabular-nums mt-2.5 inline-block cursor-help text-muted-foreground underline decoration-dotted underline-offset-2", children: summary.pending_shares_net < 0
                                                        ? t('dashboard.pendingSharesOwe', {
                                                            net: mask(formatCurrency(availableBalance + summary.pending_shares_net, primaryCurrency, locale)),
                                                            owed: mask(formatCurrency(Math.abs(summary.pending_shares_net), primaryCurrency, locale)),
                                                        })
                                                        : t('dashboard.pendingSharesOwed', {
                                                            net: mask(formatCurrency(availableBalance + summary.pending_shares_net, primaryCurrency, locale)),
                                                            owed: mask(formatCurrency(summary.pending_shares_net, primaryCurrency, locale)),
                                                        }) }) }), _jsx(TooltipContent, { children: t('dashboard.pendingSharesTooltip') })] }))] }))] }), _jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-4", children: [_jsxs("button", { type: "button", className: "min-w-0 text-left cursor-pointer hover:opacity-70 transition-opacity", onClick: () => setDrillDown({
                                    title: t('dashboard.drillDownIncome', { month: monthLabelStr }),
                                    type: 'credit',
                                    from: monthStart,
                                    to: monthEnd,
                                }), children: [_jsx("p", { className: "text-xs font-medium text-muted-foreground mb-1 min-h-[16px] flex items-center", children: t('dashboard.monthlyIncome') }), summaryLoading ? (_jsx(Skeleton, { className: "h-6 w-20" })) : (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-xl font-bold tabular-nums text-emerald-600", children: ["+", mask(formatCurrency(income, primaryCurrency, locale))] }), Math.abs(projectedIncome - income) >= 0.01 && (_jsxs("p", { className: "text-xs text-muted-foreground tabular-nums mt-1", children: [t('dashboard.projectedIncome'), " ", mask(formatCurrency(projectedIncome, primaryCurrency, locale))] }))] }))] }), _jsxs("button", { type: "button", className: "relative min-w-0 text-left cursor-pointer hover:opacity-70 transition-opacity before:content-[''] before:hidden sm:before:block before:absolute before:-left-2.5 before:top-1.5 before:bottom-1.5 before:w-px before:bg-border", onClick: () => setDrillDown({
                                    title: t('dashboard.drillDownExpenses', { month: monthLabelStr }),
                                    type: 'debit',
                                    from: monthStart,
                                    to: monthEnd,
                                }), children: [_jsx("p", { className: "text-xs font-medium text-muted-foreground mb-1 min-h-[16px] flex items-center", children: t('dashboard.monthlyExpenses') }), summaryLoading ? (_jsx(Skeleton, { className: "h-6 w-20" })) : (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-xl font-bold tabular-nums text-rose-500", children: ["-", mask(formatCurrency(expenses, primaryCurrency, locale))] }), Math.abs(projectedExpenses - expenses) >= 0.01 && (_jsxs("p", { className: "text-xs text-muted-foreground tabular-nums mt-1", children: [t('dashboard.projectedExpenses'), " ", mask(formatCurrency(projectedExpenses, primaryCurrency, locale))] }))] }))] }), _jsxs("div", { className: "relative min-w-0 before:content-[''] before:hidden sm:before:block before:absolute before:-left-2.5 before:top-1.5 before:bottom-1.5 before:w-px before:bg-border", children: [_jsxs("p", { className: "text-xs font-medium text-muted-foreground mb-1 min-h-[16px] flex items-center gap-1", children: [t('dashboard.netWorth'), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("button", { type: "button", className: "inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors text-[9px] font-bold leading-none", children: "i" }) }), _jsxs(TooltipContent, { className: "w-56", children: [_jsx("p", { children: t('dashboard.netWorthTooltip') }), _jsxs("div", { className: "mt-1.5 pt-1.5 border-t border-background/20 space-y-0.5", children: [_jsxs("div", { className: "flex justify-between gap-3", children: [_jsx("span", { children: t('dashboard.availableBalance') }), _jsx("span", { children: mask(formatCurrency(nonCardAccountsBalance, primaryCurrency, locale)) })] }), assetsValue > 0 && (_jsxs("div", { className: "flex justify-between gap-3", children: [_jsx("span", { children: t('dashboard.assetsValue') }), _jsx("span", { children: mask(formatCurrency(assetsValue, primaryCurrency, locale)) })] })), creditCardBalance !== 0 && (_jsxs("div", { className: "flex justify-between gap-3", children: [_jsx("span", { children: t('dashboard.creditCardBalance') }), _jsx("span", { children: mask(formatCurrency(creditCardBalance, primaryCurrency, locale)) })] })), hasProjectedBalance && (_jsxs("div", { className: "flex justify-between gap-3", children: [_jsx("span", { children: t('dashboard.projectedBalance') }), _jsx("span", { children: mask(formatCurrency(projectedBalance, primaryCurrency, locale)) })] }))] })] })] })] }), summaryLoading || accountsUnavailable ? (_jsx(Skeleton, { className: "h-6 w-24" })) : (_jsx("p", { className: `text-xl font-bold tabular-nums ${totalBalance < 0 ? 'text-rose-500' : 'text-foreground'}`, children: mask(formatCurrency(totalBalance, primaryCurrency, locale)) }))] }), _jsxs("div", { className: "relative min-w-0 before:content-[''] before:hidden sm:before:block before:absolute before:-left-2.5 before:top-1.5 before:bottom-1.5 before:w-px before:bg-border", children: [_jsx("p", { className: "text-xs font-medium text-muted-foreground mb-1 min-h-[16px] flex items-center", children: t('dashboard.savingsRate') }), summaryLoading ? (_jsx(Skeleton, { className: "h-6 w-16" })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: `text-xl font-bold tabular-nums ${savingsRateColor}`, children: savingsRateDisplay }), _jsx("p", { className: "text-[10px] text-muted-foreground mt-0.5", children: t('dashboard.savingsRateCaption') })] }))] })] }), projectedSpend !== null && !summaryLoading && (_jsx("p", { className: "text-xs text-muted-foreground mt-3", children: t('dashboard.spendingProjection', { amount: mask(formatCurrency(projectedSpend, primaryCurrency, locale)) }) }))] }), !summaryLoading && (uncategorizedCount > 0 ? (_jsxs("button", { type: "button", className: "w-full flex items-center justify-between gap-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-4 py-2.5 mb-5 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors", onClick: () => setDrillDown({
                    title: t('dashboard.drillDownUncategorized'),
                    uncategorized: true,
                }), children: [_jsxs("div", { className: "flex items-center gap-2.5 min-w-0", children: [_jsx(AlertCircle, { size: 16, className: `shrink-0 ${uncategorizedCount >= 20 ? 'text-amber-600 dark:text-amber-400' : 'text-amber-500 dark:text-amber-500'}` }), _jsxs("span", { className: "text-sm text-amber-900 dark:text-amber-200 truncate", children: [t('dashboard.uncategorizedCta', { count: uncategorizedCount }), uncategorizedAmount > 0 && (_jsxs("span", { className: "text-amber-700/70 dark:text-amber-300/70", children: [" \u00B7 ", mask(formatCurrency(uncategorizedAmount, userCurrency, locale))] }))] })] }), _jsxs("span", { className: "shrink-0 text-sm font-semibold text-amber-600 dark:text-amber-400 hover:underline", children: [t('dashboard.categorizeNow'), " \u2192"] })] })) : (_jsxs("div", { className: "flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-lg px-4 py-2.5 mb-5", children: [_jsx(CheckCircle2, { className: "w-4 h-4 text-emerald-500 shrink-0" }), _jsx("span", { className: "text-sm text-emerald-900 dark:text-emerald-200", children: t('dashboard.allCategorized') })] }))), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5", style: { gridAutoRows: 'minmax(380px, auto)' }, children: [_jsxs("div", { className: "bg-card rounded-xl border border-border shadow-sm flex flex-col max-h-[420px]", children: [_jsxs("div", { className: "px-5 py-4 border-b border-border shrink-0 flex items-center justify-between", children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: t('dashboard.spendingByCategory') }), _jsxs("button", { onClick: () => setCatSortDesc(v => !v), className: "flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer", children: [_jsx(ArrowUpDown, { size: 13 }), catSortDesc ? t('dashboard.sortHighest') : t('dashboard.sortLowest')] })] }), _jsx("div", { className: "p-3 overflow-y-auto flex-1", children: spendingLoading ? (_jsx("div", { className: "space-y-3 p-2", children: Array.from({ length: 4 }).map((_, i) => (_jsx(Skeleton, { className: "h-12 w-full" }, i))) })) : mergedCategories.length > 0 ? (_jsx("div", { className: "space-y-1.5", children: mergedCategories.map((item) => {
                                        const hasBudget = item.budget_amount != null && item.budget_amount > 0;
                                        const pct = item.percentage_used;
                                        const barColor = hasBudget
                                            ? pct > 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-500'
                                            : 'bg-muted-foreground/20';
                                        return (_jsx("div", { className: "rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer", onClick: () => setDrillDown({
                                                title: t('dashboard.drillDownCategory', { category: item.category_name, month: monthLabelStr }),
                                                category_id: item.category_id,
                                                type: 'debit',
                                                from: monthStart,
                                                to: monthEnd,
                                            }), children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(CategoryIcon, { icon: item.category_icon, color: item.category_color, size: "lg" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center justify-between gap-2 mb-1", children: [_jsx("span", { className: "text-sm font-semibold text-foreground truncate", children: item.category_name }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [_jsx("span", { className: "text-sm font-bold tabular-nums text-foreground", children: mask(formatCurrency(item.actual, userCurrency, locale)) }), item.momPct !== null && (_jsxs("span", { className: `inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${item.momPct > 0 ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' : item.momPct < 0 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`, children: [item.momPct > 0 ? '\u2191' : item.momPct < 0 ? '\u2193' : '=', Math.abs(item.momPct).toFixed(0), "%"] }))] })] }), hasBudget && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex-1 h-1.5 bg-muted/60 rounded-full overflow-hidden", children: _jsx("div", { className: `h-full rounded-full transition-all ${barColor}`, style: { width: `${Math.min(pct, 100)}%` } }) }), _jsx("span", { className: `text-[11px] tabular-nums font-medium shrink-0 ${pct > 100 ? 'text-rose-500' : pct >= 80 ? 'text-amber-500' : 'text-muted-foreground'}`, children: mask(t('dashboard.ofBudget', { budget: formatCurrency(item.budget_amount, userCurrency, locale) })) })] }))] })] }) }, item.category_id));
                                    }) })) : (_jsx("p", { className: "text-muted-foreground text-sm text-center py-12", children: t('dashboard.noData') })) })] }), _jsxs("div", { className: "bg-card rounded-xl border border-border shadow-sm max-h-[420px] flex flex-col", children: [_jsxs("div", { className: "px-5 pt-5 pb-3 shrink-0", children: [_jsxs("div", { className: "flex items-start justify-between mb-0.5", children: [_jsxs("div", { children: [_jsx("p", { className: "text-base font-bold text-foreground", children: t('dashboard.balanceFlow') }), _jsxs("p", { className: "text-xs text-muted-foreground mt-0.5", children: [new Date(`${selectedMonth}-01T00:00:00`).toLocaleDateString(dateLocale), " \u2192 ", new Date(`${selectedMonth}-${String(lastCurrentPoint?.day ?? monthLastDay(selectedMonth)).padStart(2, '0')}T00:00:00`).toLocaleDateString(dateLocale)] })] }), !balanceHistoryLoading && lastCurrentPoint && (_jsxs("div", { className: "text-right", children: [_jsx("p", { className: "text-[10px] font-medium text-muted-foreground uppercase tracking-wide", children: t('dashboard.balancePeriodVariation') }), _jsx("span", { className: `text-lg font-bold tabular-nums ${monthVariation >= 0 ? 'text-emerald-600' : 'text-rose-500'}`, children: mask(`${monthVariation > 0 ? '+' : ''}${formatCurrency(monthVariation, userCurrency, locale)}`) })] }))] }), _jsxs("div", { className: "flex items-center gap-3 mt-2", children: [_jsxs("span", { className: "flex items-center gap-1.5 text-[11px] text-muted-foreground", children: [_jsx("span", { className: "inline-block w-3 h-0.5 rounded-full bg-emerald-500" }), t('dashboard.balanceCurrentMonthLegend')] }), _jsxs("span", { className: "flex items-center gap-1.5 text-[11px] text-muted-foreground", children: [_jsx("span", { className: "inline-block w-3 border-t-2 border-dashed border-slate-400" }), t('dashboard.balancePreviousMonthLegend')] })] })] }), _jsx("div", { className: "px-1 pb-4 flex-1 min-h-0", children: balanceHistoryLoading ? (_jsx(Skeleton, { className: "h-full w-full" })) : cumulativeData.length > 0 ? (_jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(ComposedChart, { data: cumulativeData, margin: { top: 4, right: 8, left: 0, bottom: 0 }, className: "cursor-pointer", onMouseMove: (state) => {
                                            const idx = state?.activeTooltipIndex;
                                            if (typeof idx === 'number') {
                                                const point = cumulativeData[idx];
                                                if (point)
                                                    setHoveredDay(point.day);
                                            }
                                        }, onMouseLeave: () => setHoveredDay(null), onClick: (_state) => {
                                            // Access activePayload from the underlying native event target chart state
                                            const chartState = _state;
                                            const payload = chartState?.activePayload ?? [];
                                            if (payload[0]) {
                                                const day = String(payload[0].payload.day).padStart(2, '0');
                                                const dateStr = `${selectedMonth}-${day}`;
                                                setDrillDown({
                                                    title: t('dashboard.drillDownDay', { date: new Date(dateStr + 'T00:00:00').toLocaleDateString(dateLocale) }),
                                                    from: dateStr,
                                                    to: dateStr,
                                                });
                                            }
                                        }, children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "cumGrad", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "5%", stopColor: "#10B981", stopOpacity: 0.18 }), _jsx("stop", { offset: "95%", stopColor: "#10B981", stopOpacity: 0.02 })] }) }), _jsx(XAxis, { dataKey: "day", tick: { fontSize: 10, fill: 'var(--muted-foreground)' }, axisLine: false, tickLine: false, interval: 3 }), _jsx(YAxis, { tickFormatter: (v) => {
                                                    if (privacyMode)
                                                        return '';
                                                    if (v === 0)
                                                        return '0';
                                                    return formatCurrency(v, userCurrency, locale).replace(/,00$/, '').replace(/\.00$/, '');
                                                }, tick: { fontSize: 10, fill: 'var(--muted-foreground)' }, axisLine: false, tickLine: false, width: 56, tickCount: 5, domain: [
                                                    (dataMin) => dataMin < 0 ? Math.floor(dataMin / 100) * 100 : 0,
                                                    (dataMax) => Math.ceil(dataMax / 100) * 100,
                                                ] }), _jsx(RechartsTooltip, { formatter: (value, name) => [
                                                    value !== null ? (privacyMode ? MASK : formatCurrency(Number(value), userCurrency, locale)) : '\u2014',
                                                    name === 'current' ? monthLabel(selectedMonth, uiLocale).split(' ')[0] : monthLabel(prevMonth, uiLocale).split(' ')[0],
                                                ], labelFormatter: (day) => t('dashboard.day', { day }), contentStyle: {
                                                    background: 'var(--card)',
                                                    color: 'var(--foreground)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '0.75rem',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                                    fontSize: '12px',
                                                } }), _jsx(Area, { type: "monotone", dataKey: "current", stroke: "#10B981", strokeWidth: 2, fill: "url(#cumGrad)", dot: false, activeDot: { r: 3, fill: '#10B981' }, connectNulls: false }), _jsx(Line, { type: "monotone", dataKey: "previous", stroke: "#94A3B8", strokeWidth: 2, strokeDasharray: "5 3", dot: false, activeDot: { r: 3, fill: '#94A3B8' } })] }) })) : (_jsx("p", { className: "text-muted-foreground text-sm text-center py-12", children: t('dashboard.noData') })) }), !balanceHistoryLoading && lastCurrentPoint && (() => {
                                const footerDay = hoveredDay ?? lastDay;
                                const footerPrev = balanceHistory?.previous.find(d => d.day === footerDay)?.balance ?? 0;
                                const footerCurrent = cumulativeData.find(d => d.day === footerDay)?.current ?? totalBalance;
                                const footerPct = footerPrev !== 0 ? ((footerCurrent - footerPrev) / Math.abs(footerPrev)) * 100 : null;
                                if (footerPrev === 0 || footerPct === null)
                                    return null;
                                return (_jsx("div", { className: "px-5 pb-4 pt-0 shrink-0", children: _jsxs("p", { className: "text-xs text-muted-foreground", children: [t('dashboard.balanceFlowVsPrev', {
                                                month: monthLabel(prevMonth, uiLocale).split(' ')[0],
                                                day: footerDay,
                                                amount: mask(formatCurrency(footerPrev, userCurrency, locale)),
                                                delta: `${footerPct >= 0 ? '+' : ''}${footerPct.toFixed(1)}%`,
                                            }), ' ', _jsx("span", { className: footerPct >= 0 ? 'text-emerald-600' : 'text-rose-500', children: footerPct >= 0 ? '\u25B2' : '\u25BC' })] }) }));
                            })()] })] }), goalsSummary && goalsSummary.length > 0 && (_jsxs("div", { className: "bg-card rounded-xl border border-border shadow-sm mb-5", children: [_jsxs("div", { className: "px-5 py-4 border-b border-border flex items-center justify-between", children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: t('goals.dashboardTitle') }), _jsxs(Link, { to: "/goals", className: "text-xs font-medium text-primary hover:underline", children: [t('goals.viewAll'), " \u2192"] })] }), _jsx("div", { className: "divide-y divide-border", children: goalsSummary.map((goal) => {
                            const progressColor = goal.percentage >= 100
                                ? 'bg-emerald-500'
                                : goal.percentage >= 60
                                    ? 'bg-blue-500'
                                    : goal.percentage >= 30
                                        ? 'bg-amber-400'
                                        : 'bg-muted-foreground/30';
                            const onTrackConfig = {
                                ahead: { cls: 'text-emerald-600', key: 'goals.onTrackAhead' },
                                on_track: { cls: 'text-blue-600', key: 'goals.onTrackOnTrack' },
                                behind: { cls: 'text-amber-600', key: 'goals.onTrackBehind' },
                                overdue: { cls: 'text-rose-600', key: 'goals.onTrackOverdue' },
                                achieved: { cls: 'text-emerald-600', key: 'goals.onTrackAchieved' },
                            };
                            const otc = goal.on_track ? onTrackConfig[goal.on_track] : null;
                            const GoalIcon = (goal.icon && ICON_MAP[goal.icon]) || Target;
                            return (_jsxs("div", { className: "px-5 py-3 flex items-center gap-4", children: [_jsx("div", { className: "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white", style: { backgroundColor: goal.color ?? '#6B7280' }, children: _jsx(GoalIcon, { size: 14 }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center justify-between gap-2 mb-1", children: [_jsx("span", { className: "text-sm font-medium text-foreground truncate", children: goal.name }), _jsxs("span", { className: "text-xs font-bold tabular-nums text-foreground shrink-0", children: [mask(formatCurrency(goal.current_amount, goal.currency, locale)), " / ", mask(formatCurrency(goal.target_amount, goal.currency, locale))] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex-1 h-1.5 bg-muted/60 rounded-full overflow-hidden", children: _jsx("div", { className: `h-full rounded-full transition-all ${progressColor}`, style: { width: `${Math.min(goal.percentage, 100)}%` } }) }), _jsxs("span", { className: "text-[11px] font-bold tabular-nums text-muted-foreground shrink-0", children: [goal.percentage.toFixed(0), "%"] })] }), _jsxs("div", { className: "flex items-center gap-3 mt-1 text-[11px] text-muted-foreground", children: [goal.monthly_contribution != null && goal.monthly_contribution > 0 && (_jsxs("span", { className: "tabular-nums", children: [mask(formatCurrency(goal.monthly_contribution, goal.currency, locale)), t('goals.perMonth')] })), otc && (_jsx("span", { className: `font-medium ${otc.cls}`, children: t(otc.key) }))] })] })] }, goal.id));
                        }) })] })), _jsxs("div", { children: [_jsxs("div", { className: "mb-3 flex flex-wrap items-center justify-between gap-2", children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: t('dashboard.periodTransactions') }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(TransactionsViewSwitcher, { value: txViewMode, onChange: setTxViewMode, listLabel: t('transactions.listView'), calendarLabel: t('transactions.calendarView') }), txViewMode === 'list' && (_jsxs("button", { onClick: () => { setTxSortDesc(v => !v); setTxPage(1); }, className: "flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer", children: [_jsx(ArrowUpDown, { size: 13 }), txSortDesc ? t('dashboard.sortNewest') : t('dashboard.sortOldest')] }))] })] }), txViewMode === 'calendar' && (_jsx(TransactionCalendarView, { calendar: calendarData, isLoading: calendarLoading, locale: locale, dateLocale: dateLocale, mask: mask, selectedDate: calendarSelectedDate, onSelectedDateChange: setCalendarSelectedDate, onOpenTransaction: handleOpenCalendarTransaction, accounts: accountsList, userCurrency: userCurrency })), txViewMode === 'list' && (_jsx("div", { className: "bg-card rounded-xl border border-border shadow-sm overflow-hidden", children: txListLoading ? (_jsx("div", { className: "p-5 space-y-3", children: Array.from({ length: 5 }).map((_, i) => (_jsx(Skeleton, { className: "h-10 w-full" }, i))) })) : pagedRows.length > 0 ? (_jsxs(_Fragment, { children: [isMobile ? (_jsx("div", { children: pagedRows.map((row) => (_jsxs("div", { className: `flex items-center gap-3 pl-3 pr-3 py-3 border-b border-border last:border-0 bg-card ${row.isProjected ? '' : 'cursor-pointer active:bg-muted/60'}`, onClick: () => {
                                            if (row.isProjected)
                                                return;
                                            if (row.isShared) {
                                                if (row.groupId)
                                                    navigate(`/groups/${row.groupId}`);
                                                return;
                                            }
                                            const tx = currentMonthTxs?.items.find((t) => t.id === row.key);
                                            if (tx) {
                                                setEditingTx(tx);
                                                setDialogOpen(true);
                                            }
                                        }, children: [_jsx("div", { className: "shrink-0", children: _jsx(CategoryIcon, { icon: row.categoryIcon, color: row.categoryColor, size: "md" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("p", { className: "text-sm font-semibold text-foreground truncate leading-tight", children: row.description }), row.groupId && (_jsx("span", { className: "inline-flex items-center text-[9px] font-semibold uppercase tracking-wide text-violet-700 bg-violet-50 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900 px-1 py-0.5 rounded-full shrink-0", children: row.isShared && row.parentOwnerName
                                                                    ? t('splitGroups.sharedShortBadgeAuthor', { author: row.parentOwnerName })
                                                                    : row.groupName ?? t('splitGroups.sharedShortBadge') })), row.isProjected && (_jsx(ProjectedTransactionBadge, {})), row.installmentNumber != null && row.totalInstallments != null && (_jsxs("span", { className: "inline-flex items-center text-[9px] font-bold tabular-nums text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 px-1 py-0.5 rounded-full shrink-0", children: [row.installmentNumber, "/", row.totalInstallments] })), row.showPendingBadge && (_jsx("span", { title: t('transactions.pending'), className: "shrink-0 inline-flex items-center justify-center rounded-full border border-amber-200 bg-amber-50 p-0.5 dark:border-amber-500/30 dark:bg-amber-500/10", children: _jsx(Clock, { size: 12, className: "text-amber-500", role: "img", "aria-label": t('transactions.pending') }) })), row.isIgnored && (_jsx(EyeClosed, { className: "h-3 w-3 text-gray-500 shrink-0" })), row.attachmentCount > 0 && (_jsx(Paperclip, { size: 11, className: "text-muted-foreground shrink-0" }))] }), row.accountId && (() => {
                                                        const acc = accountsList?.find((a) => a.id === row.accountId);
                                                        if (!acc)
                                                            return null;
                                                        return (_jsxs("div", { className: "flex items-center gap-1.5 mt-0.5", children: [_jsx(AccountIcon, { account: acc, size: "xs" }), _jsx("span", { className: "text-xs text-muted-foreground truncate", children: getAccountName(acc) })] }));
                                                    })(), !row.accountId && (_jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: formatDate(row.date, dateLocale) }))] }), _jsxs("div", { className: "shrink-0 text-right", children: [_jsx("span", { className: `text-sm font-bold tabular-nums ${row.isIgnored ? 'text-gray-500' : row.type === 'credit' ? 'text-emerald-600' : 'text-rose-500'}`, children: mask(`${row.isIgnored ? ' ' : row.type === 'credit' ? '+' : '\u2212'}${formatCurrency(Math.abs(row.amount), row.currency, locale)}`) }), row.isShared && row.parentTotal != null && (_jsx("div", { className: "text-[10px] text-muted-foreground tabular-nums mt-0.5", children: t('splitGroups.sharedRowParent', {
                                                            total: formatCurrency(Math.abs(row.parentTotal), row.currency, locale),
                                                        }) })), !row.isShared && row.ownerShare != null && (_jsx("div", { className: "text-[10px] text-muted-foreground tabular-nums mt-0.5", children: t('splitGroups.ownerRowYourShare', {
                                                            share: formatCurrency(Math.abs(row.ownerShare), row.currency, locale),
                                                        }) })), !row.isShared && row.currency !== userCurrency && row.amountPrimary != null && (_jsx("div", { className: "text-[10px] text-muted-foreground tabular-nums mt-0.5", children: mask(formatCurrency(Math.abs(row.amountPrimary), userCurrency, locale)) }))] })] }, row.key))) })) : (_jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { className: "border-b border-border hover:bg-transparent", children: [_jsx(TableHead, { className: "pl-5 text-xs font-medium text-muted-foreground hidden sm:table-cell", children: t('transactions.date') }), _jsx(TableHead, { className: "text-xs font-medium text-muted-foreground", children: t('transactions.description') }), _jsx(TableHead, { className: "text-xs font-medium text-muted-foreground hidden sm:table-cell", children: t('transactions.account') }), _jsx(TableHead, { className: "pr-5 text-right text-xs font-medium text-muted-foreground", children: t('transactions.amount') })] }) }), _jsx(TableBody, { children: pagedRows.map((row) => (_jsxs(TableRow, { className: `border-b border-border last:border-0 ${row.isProjected
                                                    ? ''
                                                    : row.isShared
                                                        ? 'cursor-pointer hover:bg-muted'
                                                        : 'cursor-pointer hover:bg-muted'}`, onClick: () => {
                                                    if (row.isProjected)
                                                        return;
                                                    if (row.isShared) {
                                                        // Shared rows belong to another user — open the
                                                        // group instead of the (locked) edit dialog.
                                                        if (row.groupId)
                                                            navigate(`/groups/${row.groupId}`);
                                                        return;
                                                    }
                                                    const tx = currentMonthTxs?.items.find((t) => t.id === row.key);
                                                    if (tx) {
                                                        setEditingTx(tx);
                                                        setDialogOpen(true);
                                                    }
                                                }, children: [_jsx(TableCell, { className: "py-2.5 pl-5 text-sm text-muted-foreground tabular-nums whitespace-nowrap hidden sm:table-cell", children: formatDate(row.date, dateLocale) }), _jsx(TableCell, { className: "py-2.5 pl-5 sm:pl-0", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(CategoryIcon, { icon: row.categoryIcon, color: row.categoryColor, size: "lg" }), _jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("p", { className: "text-sm font-semibold text-foreground truncate", children: row.description }), row.groupId && (_jsx("span", { className: "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 shrink-0 uppercase tracking-wide", children: row.isShared && row.parentOwnerName
                                                                                        ? t('splitGroups.sharedShortBadgeAuthor', { author: row.parentOwnerName })
                                                                                        : row.groupName ?? t('splitGroups.sharedShortBadge') })), row.isProjected && (_jsx(ProjectedTransactionBadge, {})), row.installmentNumber != null && row.totalInstallments != null && (_jsxs("span", { className: "inline-flex items-center text-[10px] font-bold tabular-nums text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 px-1.5 py-0.5 rounded-full shrink-0", children: [row.installmentNumber, "/", row.totalInstallments] })), row.showPendingBadge && (_jsx("span", { title: t('transactions.pending'), className: "shrink-0 inline-flex items-center justify-center rounded-full border border-amber-200 bg-amber-50 p-0.5 dark:border-amber-500/30 dark:bg-amber-500/10", children: _jsx(Clock, { size: 12, className: "text-amber-500", role: "img", "aria-label": t('transactions.pending') }) })), row.isIgnored && (_jsxs("span", { className: "ml-2 inline-flex items-center gap-1 text-xs text-gray-600 font-normal bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5", children: [_jsx(EyeClosed, { className: "h-3 w-3" }), t('transactions.ignored'), _jsx("span", { title: t('transactions.ignoreTransferHint'), children: _jsx(HelpCircle, { className: "h-3 w-3 text-blue-400" }) })] })), row.attachmentCount > 0 && (_jsx(Paperclip, { size: 12, className: "text-muted-foreground shrink-0" }))] }), _jsx("p", { className: "text-xs text-muted-foreground sm:hidden", children: formatDate(row.date, dateLocale) })] })] }) }), _jsx(TableCell, { className: "py-2.5 text-sm text-muted-foreground hidden sm:table-cell", children: (() => {
                                                            const acc = row.accountId
                                                                ? accountsList?.find((a) => a.id === row.accountId)
                                                                : undefined;
                                                            if (!acc)
                                                                return _jsx("span", { className: "text-muted-foreground", children: "\u2014" });
                                                            return (_jsxs("span", { className: "flex items-center gap-2 min-w-0", children: [_jsx(AccountIcon, { account: acc, size: "sm" }), _jsx("span", { className: "truncate", children: getAccountName(acc) })] }));
                                                        })() }), _jsxs(TableCell, { className: "py-2.5 pr-5 text-right", children: [_jsx("span", { className: `text-sm font-semibold tabular-nums ${row.isIgnored ? 'text-gray-500' : row.type === 'credit' ? 'text-emerald-600' : 'text-rose-500'}`, children: mask(`${row.isIgnored ? ' ' : row.type === 'credit' ? '+' : '-'}${formatCurrency(Math.abs(row.amount), row.currency, locale)}`) }), row.isShared && row.parentTotal != null && (_jsx("span", { className: "block text-[10px] text-muted-foreground tabular-nums", children: t('splitGroups.sharedRowParent', {
                                                                    total: formatCurrency(Math.abs(row.parentTotal), row.currency, locale),
                                                                }) })), !row.isShared && row.ownerShare != null && (_jsx("span", { className: "block text-[10px] text-muted-foreground tabular-nums", children: t('splitGroups.ownerRowYourShare', {
                                                                    share: formatCurrency(Math.abs(row.ownerShare), row.currency, locale),
                                                                }) })), !row.isShared && row.currency !== userCurrency && row.amountPrimary != null && (_jsx("span", { className: "block text-[10px] text-muted-foreground tabular-nums", children: mask(formatCurrency(Math.abs(row.amountPrimary), userCurrency, locale)) }))] })] }, row.key))) })] })), allDisplayRows.length > 10 && (_jsxs("div", { className: "flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 border-t border-border", children: [_jsx("div", { className: "hidden sm:block w-32" }), txTotalPages > 1 ? (_jsxs("div", { className: "flex items-center justify-center gap-2", children: [_jsx(Button, { variant: "outline", size: "sm", disabled: txPage <= 1, onClick: () => setTxPage(txPage - 1), children: t('dashboard.previous') }), _jsxs("span", { className: "text-sm text-muted-foreground", children: [txPage, " / ", txTotalPages] }), _jsx(Button, { variant: "outline", size: "sm", disabled: txPage >= txTotalPages, onClick: () => setTxPage(txPage + 1), children: t('dashboard.next') })] })) : (_jsx("div", { className: "hidden sm:block" })), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-xs text-muted-foreground", children: t('common.rowsPerPage', 'Rows per page') }), _jsxs(Select, { value: String(txPerPage), onValueChange: (val) => {
                                                        const nextLimit = Number(val);
                                                        setTxPerPage(nextLimit);
                                                        setTxPage(1);
                                                        try {
                                                            localStorage.setItem('securo.dashboard.pageSize', String(nextLimit));
                                                        }
                                                        catch {
                                                            // ignored
                                                        }
                                                    }, children: [_jsx(SelectTrigger, { className: "w-[70px] h-8 text-xs", children: _jsx(SelectValue, { placeholder: txPerPage }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "10", children: "10" }), _jsx(SelectItem, { value: "20", children: "20" }), _jsx(SelectItem, { value: "50", children: "50" }), _jsx(SelectItem, { value: "100", children: "100" })] })] })] })] }))] })) : (_jsx("p", { className: "text-muted-foreground text-sm text-center py-8", children: t('dashboard.noTransactions') })) }))] }), _jsx(TransactionDrillDown, { filter: drillDown
                    ? {
                        ...drillDown,
                        // Keep drill-downs consistent with the collection-scoped cards
                        // they open from (e.g. "Categorize now").
                        account_ids: drillDown.account_ids ?? (acctIds && acctIds.length > 0 ? acctIds : undefined),
                    }
                    : null, onClose: () => setDrillDown(null), onTransactionClick: (tx) => { setEditingTx(tx); setDialogOpen(true); } }), _jsx(TransactionDialog, { open: dialogOpen, onClose: () => { setDialogOpen(false); setEditingTx(null); }, transaction: editingTx, categories: categoriesList ?? [], categoryGroups: categoryGroupsList ?? [], accounts: (accountsList ?? []).map((a) => ({ id: a.id, name: getAccountName(a) })), onSave: (data) => {
                    if (editingTx)
                        updateMutation.mutate({ id: editingTx.id, ...data });
                }, onDelete: () => {
                    if (editingTx)
                        deleteMutation.mutate(editingTx.id);
                }, onUnlinkTransfer: (pairId) => unlinkTransferMutation.mutate(pairId), onCreateRule: (tx) => {
                    setDialogOpen(false);
                    setEditingTx(null);
                    handleCreateRuleFromTransaction(tx);
                }, loading: updateMutation.isPending || deleteMutation.isPending || unlinkTransferMutation.isPending, error: updateMutation.error ? extractApiError(updateMutation.error) : deleteMutation.error ? extractApiError(deleteMutation.error) : null, isSynced: editingTx?.source === 'sync' }), _jsx(RuleDialog, { open: createRuleOpen, onClose: () => { setCreateRuleOpen(false); setCreateRuleInitialData(undefined); }, rule: null, categories: categoriesList ?? [], categoryGroups: categoryGroupsList ?? [], accounts: (accountsList ?? []).map((a) => ({ id: a.id, name: getAccountName(a) })), payees: payeesList ?? [], onSave: (data) => createRuleMutation.mutate(data), loading: createRuleMutation.isPending, initialData: createRuleInitialData }, createRuleOpen ? 'rule-open' : 'rule-closed')] }));
}
