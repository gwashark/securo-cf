import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useMemo, useEffect, useRef } from 'react';
import { useRegisterPageChatContext } from '../lib/page-chat-context.js';
import { getAccountName } from '../lib/account-utils.js';
import { AccountIcon } from '../components/account-icon.js';
import { currentMonth, monthRange, monthFromRange } from '../lib/month-utils.js';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDisplayLocale, useDateLocale } from '../hooks/use-display-locale.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactions, categories as categoriesApi, categoryGroups as categoryGroupsApi, accounts as accountsApi, recurring, payees as payeesApi, admin, groups as groupsApi, rules as rulesApi, reconciliation as reconciliationApi } from '../lib/api.js';
import { invalidateFinancialQueries } from '../lib/invalidate-queries.js';
import { toast } from 'sonner';
import { Button } from '../components/ui/button.js';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '../components/ui/dialog.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '../components/ui/select.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '../components/ui/table.js';
import { Skeleton } from '../components/ui/skeleton.js';
import { AlertTriangle, ArrowLeftRight, ArrowUp, ArrowDown, Check, Clock, HelpCircle, Info, Paperclip, Trash2, Users, X, EyeClosed, ChartNoAxesColumn, SlidersHorizontal, Receipt } from 'lucide-react';
import { RuleDialog } from '../components/rule-dialog.js';
import { PageHeader } from '../components/page-header.js';
import { calculateRangeSelection } from '../lib/selection-utils.js';
import { isManualInstallmentSeriesRow } from '../lib/installment-series.js';
import { CategoryIcon } from '../components/category-icon.js';
import { CategorySelect } from '../components/category-select.js';
import { TransactionDialog } from '../components/transaction-dialog.js';
import { extractApiError } from '../lib/api-errors.js';
import { TransactionsColumnPicker } from '../components/transactions-column-picker.js';
import { TransactionsPageActions } from '../components/transactions-page-actions.js';
import { MobileBulkSelectionActions } from '../components/mobile-bulk-selection-actions.js';
import { useTransactionsGridState } from '../components/transactions-grid-columns.js';
import { TransferDialog } from '../components/transfer-dialog.js';
import { LinkTransferDialog } from '../components/link-transfer-dialog.js';
import { BulkAddToGroupDialog } from '../components/bulk-add-to-group-dialog.js';
import { TransactionsFilterBar } from '../components/transactions-filter-bar.js';
import { TransactionCalendarView } from '../components/transaction-calendar-view.js';
import { usePrivacyMode } from '../hooks/use-privacy-mode.js';
import { useIsMobile } from '../hooks/use-mobile.js';
import { useCreateTransaction } from '../hooks/use-create-transaction.js';
import { MobileTransactionRow } from '../components/mobile-transaction-row.js';
import { useAuth } from '../contexts/auth-context.js';
import { useWorkspace } from '../contexts/workspace-context.js';
import { useCollectionFilter } from '../contexts/collection-filter-context.js';
import { formatCurrency } from '../lib/format.js';
import { shouldShowPendingBadge } from '../lib/transaction-status.js';
function parseHashtags(notes) {
    if (!notes)
        return [];
    const matches = notes.match(/#[\w\u00C0-\u017E-]+/g);
    return matches ?? [];
}
const HIDE_IGNORED_STORAGE_KEY = 'securo.transactions.hideIgnored';
export default function TransactionsPage() {
    const { t, i18n } = useTranslation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const { mask } = usePrivacyMode();
    const isMobile = useIsMobile();
    const { user } = useAuth();
    const { activeAccountIds } = useCollectionFilter();
    const { canWrite, hasModule } = useWorkspace();
    const userCurrency = user?.preferences?.currency_display ?? 'USD';
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(() => {
        try {
            const stored = localStorage.getItem('securo.transactions.pageSize');
            return stored ? Number(stored) : 20;
        }
        catch {
            return 20;
        }
    });
    const [filterAccountIds, setFilterAccountIds] = useState(() => {
        const initial = searchParams.get('account_id');
        return initial ? initial.split(',') : [];
    });
    const [filterCategoryIds, setFilterCategoryIds] = useState(() => {
        const initial = searchParams.get('category_id');
        return initial ? [initial] : [];
    });
    const [filterUncategorized, setFilterUncategorized] = useState(false);
    // Seed the date range from the URL, or default to the current month on first
    // open (no ?from/?to). Done in the initializer so it survives effect re-runs
    // (e.g. React StrictMode's double-invoke in development).
    const [filterFrom, setFilterFrom] = useState(() => {
        const f = searchParams.get('from');
        const t = searchParams.get('to');
        return f || t ? (f ?? '') : monthRange(currentMonth()).from;
    });
    const [filterTo, setFilterTo] = useState(() => {
        const f = searchParams.get('from');
        const t = searchParams.get('to');
        return f || t ? (t ?? '') : monthRange(currentMonth()).to;
    });
    // Month reflected by the stepper: the active range when it spans exactly one
    // full month, otherwise the current month (custom ranges still navigable).
    const steppedMonth = monthFromRange(filterFrom, filterTo) ?? currentMonth();
    const handleMonthChange = (ym) => {
        const { from, to } = monthRange(ym);
        setFilterFrom(from);
        setFilterTo(to);
        setPage(1);
    };
    const [searchInput, setSearchInput] = useState(() => searchParams.get('q') ?? '');
    const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingTx, setEditingTx] = useState(null);
    const [pendingTransferCategoryUpdate, setPendingTransferCategoryUpdate] = useState(null);
    // Manual installment-series scoped delete. Scoped edits are handled by the
    // shared TransactionDialog so account detail and dashboard behave the same.
    const [pendingSeriesDeleteId, setPendingSeriesDeleteId] = useState(null);
    const [viewMode, setViewMode] = useState(() => (searchParams.get('view') === 'calendar' ? 'calendar' : 'list'));
    const [calendarSelectedDate, setCalendarSelectedDate] = useState(() => searchParams.get('day') ?? '');
    const [filterPayee, setFilterPayee] = useState(searchParams.get('payee_id') ?? '');
    const [filterGroupId, setFilterGroupId] = useState(searchParams.get('group_id') ?? '');
    const [filterType, setFilterType] = useState(searchParams.get('type') ?? '');
    const [filterStatus, setFilterStatus] = useState(searchParams.get('status') ?? '');
    // Hiding ignored rows is a reading preference, not a query someone re-picks
    // every visit, so it outlives the page the way page size and columns do. The
    // URL still wins when present, so a shared link shows what its sender saw.
    const [hideIgnored, setHideIgnored] = useState(() => {
        const fromUrl = searchParams.get('hide_ignored');
        if (fromUrl !== null)
            return fromUrl === 'true';
        try {
            return localStorage.getItem(HIDE_IGNORED_STORAGE_KEY) === 'true';
        }
        catch {
            return false;
        }
    });
    const [filterMinAmount, setFilterMinAmount] = useState(searchParams.get('min_amount') ?? '');
    const [filterMaxAmount, setFilterMaxAmount] = useState(searchParams.get('max_amount') ?? '');
    const [tagFilters, setTagFilters] = useState([]);
    // When the page is opened with a `group_id`, fetch its name so the
    // active-filter chip is recognizable rather than a raw uuid.
    const { data: filterGroup } = useQuery({
        queryKey: ['groups', filterGroupId],
        queryFn: () => groupsApi.get(filterGroupId),
        enabled: !!filterGroupId,
    });
    // Used to resolve the group name on shared transaction rows.
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
    const addTagFilter = (tag) => {
        const normalized = tag.startsWith('#') ? tag : `#${tag}`;
        setTagFilters(prev => (prev.includes(normalized) ? prev : [...prev, normalized]));
        setPage(1);
    };
    const removeTagFilter = (tag) => {
        setTagFilters(prev => prev.filter(t => t !== tag));
        setPage(1);
    };
    const clearTagFilters = () => {
        setTagFilters([]);
        setPage(1);
    };
    const [exporting, setExporting] = useState(false);
    const [transferDialogOpen, setTransferDialogOpen] = useState(false);
    const [linkTransferDialogOpen, setLinkTransferDialogOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [lastSelectedId, setLastSelectedId] = useState(null);
    const grid = useTransactionsGridState();
    const [bulkCategory, setBulkCategory] = useState('');
    const [bulkAddToGroupOpen, setBulkAddToGroupOpen] = useState(false);
    const [bulkTagInput, setBulkTagInput] = useState('');
    const [createRuleOpen, setCreateRuleOpen] = useState(false);
    const [createRuleInitialData, setCreateRuleInitialData] = useState(undefined);
    const debounceRef = useRef(null);
    const highlightId = searchParams.get('highlight');
    const highlightedRowRef = useRef(null);
    // Last URL query we synced from, to tell a genuine navigation apart from the
    // initial mount (and from StrictMode's double-invoke, which repeats the same
    // value). Starts null so the first run is recognized as the initial mount.
    const prevSearchRef = useRef(null);
    // Sync state from URL when navigating (e.g. from the command palette) while
    // the page is already mounted. Typing in the search box does not touch the
    // URL, so this effect only fires on genuine navigation events.
    useEffect(() => {
        const search = searchParams.toString();
        // Skip re-runs with an unchanged query (e.g. StrictMode's second mount),
        // so they can't override the initial current-month default.
        if (prevSearchRef.current === search)
            return;
        const isInitial = prevSearchRef.current === null;
        prevSearchRef.current = search;
        const nextQ = searchParams.get('q') ?? '';
        setViewMode(searchParams.get('view') === 'calendar' ? 'calendar' : 'list');
        setCalendarSelectedDate(searchParams.get('day') ?? '');
        setSearchInput(nextQ);
        setSearchQuery(nextQ);
        const tags = searchParams.get('tags');
        setTagFilters(tags ? tags.split(',') : []);
        setFilterPayee(searchParams.get('payee_id') ?? '');
        setFilterGroupId(searchParams.get('group_id') ?? '');
        setFilterType(searchParams.get('type') ?? '');
        setFilterStatus(searchParams.get('status') ?? '');
        const urlHideIgnored = searchParams.get('hide_ignored');
        if (urlHideIgnored !== null)
            setHideIgnored(urlHideIgnored === 'true');
        const categories = searchParams.get('category_id');
        setFilterCategoryIds(categories ? categories.split(',') : []);
        setFilterUncategorized(searchParams.get('uncategorized') === '1');
        const accounts = searchParams.get('account_id');
        setFilterAccountIds(accounts ? accounts.split(',') : []);
        const urlFrom = searchParams.get('from');
        const urlTo = searchParams.get('to');
        if (urlFrom || urlTo) {
            // Explicit range in the URL (shared/bookmarked link) wins.
            setFilterFrom(urlFrom ?? '');
            setFilterTo(urlTo ?? '');
        }
        else if (!isInitial) {
            // A genuine navigation cleared the range (e.g. Clear filters): show all.
            // On the initial mount we keep the current-month default seeded above.
            setFilterFrom('');
            setFilterTo('');
        }
        setFilterMinAmount(searchParams.get('min_amount') ?? '');
        setFilterMaxAmount(searchParams.get('max_amount') ?? '');
        setPage(1);
    }, [searchParams]);
    // Keep the URL in sync with the current filters, so that the current page can be
    // refreshed, bookmarked or shared.
    useEffect(() => {
        const params = new URLSearchParams([
            ['q', searchQuery],
            ['view', viewMode === 'calendar' ? 'calendar' : ''],
            ['day', viewMode === 'calendar' ? calendarSelectedDate : ''],
            ['tags', tagFilters.join(',')],
            ['payee_id', filterPayee],
            ['group_id', filterGroupId],
            ['type', filterType],
            ['status', filterStatus],
            ['category_id', filterCategoryIds.join(',')],
            ['uncategorized', filterUncategorized ? '1' : ''],
            ['account_id', filterAccountIds.join(',')],
            ['from', filterFrom],
            ['to', filterTo],
            ['min_amount', filterMinAmount],
            ['max_amount', filterMaxAmount],
            ['hide_ignored', hideIgnored ? 'true' : ''],
        ].filter(([, v]) => v.length));
        window.history.replaceState(null, '', params.size ? `?${params}` : window.location.pathname);
    }, [
        searchQuery,
        viewMode,
        calendarSelectedDate,
        tagFilters,
        filterPayee,
        filterGroupId,
        filterType,
        filterStatus,
        filterCategoryIds,
        filterUncategorized,
        filterAccountIds,
        filterFrom,
        filterTo,
        filterMinAmount,
        filterMaxAmount,
        hideIgnored,
    ]);
    useEffect(() => {
        if (debounceRef.current)
            clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setSearchQuery(searchInput);
            setPage(1);
        }, 300);
        return () => { if (debounceRef.current)
            clearTimeout(debounceRef.current); };
    }, [searchInput]);
    // Clear selection on page/filter change
    useEffect(() => {
        setSelectedIds(new Set());
        setLastSelectedId(null);
        setBulkCategory('');
    }, [page, filterAccountIds, filterCategoryIds, filterUncategorized, filterPayee, filterType, filterStatus, filterFrom, filterTo, filterMinAmount, filterMaxAmount, searchQuery]);
    useEffect(() => {
        if (viewMode === 'calendar') {
            setFilterAccountIds((prev) => prev.length > 1 ? [] : prev);
            setSelectedIds(new Set());
            setLastSelectedId(null);
            setBulkCategory('');
        }
    }, [viewMode, filterAccountIds.length]);
    // Reset bulk category when selection changes so the same category can be re-applied
    useEffect(() => {
        setBulkCategory('');
    }, [selectedIds]);
    // Scroll to and flash a highlighted row after navigation (e.g. opened via
    // the command palette). Re-runs whenever highlightId or the current data
    // set changes so that when results finish loading we animate the row.
    useEffect(() => {
        if (!highlightId)
            return;
        const el = highlightedRowRef.current;
        if (!el)
            return;
        const raf = requestAnimationFrame(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('securo-highlight-flash');
        });
        const timer = setTimeout(() => {
            el.classList.remove('securo-highlight-flash');
        }, 2500);
        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(timer);
            el.classList.remove('securo-highlight-flash');
        };
    }, [highlightId, searchQuery, filterPayee, filterCategoryIds, page]);
    // Merge the global active-collection filter with the page's own account
    // filter (issue #105): an explicit on-page account selection wins; otherwise
    // scope to the active collection's accounts. null collection = all accounts.
    const effectiveAccountIds = filterAccountIds.length > 0
        ? filterAccountIds
        : (activeAccountIds ?? []);
    // Wallet-only collection active (zero accounts) and no explicit on-page
    // account filter → there are no matching transactions; show empty rather
    // than falling back to all accounts.
    const noAccounts = filterAccountIds.length === 0
        && activeAccountIds !== null && activeAccountIds.length === 0;
    const { data, isLoading } = useQuery({
        queryKey: ['transactions', page, limit, effectiveAccountIds, filterCategoryIds, filterUncategorized, filterPayee, filterGroupId, filterType, filterStatus, filterFrom, filterTo, filterMinAmount, filterMaxAmount, hideIgnored, searchQuery, tagFilters, isMobile ? 'date' : grid.sortBy, isMobile ? 'desc' : grid.sortDir],
        enabled: !noAccounts,
        queryFn: () => transactions.list({
            page,
            limit,
            account_ids: effectiveAccountIds.length > 0 ? effectiveAccountIds : undefined,
            category_ids: filterCategoryIds.length > 0 ? filterCategoryIds : undefined,
            payee_id: filterPayee || undefined,
            group_id: filterGroupId || undefined,
            type: filterType || undefined,
            status: filterStatus || undefined,
            uncategorized: filterUncategorized ? true : undefined,
            from: filterFrom || undefined,
            to: filterTo || undefined,
            min_amount: filterMinAmount ? Number(filterMinAmount) : undefined,
            max_amount: filterMaxAmount ? Number(filterMaxAmount) : undefined,
            q: searchQuery || undefined,
            tags: tagFilters.length > 0 ? tagFilters : undefined,
            exclude_ignored: hideIgnored ? true : undefined,
            // Mobile has no column headers to change sort; force date-desc so
            // the date grouping always works correctly.
            ...(isMobile ? { sort_by: 'date', sort_dir: 'desc' } : grid.apiSort),
        }),
    });
    const calendarMonth = steppedMonth;
    const calendarAccountIds = filterAccountIds.length === 1 ? filterAccountIds : [];
    const { data: calendarData, isLoading: calendarLoading } = useQuery({
        queryKey: ['transactions', 'calendar', calendarMonth, calendarAccountIds],
        enabled: viewMode === 'calendar',
        queryFn: () => transactions.calendar({
            month: `${calendarMonth}-01`,
            account_ids: calendarAccountIds.length === 1 ? calendarAccountIds : undefined,
        }),
    });
    // Publish the active filters + result count to the global chat panel.
    // The agent uses this so "what about THIS list?" / "soma essas" /
    // "categorize these" resolve against the filtered view, not the user's
    // entire history. Free-form blob — backend turns it into a primer.
    const ctxFilters = {
        search: searchQuery || undefined,
        account_ids: effectiveAccountIds.length ? effectiveAccountIds : undefined,
        category_ids: filterCategoryIds.length ? filterCategoryIds : undefined,
        payee_id: filterPayee || undefined,
        group_id: filterGroupId || undefined,
        type: filterType || undefined,
        status: filterStatus || undefined,
        uncategorized: filterUncategorized || undefined,
        from: filterFrom || undefined,
        to: filterTo || undefined,
        min_amount: filterMinAmount || undefined,
        max_amount: filterMaxAmount || undefined,
        tags: tagFilters.length ? tagFilters : undefined,
        sort_by: grid.sortBy,
        sort_dir: grid.sortDir,
        page,
        limit,
    };
    const ctxKey = JSON.stringify(ctxFilters) + ':' + (data?.total ?? '');
    useRegisterPageChatContext({
        path: '/transactions',
        label: 'Transactions',
        summary: data?.total != null
            ? `${data.total} transaction(s) match the active filters (showing page ${page}, ${limit} per page).`
            : 'Transactions list with active filters.',
        filters: ctxFilters,
    }, ctxKey);
    const { data: categoriesList } = useQuery({
        queryKey: ['categories'],
        queryFn: categoriesApi.list,
    });
    // A category filter survives in the URL, so it can outlive the category
    // being hidden. Kept apart from the list that feeds the picker.
    const { data: allCategoriesList } = useQuery({
        queryKey: ['categories', 'management'],
        queryFn: categoriesApi.listIncludingHidden,
        enabled: filterCategoryIds.length > 0,
    });
    const { data: categoryGroupsList } = useQuery({
        queryKey: ['categoryGroups'],
        queryFn: categoryGroupsApi.list,
    });
    const { data: accountsList } = useQuery({
        queryKey: ['accounts'],
        queryFn: () => accountsApi.list(),
    });
    const { data: payeesList } = useQuery({
        queryKey: ['payees'],
        queryFn: payeesApi.list,
    });
    const { data: recurringList } = useQuery({
        queryKey: ['recurring'],
        queryFn: recurring.list,
    });
    const recurringById = useMemo(() => new Map((recurringList ?? []).map(item => [item.id, item])), [recurringList]);
    // Every open question, indexed by the money it is about. One request
    // for the page rather than one per row: the queue is small by design,
    // and if it ever is not, that is the rules wanting changing rather than
    // this needing pagination.
    //
    // Skipped entirely where neither set is on, so a workspace pays nothing
    // for a surface it cannot reach. Either one is enough: the recurring
    // matcher records its questions against a transaction exactly as the
    // invoice one does, and a personal workspace has only that one.
    const { data: openQuestions } = useQuery({
        queryKey: ['reconciliation-suggestions'],
        queryFn: reconciliationApi.suggestions,
        enabled: hasModule('invoices') || hasModule('recurring'),
    });
    const suggestionsByTransaction = useMemo(() => new Map((openQuestions ?? [])
        .filter((s) => s.transaction?.id)
        .map((s) => [s.transaction.id, s])), [openQuestions]);
    const { data: accountingModeData } = useQuery({
        queryKey: ['admin', 'accounting-mode'],
        queryFn: () => admin.accountingMode(),
        staleTime: 5 * 60 * 1000,
    });
    const isAccrual = accountingModeData?.mode === 'accrual';
    const invalidateAfterTxMutation = () => invalidateFinancialQueries(queryClient);
    const { mutation: createMutation, create: createTransaction, duplicateDraft, setDuplicateDraft, formResetKey, resetForm, } = useCreateTransaction({ onDone: () => setDialogOpen(false) });
    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }) => transactions.update(id, data),
        onSuccess: () => {
            invalidateAfterTxMutation();
            setDialogOpen(false);
            setEditingTx(null);
            toast.success(t('transactions.updated'));
        },
        onError: (error) => {
            toast.error(extractApiError(error));
        },
    });
    const deleteMutation = useMutation({
        mutationFn: (payload) => transactions.delete(payload.id, payload.applyTo ?? 'this'),
        onSuccess: () => {
            invalidateAfterTxMutation();
            setDialogOpen(false);
            setEditingTx(null);
            toast.success(t('transactions.deleted'));
        },
        onError: (error) => {
            toast.error(extractApiError(error));
        },
    });
    const bulkCategorizeMutation = useMutation({
        mutationFn: ({ ids, categoryId }) => transactions.bulkCategorize(ids, categoryId),
        onSuccess: (result) => {
            invalidateAfterTxMutation();
            setSelectedIds(new Set());
            setBulkCategory('');
            toast.success(t('transactions.bulkSuccess', { count: result.updated }));
        },
        onError: (error) => {
            toast.error(extractApiError(error));
        },
    });
    const bulkAddTagsMutation = useMutation({
        mutationFn: ({ ids, tags }) => transactions.bulkAddTags(ids, tags),
        onSuccess: (result) => {
            invalidateAfterTxMutation();
            setSelectedIds(new Set());
            setBulkTagInput('');
            toast.success(t('transactions.bulkSuccess', { count: result.updated }));
        },
        onError: (error) => {
            toast.error(extractApiError(error));
        },
    });
    const bulkRemoveTagsMutation = useMutation({
        mutationFn: ({ ids, tags }) => transactions.bulkRemoveTags(ids, tags),
        onSuccess: (result) => {
            invalidateAfterTxMutation();
            setSelectedIds(new Set());
            setBulkTagInput('');
            toast.success(t('transactions.bulkSuccess', { count: result.updated }));
        },
        onError: (error) => {
            toast.error(extractApiError(error));
        },
    });
    const bulkAddToGroupMutation = useMutation({
        mutationFn: ({ ids, payload }) => transactions.bulkAddToGroup(ids, payload.groupId, {
            share_type: payload.share_type,
            member_splits: payload.member_splits,
        }),
        onSuccess: (result) => {
            invalidateAfterTxMutation();
            setSelectedIds(new Set());
            setBulkAddToGroupOpen(false);
            if (result.skipped > 0) {
                toast.success(t('transactions.bulkAddToGroupPartial', { added: result.updated, skipped: result.skipped }));
            }
            else {
                toast.success(t('transactions.bulkAddToGroupSuccess', { count: result.updated }));
            }
        },
        onError: (error) => {
            toast.error(extractApiError(error));
        },
    });
    const linkTransferMutation = useMutation({
        mutationFn: (ids) => transactions.linkTransfer(ids),
        onSuccess: () => {
            invalidateAfterTxMutation();
            queryClient.invalidateQueries({ queryKey: ['transfer-candidates'] });
            setLinkTransferDialogOpen(false);
            setSelectedIds(new Set());
            toast.success(t('transactions.linkTransferSuccess'));
        },
        onError: (error) => {
            toast.error(extractApiError(error));
        },
    });
    const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
    const bulkDeleteMutation = useMutation({
        mutationFn: () => transactions.bulkDelete(Array.from(selectedIds)),
        onSuccess: (result) => {
            invalidateAfterTxMutation();
            setSelectedIds(new Set());
            setBulkDeleteConfirmOpen(false);
            toast.success(t('transactions.bulkDeleteSuccess', { count: result.deleted }));
        },
        onError: (error) => {
            toast.error(extractApiError(error));
        },
    });
    const createCounterpartMutation = useMutation({
        mutationFn: ({ anchorId, toAccountId }) => transactions.createTransferCounterpart(anchorId, toAccountId),
        onSuccess: () => {
            invalidateAfterTxMutation();
            queryClient.invalidateQueries({ queryKey: ['transfer-candidates'] });
            setLinkTransferDialogOpen(false);
            setSelectedIds(new Set());
            toast.success(t('transactions.linkTransferSuccess'));
        },
        onError: (error) => {
            toast.error(extractApiError(error));
        },
    });
    const unlinkTransferMutation = useMutation({
        mutationFn: (pairId) => transactions.unlinkTransfer(pairId),
        onSuccess: () => {
            invalidateAfterTxMutation();
            setDialogOpen(false);
            setEditingTx(null);
            toast.success(t('transactions.unlinkTransferSuccess'));
        },
        onError: (error) => {
            toast.error(extractApiError(error));
        },
    });
    const transferMutation = useMutation({
        mutationFn: (data) => transactions.createTransfer(data),
        onSuccess: () => {
            invalidateAfterTxMutation();
            setTransferDialogOpen(false);
            toast.success(t('transactions.transferCreated'));
        },
        onError: (error) => {
            toast.error(extractApiError(error));
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
                invalidateAfterTxMutation();
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
    const toggleSelect = (id, isShiftKey = false) => {
        setSelectedIds(prev => calculateRangeSelection(prev, lastSelectedId, id, filteredItems, isShiftKey, tx => !tx.is_shared));
        setLastSelectedId(id);
    };
    // Tag filtering is now applied server-side, so the visible list and the
    // page count both reflect the same filtered total — issue #88.
    const filteredItems = useMemo(() => data?.items ?? [], [data?.items]);
    const selectableItems = filteredItems.filter(tx => !tx.is_shared);
    // Group transactions by date for the mobile card view
    const groupedByDate = useMemo(() => {
        const groups = [];
        let current = null;
        for (const tx of filteredItems) {
            if (!current || current.date !== tx.date) {
                current = {
                    date: tx.date,
                    label: new Date(tx.date + 'T00:00:00').toLocaleDateString(dateLocale, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                    }),
                    items: [],
                };
                groups.push(current);
            }
            current.items.push(tx);
        }
        return groups;
    }, [filteredItems, dateLocale]);
    // Pre-resolve accounts into a Map for O(1) lookup in the mobile card view
    const accountById = useMemo(() => {
        const map = new Map();
        for (const a of accountsList ?? [])
            map.set(a.id, a);
        return map;
    }, [accountsList]);
    const toggleSelectAll = () => {
        if (!selectableItems.length)
            return;
        const allSelected = selectableItems.every(tx => selectedIds.has(tx.id));
        if (allSelected) {
            setSelectedIds(new Set());
        }
        else {
            setSelectedIds(new Set(selectableItems.map(tx => tx.id)));
        }
    };
    const allSelected = selectableItems.length > 0 && selectableItems.every(tx => selectedIds.has(tx.id));
    const someSelected = selectableItems.some(tx => selectedIds.has(tx.id)) && !allSelected;
    // Net total of the currently-selected rows (issue #185). Selection is
    // always page-scoped (cleared on page/filter change), so summing the
    // visible page covers every selected id. Cross-currency rows use their
    // primary-currency amount; credits add, debits subtract.
    const selectedNet = useMemo(() => {
        let net = 0;
        for (const tx of data?.items ?? []) {
            if (!selectedIds.has(tx.id))
                continue;
            const base = Math.abs(Number(tx.amount_primary ?? tx.amount));
            net += tx.type === 'credit' ? base : -base;
        }
        return net;
    }, [data?.items, selectedIds]);
    // Resolve the currently-selected transactions into a valid debit/credit pair
    // for the "Link as transfer" action. Returns null if the pair is invalid
    // (wrong count, same account, same type, or already linked).
    const linkablePair = useMemo(() => {
        if (selectedIds.size !== 2)
            return null;
        const selected = (data?.items ?? []).filter(tx => selectedIds.has(tx.id));
        if (selected.length !== 2)
            return null;
        if (selected.some(tx => tx.transfer_pair_id))
            return null;
        if (selected[0].account_id === selected[1].account_id)
            return null;
        const debit = selected.find(tx => tx.type === 'debit');
        const credit = selected.find(tx => tx.type === 'credit');
        if (!debit || !credit)
            return null;
        return { debit, credit };
    }, [selectedIds, data?.items]);
    // Single-selection picker mode: when exactly one unlinked transaction is
    // selected, the user can search for its counterpart across all accounts.
    const linkAnchor = useMemo(() => {
        if (selectedIds.size !== 1)
            return null;
        const selected = (data?.items ?? []).find(tx => selectedIds.has(tx.id));
        if (!selected)
            return null;
        if (selected.transfer_pair_id)
            return null;
        return selected;
    }, [selectedIds, data?.items]);
    const canOpenLinkDialog = !!linkablePair || !!linkAnchor;
    const linkDisabledTooltip = !canOpenLinkDialog && selectedIds.size >= 2
        ? t('transactions.linkTransferInvalidPair')
        : undefined;
    const totalPages = data ? Math.ceil(data.total / limit) : 0;
    const isTransferCategoryPromptOpen = !!pendingTransferCategoryUpdate;
    const submitPendingTransferCategoryUpdate = (applyToTransferPair) => {
        if (!pendingTransferCategoryUpdate)
            return;
        const { id, data } = pendingTransferCategoryUpdate;
        updateMutation.mutate({
            id,
            ...data,
            apply_to_transfer_pair: applyToTransferPair,
        });
        setPendingTransferCategoryUpdate(null);
    };
    const handleTransactionSave = (data, recurringData, installmentData, pendingFiles, action) => {
        if (!editingTx) {
            createTransaction(data, recurringData, installmentData, pendingFiles, action);
            return;
        }
        const isTransferCategoryChange = !!editingTx.transfer_pair_id &&
            Object.prototype.hasOwnProperty.call(data, 'category_id') &&
            data.category_id !== editingTx.category_id;
        if (isTransferCategoryChange) {
            setPendingTransferCategoryUpdate({ id: editingTx.id, data });
            return;
        }
        updateMutation.mutate({ id: editingTx.id, ...data });
    };
    const submitPendingSeriesDelete = (scope) => {
        if (!pendingSeriesDeleteId)
            return;
        deleteMutation.mutate({ id: pendingSeriesDeleteId, applyTo: scope });
        setPendingSeriesDeleteId(null);
    };
    // Open the Add Transaction dialog seeded from an existing row's
    // fields (issue #158). Identity-bearing fields (id, transfer_pair,
    // installment series, splits) are dropped so the dialog treats the
    // result as a brand-new transaction; the user can tweak the date or
    // any other field before saving.
    const handleDuplicateTransaction = (tx) => {
        const draft = {
            description: tx.description,
            amount: tx.amount,
            currency: tx.currency,
            type: tx.type,
            date: tx.date,
            account_id: tx.account_id,
            category_id: tx.category_id,
            payee_id: tx.payee_id,
            payee: tx.payee,
            payee_name: tx.payee_name,
            notes: tx.notes,
        };
        setEditingTx(null);
        resetForm(draft);
        setDialogOpen(true);
    };
    const handleOpenCalendarTransaction = async (id) => {
        try {
            const tx = await transactions.get(id);
            setEditingTx(tx);
            setDuplicateDraft(null);
            setDialogOpen(true);
        }
        catch {
            toast.error(t('common.error'));
        }
    };
    const handleHideIgnoredChange = (next) => {
        setHideIgnored(next);
        setPage(1);
        try {
            localStorage.setItem(HIDE_IGNORED_STORAGE_KEY, String(next));
        }
        catch {
            // Private mode or a full quota: the filter still applies for this visit.
        }
    };
    const handleExport = async () => {
        setExporting(true);
        try {
            if (selectedIds.size > 0) {
                // Selection-only export bypasses other filters and hits the
                // backend's `transaction_ids` short-circuit.
                await transactions.export({ transaction_ids: Array.from(selectedIds) });
            }
            else {
                await transactions.export({
                    account_ids: effectiveAccountIds.length > 0 ? effectiveAccountIds : undefined,
                    category_ids: filterCategoryIds.length > 0 ? filterCategoryIds : undefined,
                    payee_id: filterPayee || undefined,
                    type: filterType || undefined,
                    status: filterStatus || undefined,
                    uncategorized: filterUncategorized ? true : undefined,
                    from: filterFrom || undefined,
                    to: filterTo || undefined,
                    q: searchQuery || undefined,
                    tags: tagFilters.length > 0 ? tagFilters : undefined,
                    exclude_ignored: hideIgnored ? true : undefined,
                });
            }
            toast.success(t('transactions.exportSuccess'));
        }
        catch {
            toast.error(t('transactions.exportError'));
        }
        finally {
            setExporting(false);
        }
    };
    // Resize: track which column is being dragged so we can clear listeners
    // when the gesture ends. The width is committed to grid state on every
    // pointermove for live feedback (cheap — single React state update).
    const resizingRef = useRef(null);
    const startResize = (e, col) => {
        e.preventDefault();
        e.stopPropagation();
        resizingRef.current = { id: col.id, startX: e.clientX, startWidth: grid.widthOf(col.id) };
        const onMove = (ev) => {
            const r = resizingRef.current;
            if (!r)
                return;
            grid.setWidth(r.id, r.startWidth + (ev.clientX - r.startX));
        };
        const onUp = () => {
            resizingRef.current = null;
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };
    const renderHeaderCell = (col) => {
        const isSorted = grid.sortBy === col.id;
        const sortIndicator = isSorted ? (grid.sortDir === 'asc' ? _jsx(ArrowUp, { size: 12 }) : _jsx(ArrowDown, { size: 12 })) : null;
        const alignClass = col.align === 'right' ? 'text-right' : 'text-left';
        const justify = col.align === 'right' ? 'justify-end' : 'justify-start';
        const cursorClass = col.sortable ? 'cursor-pointer select-none hover:text-foreground' : '';
        // Match the amount/attachments body cells' pr-5 so right-aligned
        // headers line up with their values (issue #161 polish).
        const padX = col.align === 'right' ? 'pr-5' : '';
        return (_jsxs(TableHead, { style: { width: grid.widthOf(col.id), minWidth: grid.widthOf(col.id) }, className: `relative text-xs font-medium text-muted-foreground py-3 ${alignClass} ${padX}`, onClick: () => { if (col.sortable)
                grid.toggleSort(col.id); }, children: [_jsxs("div", { className: `flex items-center gap-1 ${justify} ${cursorClass}`, children: [_jsx("span", { className: "truncate", children: t(col.labelKey) }), sortIndicator] }), _jsx("span", { onPointerDown: (e) => startResize(e, col), onClick: (e) => e.stopPropagation(), "aria-hidden": "true", className: "absolute right-0 top-0 h-full w-2 -mr-1 cursor-col-resize select-none hover:bg-primary/40 active:bg-primary/60" })] }, col.id));
    };
    const stripHashtags = (notes) => notes.replace(/#[\wÀ-ž-]+/g, '').trim();
    const renderAmountCell = (tx) => {
        const displayAmount = tx.is_shared && tx.viewer_share != null
            ? Number(tx.viewer_share)
            : Number(tx.amount);
        return (_jsxs(_Fragment, { children: [_jsx("span", { className: `text-xs md:text-sm font-bold tabular-nums ${tx.is_ignored ? 'text-gray-500' : tx.type === 'credit' ? 'text-emerald-600' : 'text-rose-500'}`, children: mask(`${tx.is_ignored ? ' ' : tx.type === 'credit' ? '+' : '−'}${formatCurrency(Math.abs(displayAmount), tx.currency, locale)}`) }), tx.is_shared && (_jsx("p", { className: "text-[10px] text-muted-foreground tabular-nums", children: t('splitGroups.sharedRowParent', {
                        total: formatCurrency(Math.abs(Number(tx.amount)), tx.currency, locale),
                    }) })), !tx.is_shared && tx.viewer_share != null
                    && Math.abs(Number(tx.viewer_share)) !== Math.abs(Number(tx.amount)) && (_jsx("p", { className: "text-[10px] text-muted-foreground tabular-nums", children: t('splitGroups.ownerRowYourShare', {
                        share: formatCurrency(Math.abs(Number(tx.viewer_share)), tx.currency, locale),
                    }) })), tx.amount_primary != null && tx.currency !== userCurrency && (_jsxs("div", { className: "flex items-center justify-end gap-1", children: [tx.fx_fallback && (_jsx("span", { title: t('transactions.fxFallbackTooltip'), children: _jsx(AlertTriangle, { size: 11, className: "text-amber-500 shrink-0" }) })), _jsx("span", { className: "text-[10px] text-muted-foreground tabular-nums", children: mask(formatCurrency(Math.abs(tx.amount_primary), userCurrency, locale)) })] }))] }));
    };
    const renderDescriptionCell = (tx) => {
        const showInlineDate = !grid.isVisible('date');
        const showInlineNotes = !grid.isVisible('notes');
        const showInlineTags = !grid.isVisible('tags');
        const noteText = tx.notes ? stripHashtags(tx.notes) : '';
        const noteTags = tx.notes ? parseHashtags(tx.notes) : [];
        return (_jsxs("div", { className: "flex items-center gap-2 md:gap-3", children: [_jsx(CategoryIcon, { icon: tx.category?.icon, color: tx.category?.color, size: "lg" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("p", { className: "text-sm font-semibold text-foreground truncate", children: tx.description }), tx.group_id && (_jsx("span", { className: "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700 bg-violet-50 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900 px-1.5 py-0.5 rounded-full", title: t('splitGroups.sharedRowTooltip'), children: tx.is_shared && tx.parent_owner_name
                                        ? t('splitGroups.sharedRowBadgeAuthor', {
                                            author: tx.parent_owner_name,
                                            group: groupNameById.get(tx.group_id) ?? '',
                                        })
                                        : t('splitGroups.ownerRowBadge', {
                                            group: groupNameById.get(tx.group_id) ?? '',
                                        }) })), suggestionsByTransaction.get(tx.id) && (_jsxs(Link, { to: "/rules?tab=queue", onClick: (e) => e.stopPropagation(), title: t('transactions.suggestionBadgeTooltip'), className: "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900 px-1.5 py-0.5 rounded-full hover:bg-amber-100 dark:hover:bg-amber-950/70 transition-colors", children: [_jsx(HelpCircle, { className: "h-3 w-3" }), t('transactions.suggestionBadge')] })), (tx.invoice_links ?? []).map((link) => (_jsxs(Link, { to: `/invoices/${link.invoice_id}`, onClick: (e) => e.stopPropagation(), title: t('transactions.invoiceBadgeTooltip'), className: "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 px-1.5 py-0.5 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-950/70 transition-colors", children: [_jsx(Receipt, { className: "h-3 w-3" }), link.external_number
                                            ? t('transactions.invoiceBadge', { number: link.external_number })
                                            : link.number != null
                                                ? t('transactions.invoiceBadge', { number: link.number })
                                                : t('transactions.invoiceBadgeNoNumber')] }, link.invoice_id))), !!tx.transfer_pair_id && (_jsxs("span", { className: "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full", children: [_jsx(ArrowLeftRight, { className: "h-3 w-3" }), t('transactions.transfer'), _jsx("span", { title: t('transactions.transferTooltip'), children: _jsx(HelpCircle, { className: "h-3 w-3 text-blue-400" }) })] })), tx.is_ignored &&
                                    (_jsxs("span", { className: "ml-2 inline-flex items-center gap-1 text-xs text-gray-600 font-normal bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5", children: [_jsx(EyeClosed, { className: "h-3 w-3" }), t('transactions.ignored'), _jsx("span", { title: t('transactions.ignoreTransferHint'), children: _jsx(HelpCircle, { className: "h-3 w-3 text-blue-400" }) })] })), tx.exclude_from_pnl && !tx.is_ignored && (_jsxs("span", { className: "ml-2 inline-flex items-center gap-1 text-xs text-slate-600 font-normal bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 dark:text-slate-300 dark:bg-slate-500/15 dark:border-slate-500/30", children: [_jsx(ChartNoAxesColumn, { className: "h-3 w-3" }), t('transactions.excludedFromReports'), _jsx("span", { title: t('transactions.excludeFromReportsHint'), children: _jsx(HelpCircle, { className: "h-3 w-3 text-blue-400" }) })] })), tx.recurring_transaction_id != null && (_jsx("span", { className: "text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/5 border border-primary/10 px-1.5 py-0.5 rounded-full", title: t('transactions.recurringLinkedTooltip'), children: t('transactions.recurringBadge') })), tx.installment_number != null && tx.total_installments != null && (_jsxs("span", { className: "inline-flex items-center text-[10px] font-bold tabular-nums text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 px-1.5 py-0.5 rounded-full", title: tx.installment_total_amount != null
                                        ? t('transactions.installmentTooltip', { count: tx.total_installments, total: tx.installment_total_amount })
                                        : undefined, children: [tx.installment_number, "/", tx.total_installments] })), shouldShowPendingBadge(tx) && (_jsx("span", { title: t('transactions.pending'), className: "shrink-0 inline-flex items-center justify-center rounded-full border border-amber-200 bg-amber-50 p-0.5 dark:border-amber-500/30 dark:bg-amber-500/10", children: _jsx(Clock, { size: 12, className: "text-amber-500", role: "img", "aria-label": t('transactions.pending') }) })), (tx.attachment_count ?? 0) > 0 && (_jsx(Paperclip, { size: 12, className: "text-muted-foreground shrink-0" }))] }), showInlineDate && (_jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: new Date(tx.date + 'T00:00:00').toLocaleDateString(dateLocale) })), (showInlineNotes || showInlineTags) && tx.notes && (_jsxs("div", { className: "mt-1 space-y-0.5", children: [showInlineNotes && noteText && (_jsx("p", { className: "text-xs text-muted-foreground italic leading-snug truncate", children: noteText })), showInlineTags && noteTags.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1", children: noteTags.map((tag) => (_jsx("span", { className: "inline-block text-[11px] font-medium bg-primary/5 text-primary border border-primary/10 px-1.5 py-0 rounded-full leading-5 cursor-pointer hover:bg-primary/10 transition-colors", onClick: (e) => { e.stopPropagation(); addTagFilter(tag); }, children: tag }, tag))) }))] }))] })] }));
    };
    const renderBodyCell = (col, tx) => {
        const widthStyle = { width: grid.widthOf(col.id), minWidth: grid.widthOf(col.id) };
        const alignClass = col.align === 'right' ? 'text-right' : '';
        const baseClass = `py-2.5 ${alignClass}`;
        switch (col.id) {
            case 'date':
                return (_jsx(TableCell, { style: widthStyle, className: `${baseClass} text-sm text-muted-foreground tabular-nums`, children: new Date(tx.date + 'T00:00:00').toLocaleDateString(dateLocale) }, col.id));
            case 'description':
                return (_jsx(TableCell, { style: widthStyle, className: `${baseClass} pl-2 max-w-0`, children: renderDescriptionCell(tx) }, col.id));
            case 'category':
                return (_jsx(TableCell, { style: widthStyle, className: baseClass, children: tx.category ? (_jsx("span", { className: "text-sm text-muted-foreground", children: tx.category.name })) : (_jsx("span", { className: "text-xs text-muted-foreground italic", children: t('transactions.noCategory') })) }, col.id));
            case 'account': {
                const acc = accountsList?.find((a) => a.id === tx.account_id);
                return (_jsx(TableCell, { style: widthStyle, className: `${baseClass} text-sm text-muted-foreground`, children: acc ? (_jsxs("span", { className: "flex items-center gap-2 min-w-0", children: [_jsx(AccountIcon, { account: acc, size: "sm" }), _jsx("span", { className: "truncate", children: getAccountName(acc) })] })) : (_jsx("span", { className: "text-muted-foreground", children: "\u2014" })) }, col.id));
            }
            case 'amount':
                return (_jsx(TableCell, { style: widthStyle, className: `${baseClass} pr-5`, children: renderAmountCell(tx) }, col.id));
            case 'payee':
                return (_jsx(TableCell, { style: widthStyle, className: `${baseClass} text-sm text-muted-foreground`, children: tx.payee_name ?? tx.payee ?? _jsx("span", { className: "text-muted-foreground", children: "\u2014" }) }, col.id));
            case 'notes': {
                const text = tx.notes ? stripHashtags(tx.notes) : '';
                return (_jsx(TableCell, { style: widthStyle, className: `${baseClass} text-xs text-muted-foreground italic max-w-0 truncate`, children: text || _jsx("span", { className: "not-italic", children: "\u2014" }) }, col.id));
            }
            case 'tags': {
                const tags = tx.notes ? parseHashtags(tx.notes) : [];
                return (_jsx(TableCell, { style: widthStyle, className: baseClass, children: tags.length === 0 ? (_jsx("span", { className: "text-muted-foreground", children: "\u2014" })) : (_jsx("div", { className: "flex flex-wrap gap-1", children: tags.map((tag) => (_jsx("span", { className: "inline-block text-[11px] font-medium bg-primary/5 text-primary border border-primary/10 px-1.5 py-0 rounded-full leading-5 cursor-pointer hover:bg-primary/10", onClick: (e) => { e.stopPropagation(); addTagFilter(tag); }, children: tag }, tag))) })) }, col.id));
            }
            case 'attachments':
                return (_jsx(TableCell, { style: widthStyle, className: `${baseClass} pr-5 text-sm text-muted-foreground tabular-nums`, children: (tx.attachment_count ?? 0) > 0 ? (_jsxs("span", { className: "inline-flex items-center gap-1 justify-end w-full", children: [_jsx(Paperclip, { size: 12 }), tx.attachment_count] })) : _jsx("span", { children: "\u2014" }) }, col.id));
            case 'type':
                return (_jsx(TableCell, { style: widthStyle, className: `${baseClass} text-sm`, children: _jsx("span", { className: tx.type === 'credit' ? 'text-emerald-600' : 'text-rose-500', children: tx.type === 'credit' ? t('transactions.typeIncome') : t('transactions.typeExpense') }) }, col.id));
            case 'status':
                return (_jsx(TableCell, { style: widthStyle, className: `${baseClass} text-sm text-muted-foreground capitalize`, children: tx.status === 'pending'
                        ? t('transactions.statusPending')
                        : t('transactions.statusPosted') }, col.id));
        }
    };
    // A single non-shared, non-transfer row selected can be duplicated; shared
    // and transfer rows can't (issue #158). Computed once for both the desktop
    // button and the mobile overflow menu.
    const selectedSingleTx = canWrite && selectedIds.size === 1
        ? filteredItems.find(tx => selectedIds.has(tx.id))
        : undefined;
    const duplicableTx = selectedSingleTx && !selectedSingleTx.is_shared && !selectedSingleTx.transfer_pair_id
        ? selectedSingleTx
        : null;
    const exportLabel = exporting
        ? t('transactions.exporting')
        : selectedIds.size > 0
            ? t('transactions.exportSelected', { count: selectedIds.size })
            : t('transactions.exportCsv');
    return (_jsxs("div", { children: [_jsx(PageHeader, { section: t('transactions.section'), title: t('transactions.title'), action: _jsx(TransactionsPageActions, { month: {
                        value: steppedMonth,
                        onChange: handleMonthChange,
                        locale: i18n.resolvedLanguage ?? i18n.language,
                        prevLabel: t('transactions.monthPrevious'),
                        nextLabel: t('transactions.monthNext'),
                    }, view: {
                        value: viewMode,
                        onChange: (value) => {
                            if (value === 'calendar' && filterAccountIds.length > 1)
                                setFilterAccountIds([]);
                            setViewMode(value);
                        },
                        listLabel: t('transactions.listView'),
                        calendarLabel: t('transactions.calendarView'),
                    }, columnPicker: viewMode === 'list' ? _jsx(TransactionsColumnPicker, { state: grid }) : null, exportLabel: exportLabel, exporting: exporting, onExport: handleExport, onAdd: canWrite ? () => { setEditingTx(null); setDialogOpen(true); } : undefined, onDuplicate: duplicableTx ? () => handleDuplicateTransaction(duplicableTx) : undefined, onTransfer: canWrite ? () => setTransferDialogOpen(true) : undefined }) }), _jsx(TransactionsFilterBar, { searchInput: searchInput, onSearchChange: (v) => setSearchInput(v), onSearchSubmit: (value) => {
                    const trimmed = value.trim();
                    // Tokenize submitted text. `#`-tokens become live tag filter
                    // chips below the search bar (filtering applies immediately, no
                    // Enter required). Non-`#` text remains as the free-text search
                    // query (issue #88).
                    const tokens = trimmed.split(/\s+/).filter(Boolean);
                    const tags = tokens.filter(t => t.startsWith('#'));
                    const text = tokens.filter(t => !t.startsWith('#')).join(' ');
                    tags.forEach(addTagFilter);
                    setSearchInput(text);
                    setSearchQuery(text);
                }, filterAccountIds: filterAccountIds, onAccountIdsChange: (v) => { setFilterAccountIds(viewMode === 'calendar' ? v.slice(0, 1) : v); setPage(1); }, accountSelectionMode: viewMode === 'calendar' ? 'single' : 'multiple', filterCategoryIds: filterCategoryIds, onCategoryIdsChange: (v) => { setFilterCategoryIds(v); setPage(1); }, filterUncategorized: filterUncategorized, onUncategorizedChange: (v) => { setFilterUncategorized(v); setPage(1); }, filterPayee: filterPayee, onPayeeChange: (v) => { setFilterPayee(v); setPage(1); }, filterGroupId: filterGroupId, onGroupIdChange: (v) => { setFilterGroupId(v); setPage(1); }, filterType: filterType, onTypeChange: (v) => { setFilterType(v); setPage(1); }, filterStatus: filterStatus, onStatusChange: (v) => { setFilterStatus(v); setPage(1); }, hideIgnored: hideIgnored, onHideIgnoredChange: handleHideIgnoredChange, filterFrom: filterFrom, filterTo: filterTo, onDateRangeChange: (from, to) => { setFilterFrom(from); setFilterTo(to); setPage(1); }, filterMinAmount: filterMinAmount, filterMaxAmount: filterMaxAmount, onAmountRangeChange: (min, max) => { setFilterMinAmount(min); setFilterMaxAmount(max); setPage(1); }, onClearAll: () => {
                    setFilterFrom('');
                    setFilterTo('');
                    setFilterAccountIds([]);
                    setFilterCategoryIds([]);
                    setFilterUncategorized(false);
                    setFilterPayee('');
                    setFilterGroupId('');
                    setFilterType('');
                    setFilterStatus('');
                    setFilterMinAmount('');
                    setFilterMaxAmount('');
                    handleHideIgnoredChange(false);
                    setSearchInput('');
                    setSearchQuery('');
                    clearTagFilters();
                    setPage(1);
                }, accounts: accountsList ?? [], categories: categoriesList ?? [], referenceCategories: allCategoriesList, categoryGroups: categoryGroupsList ?? [], payees: payeesList ?? [], groups: allGroups ?? [] }), filterGroupId && (_jsx("div", { className: "mb-4 flex flex-wrap items-center gap-1.5", children: _jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-medium text-primary", children: [t('splitGroups.title'), ": ", filterGroup?.name ?? '…', _jsx("button", { onClick: () => { setFilterGroupId(''); setPage(1); }, className: "ml-0.5 text-primary/60 hover:text-primary", "aria-label": t('transactions.clearGroupFilter'), children: "\u00D7" })] }) })), tagFilters.length > 0 && (_jsx("div", { className: "mb-4 flex flex-wrap items-center gap-1.5", children: tagFilters.map(tag => (_jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-medium text-primary", children: [_jsx("span", { children: tag }), _jsx("button", { onClick: () => removeTagFilter(tag), className: "ml-0.5 text-primary/60 hover:text-primary", "aria-label": `Remove ${tag} filter`, children: _jsx(X, { size: 12 }) })] }, tag))) })), isAccrual && (filterFrom || filterTo) && (_jsxs("div", { className: "mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground", children: [_jsx(Info, { size: 12, className: "mt-0.5 shrink-0" }), _jsx("span", { children: t('dashboard.accrualNote') })] })), viewMode === 'calendar' && (_jsx(TransactionCalendarView, { calendar: calendarData, isLoading: calendarLoading, locale: locale, dateLocale: dateLocale, mask: mask, selectedDate: calendarSelectedDate, onSelectedDateChange: setCalendarSelectedDate, onOpenTransaction: handleOpenCalendarTransaction, accounts: accountsList, userCurrency: userCurrency })), viewMode === 'list' && (_jsxs("div", { className: "bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-4", children: [isLoading ? (_jsx("div", { className: "p-6 space-y-3", children: Array.from({ length: 5 }).map((_, i) => (_jsx(Skeleton, { className: "h-14 w-full" }, i))) })) : isMobile ? (_jsxs("div", { children: [groupedByDate.map((group) => (_jsxs("div", { children: [_jsx("div", { className: "bg-muted/80 px-4 py-1.5 border-b border-border", children: _jsx("span", { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wider", children: group.label }) }), group.items.map((tx) => (_jsx(MobileTransactionRow, { tx: tx, account: tx.account_id ? accountById.get(tx.account_id) : undefined, groupName: tx.group_id ? groupNameById.get(tx.group_id) : undefined, selected: selectedIds.has(tx.id), selectable: canWrite && !tx.is_shared, canWrite: canWrite, highlighted: tx.id === highlightId, highlightedRowRef: tx.id === highlightId ? highlightedRowRef : undefined, locale: locale, userCurrency: userCurrency, onSelect: toggleSelect, onClick: (t) => {
                                            if (t.is_shared) {
                                                if (t.group_id)
                                                    navigate(`/groups/${t.group_id}`);
                                                return;
                                            }
                                            setEditingTx(t);
                                            setDialogOpen(true);
                                        } }, tx.id)))] }, group.date))), filteredItems.length === 0 && (_jsx("div", { className: "text-center py-16 text-muted-foreground", children: t('transactions.noResults') }))] })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs(Table, { style: { tableLayout: 'fixed' }, children: [_jsx(TableHeader, { children: _jsxs(TableRow, { className: "border-b border-border hover:bg-transparent", children: [_jsx(TableHead, { style: { width: 40, minWidth: 40 }, className: "py-3 pl-4 pr-0", children: canWrite && (_jsx("input", { type: "checkbox", checked: allSelected, ref: (el) => { if (el)
                                                        el.indeterminate = someSelected; }, onChange: toggleSelectAll, className: "h-4 w-4 rounded border-border accent-primary cursor-pointer" })) }), grid.visibleColumns.map(renderHeaderCell)] }) }), _jsxs(TableBody, { children: [filteredItems.map((tx) => (_jsxs(TableRow, { ref: tx.id === highlightId ? highlightedRowRef : undefined, className: `hover:bg-muted border-b border-border last:border-0 ${selectedIds.has(tx.id) ? 'bg-primary/5' : ''} ${tx.is_shared || !canWrite ? 'cursor-default' : 'cursor-pointer'}`, onClick: () => {
                                                if (tx.is_shared) {
                                                    // Owned by another user — view in the group context instead.
                                                    if (tx.group_id)
                                                        navigate(`/groups/${tx.group_id}`);
                                                    return;
                                                }
                                                if (!canWrite)
                                                    return;
                                                setEditingTx(tx);
                                                setDialogOpen(true);
                                            }, children: [_jsx(TableCell, { style: { width: 40, minWidth: 40 }, className: "py-2.5 pl-4 pr-0", children: canWrite && !tx.is_shared && (_jsx("input", { type: "checkbox", checked: selectedIds.has(tx.id), onChange: () => { }, onClick: (e) => {
                                                            e.stopPropagation();
                                                            toggleSelect(tx.id, e.shiftKey);
                                                        }, className: "h-4 w-4 rounded border-border accent-primary cursor-pointer" })) }), grid.visibleColumns.map(col => renderBodyCell(col, tx))] }, tx.id))), filteredItems.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: grid.visibleColumns.length + 1, className: "text-center py-16 text-muted-foreground", children: t('transactions.noResults') }) }))] })] }) })), !isLoading && data?.summary && filteredItems.length > 0 && (_jsxs("div", { className: "flex flex-col sm:flex-row flex-wrap sm:items-center gap-x-5 gap-y-1 border-t border-border bg-muted/30 px-4 py-2.5", children: [_jsxs("div", { className: "flex items-center justify-between sm:hidden", children: [_jsx("span", { className: "text-xs text-muted-foreground", children: t('transactions.summaryCount', { count: data.total }) }), _jsxs("span", { className: "flex items-baseline gap-1.5 text-xs", children: [_jsx("span", { className: "text-muted-foreground", children: t('transactions.summaryNet') }), _jsx("span", { className: `text-sm font-bold tabular-nums ${data.summary.net >= 0 ? 'text-emerald-600' : 'text-rose-500'}`, children: mask(formatCurrency(data.summary.net, data.summary.currency, locale)) })] })] }), _jsxs("div", { className: "flex items-center justify-between sm:hidden", children: [_jsxs("span", { className: "flex items-baseline gap-1.5 text-xs", children: [_jsx("span", { className: "text-muted-foreground", children: t('transactions.summaryIncome') }), _jsx("span", { className: "text-sm font-semibold tabular-nums text-emerald-600", children: mask(formatCurrency(data.summary.income, data.summary.currency, locale)) })] }), _jsxs("span", { className: "flex items-baseline gap-1.5 text-xs", children: [_jsx("span", { className: "text-muted-foreground", children: t('transactions.summaryExpenses') }), _jsx("span", { className: "text-sm font-semibold tabular-nums text-rose-500", children: mask(formatCurrency(data.summary.expense, data.summary.currency, locale)) })] })] }), data.summary.excluded > 0 && (_jsxs("span", { className: "flex items-baseline gap-1.5 text-xs sm:hidden", children: [_jsx("span", { className: "text-muted-foreground", children: t('transactions.summaryExcluded') }), _jsx("span", { className: "text-sm font-semibold tabular-nums text-muted-foreground", children: mask(formatCurrency(data.summary.excluded, data.summary.currency, locale)) })] })), _jsx("span", { className: "mr-auto text-xs text-muted-foreground hidden sm:inline", children: t('transactions.summaryCount', { count: data.total }) }), data.summary.excluded > 0 && (_jsxs("span", { className: "hidden sm:flex items-baseline gap-1.5 text-xs", children: [_jsx("span", { className: "text-muted-foreground", children: t('transactions.summaryExcluded') }), _jsx("span", { className: "text-sm font-semibold tabular-nums text-muted-foreground", children: mask(formatCurrency(data.summary.excluded, data.summary.currency, locale)) })] })), _jsxs("span", { className: "hidden sm:flex items-baseline gap-1.5 text-xs", children: [_jsx("span", { className: "text-muted-foreground", children: t('transactions.summaryIncome') }), _jsx("span", { className: "text-sm font-semibold tabular-nums text-emerald-600", children: mask(formatCurrency(data.summary.income, data.summary.currency, locale)) })] }), _jsxs("span", { className: "hidden sm:flex items-baseline gap-1.5 text-xs", children: [_jsx("span", { className: "text-muted-foreground", children: t('transactions.summaryExpenses') }), _jsx("span", { className: "text-sm font-semibold tabular-nums text-rose-500", children: mask(formatCurrency(data.summary.expense, data.summary.currency, locale)) })] }), _jsxs("span", { className: "hidden sm:flex items-baseline gap-1.5 text-xs", children: [_jsx("span", { className: "text-muted-foreground", children: t('transactions.summaryNet') }), _jsx("span", { className: `text-sm font-bold tabular-nums ${data.summary.net >= 0 ? 'text-emerald-600' : 'text-rose-500'}`, children: mask(formatCurrency(data.summary.net, data.summary.currency, locale)) })] })] }))] })), viewMode === 'list' && data && data.total > 10 && (_jsxs("div", { className: `flex flex-col sm:flex-row items-center justify-between gap-4 py-4 ${selectedIds.size > 0 ? 'pb-20' : ''}`, children: [_jsx("div", { className: "hidden sm:block w-32" }), totalPages > 1 ? (_jsxs("div", { className: "flex items-center justify-center gap-2", children: [_jsx(Button, { variant: "outline", size: "sm", disabled: page <= 1, onClick: () => setPage(page - 1), children: t('transactions.previous') }), _jsxs("span", { className: "text-sm text-muted-foreground", children: [page, " / ", totalPages] }), _jsx(Button, { variant: "outline", size: "sm", disabled: page >= totalPages, onClick: () => setPage(page + 1), children: t('transactions.next') })] })) : (_jsx("div", { className: "hidden sm:block" })), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-xs text-muted-foreground", children: t('common.rowsPerPage', 'Rows per page') }), _jsxs(Select, { value: String(limit), onValueChange: (val) => {
                                    const nextLimit = Number(val);
                                    setLimit(nextLimit);
                                    setPage(1);
                                    try {
                                        localStorage.setItem('securo.transactions.pageSize', String(nextLimit));
                                    }
                                    catch {
                                        // ignored
                                    }
                                }, children: [_jsx(SelectTrigger, { className: "w-[70px] h-8 text-xs", children: _jsx(SelectValue, { placeholder: limit }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "10", children: "10" }), _jsx(SelectItem, { value: "20", children: "20" }), _jsx(SelectItem, { value: "50", children: "50" }), _jsx(SelectItem, { value: "100", children: "100" })] })] })] })] })), viewMode === 'list' && selectedIds.size > 0 && (_jsx("div", { className: "fixed bottom-0 left-0 right-0 lg:left-60 z-50", children: _jsx("div", { className: "mx-auto max-w-7xl px-3 md:px-6 pb-4 md:pb-6", children: _jsxs("div", { className: "flex items-stretch gap-1.5 bg-card border border-border shadow-xl rounded-2xl p-2", children: [_jsx(MobileBulkSelectionActions, { selectedCount: selectedIds.size, categoryValue: bulkCategory, categories: categoriesList ?? [], categoryGroups: categoryGroupsList ?? [], categoryPending: bulkCategorizeMutation.isPending, groupPending: bulkAddToGroupMutation.isPending, tagInput: bulkTagInput, addTagsPending: bulkAddTagsMutation.isPending, removeTagsPending: bulkRemoveTagsMutation.isPending, transferDisabled: !canOpenLinkDialog, transferTitle: linkDisabledTooltip ?? t('transactions.linkAsTransfer'), onCategoryChange: (next) => {
                                    setBulkCategory(next);
                                    if (next)
                                        bulkCategorizeMutation.mutate({ ids: Array.from(selectedIds), categoryId: next });
                                }, onOpenGroup: () => setBulkAddToGroupOpen(true), onOpenTransfer: () => setLinkTransferDialogOpen(true), onCreateRule: selectedSingleTx && !selectedSingleTx.is_shared
                                    ? () => handleCreateRuleFromTransaction(selectedSingleTx)
                                    : undefined, onTagInputChange: setBulkTagInput, onAddTags: (tags) => bulkAddTagsMutation.mutate({ ids: Array.from(selectedIds), tags }), onRemoveTags: (tags) => bulkRemoveTagsMutation.mutate({ ids: Array.from(selectedIds), tags }), onBulkDelete: () => setBulkDeleteConfirmOpen(true), onClear: () => { setSelectedIds(new Set()); setBulkCategory(''); setBulkTagInput(''); } }), _jsxs("div", { className: "hidden w-full items-stretch gap-1.5 sm:flex", children: [_jsxs("div", { className: "flex items-center gap-2.5 pl-3 pr-4 whitespace-nowrap", children: [_jsx("span", { className: "inline-flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0", children: selectedIds.size }), _jsxs("div", { className: "hidden sm:flex flex-col leading-tight", children: [_jsx("span", { className: "text-[11px] font-medium text-muted-foreground", children: t('transactions.selected') }), _jsx("span", { className: `text-sm font-bold tabular-nums ${selectedNet >= 0 ? 'text-emerald-600' : 'text-rose-500'}`, children: mask(`${selectedNet >= 0 ? '+' : '−'}${formatCurrency(Math.abs(selectedNet), userCurrency, locale)}`) })] })] }), _jsx("div", { className: "w-px bg-border/60 self-stretch" }), _jsx(CategorySelect, { value: bulkCategory, onChange: (next) => {
                                            setBulkCategory(next);
                                            if (next) {
                                                bulkCategorizeMutation.mutate({ ids: Array.from(selectedIds), categoryId: next });
                                            }
                                        }, categories: categoriesList ?? [], groups: categoryGroupsList ?? [], placeholder: t('transactions.selectCategory'), disabled: bulkCategorizeMutation.isPending, className: "w-44 md:w-56 h-auto py-2 border-transparent bg-transparent hover:bg-muted/60 focus:bg-muted/60 focus-visible:ring-0", contentProps: { side: 'top', sideOffset: 8 } }, bulkCategory), _jsx("div", { className: "w-px bg-border/60 self-stretch" }), _jsxs(Button, { size: "sm", variant: "ghost", disabled: bulkAddToGroupMutation.isPending, onClick: () => setBulkAddToGroupOpen(true), title: t('transactions.addToGroup'), className: "h-8 px-3 shrink-0 text-sm", children: [_jsx(Users, { size: 15, className: "lg:mr-1.5" }), _jsx("span", { className: "hidden lg:inline", children: t('transactions.addToGroup') })] }), _jsx("div", { className: "w-px bg-border/60 self-stretch" }), _jsxs("div", { className: "flex items-center gap-1 px-1", children: [_jsx("input", { type: "text", value: bulkTagInput, onChange: (e) => setBulkTagInput(e.target.value), placeholder: t('transactions.addTagsPlaceholder', '#tag…'), className: "rounded-lg px-2.5 py-2 text-sm bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:bg-muted/60 w-28 md:w-40", onKeyDown: (e) => {
                                                    if (e.key === 'Enter' && bulkTagInput.trim()) {
                                                        e.preventDefault();
                                                        const tagList = bulkTagInput.trim().split(/[\s,]+/).filter(Boolean);
                                                        bulkAddTagsMutation.mutate({ ids: Array.from(selectedIds), tags: tagList });
                                                    }
                                                } }), _jsx(Button, { size: "sm", variant: "ghost", disabled: !bulkTagInput.trim() || bulkAddTagsMutation.isPending, onClick: () => {
                                                    const tagList = bulkTagInput.trim().split(/[\s,]+/).filter(Boolean);
                                                    if (tagList.length === 0)
                                                        return;
                                                    bulkAddTagsMutation.mutate({ ids: Array.from(selectedIds), tags: tagList });
                                                }, className: "h-8 w-8 px-0 shrink-0", title: t('transactions.bulkAddTags', 'Add tags'), children: _jsx(Check, { size: 15 }) }), _jsx(Button, { size: "sm", variant: "ghost", disabled: !bulkTagInput.trim() || bulkRemoveTagsMutation.isPending, onClick: () => {
                                                    const tagList = bulkTagInput.trim().split(/[\s,]+/).filter(Boolean);
                                                    if (tagList.length === 0)
                                                        return;
                                                    bulkRemoveTagsMutation.mutate({ ids: Array.from(selectedIds), tags: tagList });
                                                }, className: "h-8 w-8 px-0 shrink-0", title: t('transactions.bulkRemoveTags', 'Remove tags'), children: _jsx(X, { size: 15 }) })] }), _jsx("div", { className: "w-px bg-border/60 self-stretch" }), _jsxs(Button, { size: "sm", variant: "ghost", disabled: !canOpenLinkDialog, title: linkDisabledTooltip ?? t('transactions.linkAsTransfer'), onClick: () => setLinkTransferDialogOpen(true), className: "h-8 px-3 shrink-0 text-sm", children: [_jsx(ArrowLeftRight, { size: 15, className: "mr-1.5" }), _jsx("span", { className: "hidden lg:inline", children: t('transactions.linkAsTransfer') })] }), _jsx("div", { className: "w-px bg-border/60 self-stretch" }), selectedIds.size === 1 && (() => {
                                        const selectedTx = filteredItems.find(tx => selectedIds.has(tx.id));
                                        if (!selectedTx || selectedTx.is_shared)
                                            return null;
                                        return (_jsxs(Button, { size: "sm", variant: "ghost", onClick: () => handleCreateRuleFromTransaction(selectedTx), className: "h-8 px-3 shrink-0 text-sm", title: t('transactions.createRule'), children: [_jsx(SlidersHorizontal, { size: 15, className: "lg:mr-1.5" }), _jsx("span", { className: "hidden lg:inline", children: t('transactions.createRule') })] }));
                                    })(), _jsxs(Button, { size: "sm", variant: "destructive", onClick: () => setBulkDeleteConfirmOpen(true), disabled: bulkDeleteMutation.isPending, className: "h-8 px-3 shrink-0 text-sm", children: [_jsx(Trash2, { size: 15, className: "lg:mr-1.5" }), _jsx("span", { className: "hidden lg:inline", children: t('common.delete') })] }), _jsx("div", { className: "ml-auto" }), _jsx("button", { onClick: () => { setSelectedIds(new Set()); setBulkCategory(''); setBulkTagInput(''); }, className: "text-muted-foreground hover:text-foreground p-2 shrink-0 self-center rounded-lg hover:bg-muted/60", title: t('common.close', 'Close'), children: _jsx(X, { size: 16 }) })] })] }) }) })), _jsx(BulkAddToGroupDialog, { open: bulkAddToGroupOpen, onClose: () => setBulkAddToGroupOpen(false), selectedCount: selectedIds.size, onSubmit: (payload) => bulkAddToGroupMutation.mutate({ ids: Array.from(selectedIds), payload }), isPending: bulkAddToGroupMutation.isPending }), _jsx(LinkTransferDialog, { open: linkTransferDialogOpen, onClose: () => setLinkTransferDialogOpen(false), debit: linkablePair?.debit ?? null, credit: linkablePair?.credit ?? null, anchor: linkAnchor, accounts: accountsList ?? [], onConfirm: (debitId, creditId) => {
                    linkTransferMutation.mutate([debitId, creditId]);
                }, onCreateCounterpart: (anchorId, toAccountId) => {
                    createCounterpartMutation.mutate({ anchorId, toAccountId });
                }, loading: linkTransferMutation.isPending || createCounterpartMutation.isPending }), _jsx(TransferDialog, { open: transferDialogOpen, onClose: () => setTransferDialogOpen(false), accounts: accountsList ?? [], onSave: (data) => transferMutation.mutate(data), loading: transferMutation.isPending }), _jsx(TransactionDialog, { open: dialogOpen, onClose: () => {
                    setDialogOpen(false);
                    setEditingTx(null);
                    setDuplicateDraft(null);
                    setPendingTransferCategoryUpdate(null);
                    // Drop any prior mutation error so reopening the dialog
                    // doesn't surface a stale message (issue #155).
                    createMutation.reset();
                    updateMutation.reset();
                }, transaction: editingTx, duplicateDraft: duplicateDraft, formResetKey: formResetKey, categories: categoriesList ?? [], categoryGroups: categoryGroupsList ?? [], accounts: accountsList ?? [], recurringMatch: editingTx?.recurring_transaction_id
                    ? recurringById.get(editingTx.recurring_transaction_id)
                    : undefined, onSave: handleTransactionSave, onDelete: editingTx ? () => {
                    if (isManualInstallmentSeriesRow(editingTx)) {
                        // Deleting one row of a manual series — ask the user
                        // whether to drop this, this+future, or all installments.
                        setPendingSeriesDeleteId(editingTx.id);
                    }
                    else {
                        deleteMutation.mutate({ id: editingTx.id });
                    }
                } : undefined, onUnlinkTransfer: (pairId) => unlinkTransferMutation.mutate(pairId), onIgnoreChanged: invalidateAfterTxMutation, onCreateRule: (tx) => {
                    setDialogOpen(false);
                    setEditingTx(null);
                    handleCreateRuleFromTransaction(tx);
                }, loading: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending || unlinkTransferMutation.isPending, error: createMutation.error || updateMutation.error ? extractApiError(createMutation.error || updateMutation.error) : null, isSynced: editingTx?.source === 'sync' }), _jsx(Dialog, { open: isTransferCategoryPromptOpen, onOpenChange: (open) => {
                    if (!open)
                        setPendingTransferCategoryUpdate(null);
                }, children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('transactions.confirmTransferCategoryTitle') }) }), _jsx("p", { className: "text-sm text-muted-foreground", children: t('transactions.confirmTransferCategoryDesc') }), _jsxs(DialogFooter, { className: "flex-row flex-nowrap items-center justify-end gap-2 sm:space-x-0", children: [_jsx(Button, { className: "shrink-0", variant: "outline", onClick: () => setPendingTransferCategoryUpdate(null), children: t('common.cancel') }), _jsx(Button, { className: "min-w-0 flex-1 truncate", variant: "outline", onClick: () => submitPendingTransferCategoryUpdate(false), disabled: updateMutation.isPending, children: t('transactions.confirmTransferCategorySingle') }), _jsx(Button, { className: "min-w-0 flex-1 truncate", onClick: () => submitPendingTransferCategoryUpdate(true), disabled: updateMutation.isPending, children: updateMutation.isPending
                                        ? t('common.loading')
                                        : t('transactions.confirmTransferCategoryBoth') })] })] }) }), _jsx(Dialog, { open: !!pendingSeriesDeleteId, onOpenChange: (open) => {
                    if (!open)
                        setPendingSeriesDeleteId(null);
                }, children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('transactions.installmentScopeTitle') }) }), _jsx("p", { className: "text-sm text-muted-foreground", children: t('transactions.installmentScopeDeleteDesc') }), _jsxs(DialogFooter, { className: "flex-col sm:flex-row sm:justify-end gap-2", children: [_jsx(Button, { autoFocus: true, onClick: () => submitPendingSeriesDelete('this'), disabled: updateMutation.isPending || deleteMutation.isPending, className: "justify-center", children: updateMutation.isPending || deleteMutation.isPending
                                        ? t('common.loading')
                                        : t('transactions.installmentScopeThis') }), _jsx(Button, { variant: "outline", onClick: () => submitPendingSeriesDelete('future'), disabled: updateMutation.isPending || deleteMutation.isPending, className: "justify-center", children: t('transactions.installmentScopeFuture') }), _jsx(Button, { variant: "outline", onClick: () => submitPendingSeriesDelete('all'), disabled: updateMutation.isPending || deleteMutation.isPending, className: "justify-center", children: t('transactions.installmentScopeAll') })] })] }) }), _jsx(Dialog, { open: bulkDeleteConfirmOpen, onOpenChange: setBulkDeleteConfirmOpen, children: _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('transactions.bulkDeleteTitle', { count: selectedIds.size }) }), _jsx(DialogDescription, { children: t('transactions.bulkDeleteDescription') })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "ghost", onClick: () => setBulkDeleteConfirmOpen(false), children: t('common.cancel') }), _jsx(Button, { variant: "destructive", onClick: () => bulkDeleteMutation.mutate(), disabled: bulkDeleteMutation.isPending, children: bulkDeleteMutation.isPending ? t('common.loading') : t('common.delete') })] })] }) }), _jsx(RuleDialog, { open: createRuleOpen, onClose: () => { setCreateRuleOpen(false); setCreateRuleInitialData(undefined); }, rule: null, categories: categoriesList ?? [], categoryGroups: categoryGroupsList ?? [], accounts: accountsList ?? [], payees: payeesList ?? [], onSave: (data) => createRuleMutation.mutate(data), loading: createRuleMutation.isPending, initialData: createRuleInitialData }, createRuleOpen ? 'rule-open' : 'rule-closed')] }));
}
