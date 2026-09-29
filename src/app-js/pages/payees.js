import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDisplayLocale } from '../hooks/use-display-locale.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { payees as payeesApi } from '../lib/api.js';
import { invalidateFinancialQueries } from '../lib/invalidate-queries.js';
import { toast } from 'sonner';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { fiscal as fiscalApi } from '../lib/api.js';
import { applyMask, formatTaxId } from '../lib/tax-id.js';
import { TaxIdKindPicker } from '../components/tax-id-kind-picker.js';
import { Label } from '../components/ui/label.js';
import { Skeleton } from '../components/ui/skeleton.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from '../components/ui/dialog.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '../components/ui/table.js';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuCheckboxItem, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal, } from '../components/ui/dropdown-menu.js';
import { cn } from '../lib/utils.js';
import { PageHeader } from '../components/page-header.js';
import { calculateRangeSelection } from '../lib/selection-utils.js';
import { PayeeDetailDialog } from '../components/payee-detail-dialog.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '../components/ui/select.js';
import { Search, Star, Merge, Trash2, ListFilter, X, Check, Pencil, Plus, ArrowDown, ArrowUp } from 'lucide-react';
import { useWorkspace } from '../contexts/workspace-context.js';
import { payeeErrorMessage } from '../lib/payee-error-message.js';
import { INITIAL_SORT_DIRECTIONS, loadPayeeSort, PAYEE_SORT_STORAGE_KEY, sortPayees, } from '../lib/payee-sorting.js';
const PAGE_SIZES = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;
export default function PayeesPage() {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const locale = useDisplayLocale();
    const { canWrite } = useWorkspace();
    // No entry for an unset type: most rows come from sync, which cannot know
    // a legal nature from a bank descriptor, and a badge reading "unknown" on
    // hundreds of rows is noise rather than information.
    const typeLabels = useMemo(() => ({
        person: t('payees.typePerson'),
        company: t('payees.typeCompany'),
    }), [t]);
    const queryClient = useQueryClient();
    const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
    const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
    const debounceRef = useRef(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingPayee, setEditingPayee] = useState(null);
    const [summaryPayee, setSummaryPayee] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [lastSelectedId, setLastSelectedId] = useState(null);
    const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
    const [mergeTargetId, setMergeTargetId] = useState('');
    const [filterType, setFilterType] = useState(() => searchParams.get('type') ?? '');
    const [filterFavorites, setFilterFavorites] = useState(() => searchParams.get('is_favorite') === 'true');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [payeesToDelete, setPayeesToDelete] = useState([]);
    const [sort, setSort] = useState(() => loadPayeeSort());
    // Seeded from the URL so a link to page 3 lands on page 3. Page size is a
    // preference rather than a location, so it lives in storage instead.
    const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page')) || 1));
    const [pageSize, setPageSize] = useState(() => {
        try {
            // Only a size we actually offer. A stale or hand-edited entry of "0"
            // makes totalPages Infinity and of "abc" makes it NaN, and either way
            // the slice below comes back empty and the table renders no rows over
            // data that loaded fine.
            const stored = Number(localStorage.getItem('securo.payees.pageSize'));
            return PAGE_SIZES.includes(stored) ? stored : DEFAULT_PAGE_SIZE;
        }
        catch {
            return DEFAULT_PAGE_SIZE;
        }
    });
    const [previousSearch, setPreviousSearch] = useState(() => searchParams.toString());
    // Declared here rather than next to its guard below: the URL-sync block
    // primes it, and a `const` cannot be touched above its own declaration.
    const [selectionFilter, setSelectionFilter] = useState({ searchQuery, filterType, filterFavorites });
    // Navigation replaces the draft and applied filters together.
    const currentSearch = searchParams.toString();
    if (previousSearch !== currentSearch) {
        setPreviousSearch(currentSearch);
        const nextQ = searchParams.get('q') ?? '';
        setSearch(nextQ);
        setSearchQuery(nextQ);
        const nextType = searchParams.get('type') ?? '';
        const nextFavorites = searchParams.get('is_favorite') === 'true';
        setFilterType(nextType);
        setFilterFavorites(nextFavorites);
        setPage(Math.max(1, Number(searchParams.get('page')) || 1));
        // Filters and page arrived together, so this is not a filter *change*.
        // Priming the guard below stops it from throwing away the page the same
        // URL just asked for.
        setSelectionFilter({ searchQuery: nextQ, filterType: nextType, filterFavorites: nextFavorites });
    }
    // Sync states back to URL searchParams
    useEffect(() => {
        const params = new URLSearchParams([
            ['q', searchQuery],
            ['type', filterType],
            ['is_favorite', filterFavorites ? 'true' : ''],
            ['page', page > 1 ? String(page) : ''],
        ].filter(([, v]) => v && v.length));
        window.history.replaceState(null, '', params.size ? `?${params}` : window.location.pathname);
    }, [searchQuery, filterType, filterFavorites, page]);
    useEffect(() => {
        if (debounceRef.current)
            clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setSearchQuery(search);
        }, 300);
        return () => {
            if (debounceRef.current)
                clearTimeout(debounceRef.current);
        };
    }, [search]);
    if (selectionFilter.searchQuery !== searchQuery || selectionFilter.filterType !== filterType || selectionFilter.filterFavorites !== filterFavorites) {
        setSelectionFilter({ searchQuery, filterType, filterFavorites });
        setSelectedIds(new Set());
        setLastSelectedId(null);
        setPage(1);
    }
    useEffect(() => {
        try {
            localStorage.setItem('securo.payees.pageSize', String(pageSize));
        }
        catch {
            // A disabled or full storage must not prevent changing the page size.
        }
    }, [pageSize]);
    useEffect(() => {
        try {
            localStorage.setItem(PAYEE_SORT_STORAGE_KEY, JSON.stringify(sort));
        }
        catch {
            // A disabled or full storage must not prevent sorting the current list.
        }
    }, [sort]);
    // Form state
    const [formName, setFormName] = useState('');
    const [formType, setFormType] = useState('');
    const [formNotes, setFormNotes] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formAddress, setFormAddress] = useState('');
    const [formWebsite, setFormWebsite] = useState('');
    // Documents this payee has, as ordered rows. A list rather than a slot per
    // possible kind: most cadastros need one document, and a column of empty
    // boxes labelled with documents the user has never heard of reads as a
    // form to fill rather than a fact to record.
    const [taxIdRows, setTaxIdRows] = useState([]);
    // Labels, masks and ordering come from the server: the jurisdiction that
    // decides them lives on the workspace, and a second copy of the rule here
    // would drift from it.
    const { data: taxIdMeta } = useQuery({
        queryKey: ['tax-id-kinds'],
        queryFn: fiscalApi.taxIdKinds,
        staleTime: 1000 * 60 * 60,
    });
    const allKinds = taxIdMeta?.kinds ?? [];
    const kindOption = (kind) => allKinds.find((k) => k.kind === kind);
    // What this jurisdiction asks for, in pack order. Drives which document a
    // new row starts on; the picker itself groups every country.
    const localKinds = allKinds.filter((k) => k.offered);
    const usedKinds = new Set(taxIdRows.map((r) => r.kind));
    const { data: payeesList, isLoading } = useQuery({
        queryKey: ['payees', searchQuery, filterType, filterFavorites],
        queryFn: () => payeesApi.list({
            q: searchQuery || undefined,
            type: filterType || undefined,
            is_favorite: filterFavorites || undefined,
        }),
    });
    const createMutation = useMutation({
        mutationFn: (data) => payeesApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payees'] });
            setDialogOpen(false);
            toast.success(t('payees.created'));
        },
        onError: (e) => toast.error(payeeErrorMessage(e, t) ?? t('common.error')),
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }) => payeesApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payees'] });
            setDialogOpen(false);
            setEditingPayee(null);
            toast.success(t('payees.updated'));
        },
        onError: (e) => toast.error(payeeErrorMessage(e, t) ?? t('common.error')),
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => payeesApi.delete(id),
        onSuccess: (_, id) => {
            invalidateFinancialQueries(queryClient);
            queryClient.invalidateQueries({ queryKey: ['payees'] });
            setDialogOpen(false);
            setDeleteDialogOpen(false);
            if (editingPayee?.id === id) {
                setEditingPayee(null);
            }
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            if (summaryPayee === id) {
                setSummaryPayee(null);
            }
            toast.success(t('payees.deleted'));
        },
        onError: () => toast.error(t('common.error')),
    });
    const favoriteMutation = useMutation({
        mutationFn: ({ id, is_favorite }) => payeesApi.update(id, { is_favorite }),
        onMutate: async ({ id, is_favorite }) => {
            // Array-shaped caches only. `['payees']` is a prefix that also matches
            // `['payees', id, 'summary']`, whose data is an object, and mapping over
            // that would throw. Every page that lists payees caches an array under
            // this prefix, so they all stay in step for free.
            const listFilter = {
                queryKey: ['payees'],
                predicate: (query) => Array.isArray(query.state.data),
            };
            await queryClient.cancelQueries(listFilter);
            const snapshots = queryClient.getQueriesData(listFilter);
            queryClient.setQueriesData(listFilter, (old) => old?.map((payee) => (payee.id === id ? { ...payee, is_favorite } : payee)));
            return { snapshots };
        },
        onError: (_error, _variables, context) => {
            for (const [key, data] of context?.snapshots ?? [])
                queryClient.setQueryData(key, data);
            toast.error(t('payees.favoriteError'));
        },
        // Prefix invalidation is safe here: it only marks stale and refetches.
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['payees'] });
        },
    });
    const mergeMutation = useMutation({
        mutationFn: ({ targetId, sourceIds }) => payeesApi.merge(targetId, sourceIds),
        onSuccess: (result, variables) => {
            invalidateFinancialQueries(queryClient);
            queryClient.invalidateQueries({ queryKey: ['payees'] });
            setMergeDialogOpen(false);
            setSelectedIds(new Set());
            setLastSelectedId(null);
            setMergeTargetId('');
            if (summaryPayee && variables.sourceIds.includes(summaryPayee)) {
                setSummaryPayee(null);
            }
            toast.success(t('payees.merged', { count: result.transactions_reassigned }));
        },
        onError: () => toast.error(t('common.error')),
    });
    const bulkDeleteMutation = useMutation({
        mutationFn: (ids) => payeesApi.bulkDelete(ids),
        onSuccess: (result, deletedIds) => {
            invalidateFinancialQueries(queryClient);
            queryClient.invalidateQueries({ queryKey: ['payees'] });
            setDeleteDialogOpen(false);
            setSelectedIds(new Set());
            setLastSelectedId(null);
            if (summaryPayee && deletedIds.includes(summaryPayee)) {
                setSummaryPayee(null);
            }
            toast.success(t('payees.deletedMultiple', { count: result.deleted, defaultValue: `${result.deleted} payees deleted` }));
        },
        onError: () => toast.error(t('common.error')),
    });
    // A workspace that files somewhere gets its primary document ready to type
    // into. A company whose clients are all local should never have to ask for
    // the field it uses every single time.
    //
    // Only when a jurisdiction is set: with none, the only offered kind is the
    // generic one, and a permanently empty "Other document" box is the confusing
    // thing this replaced.
    const seedTaxIdRows = (payee) => {
        const existing = (payee?.tax_ids ?? []).map((t) => ({
            kind: t.kind,
            value: formatTaxId(t.value, kindOption(t.kind)?.mask ?? null),
        }));
        if (existing.length > 0)
            return existing;
        const primary = taxIdMeta?.jurisdiction ? localKinds[0] : undefined;
        return primary ? [{ kind: primary.kind, value: '' }] : [];
    };
    const openCreate = () => {
        setEditingPayee(null);
        setFormName('');
        setFormType('');
        setFormNotes('');
        setFormEmail('');
        setFormPhone('');
        setFormAddress('');
        setFormWebsite('');
        setTaxIdRows(seedTaxIdRows());
        setDialogOpen(true);
    };
    const openEdit = (payee) => {
        setEditingPayee(payee);
        setFormName(payee.name);
        setFormType(payee.type ?? '');
        setFormNotes(payee.notes ?? '');
        setFormEmail(payee.email ?? '');
        setFormPhone(payee.phone ?? '');
        setFormAddress(payee.address ?? '');
        setFormWebsite(payee.website ?? '');
        // Every stored document becomes a row, including kinds this jurisdiction
        // does not ask for: a German VAT number on a Brazilian workspace is a
        // normal state, and hiding it would be worse than showing it.
        setTaxIdRows(seedTaxIdRows(payee));
        setDialogOpen(true);
    };
    const handleSave = () => {
        const payload = {
            name: formName,
            // Empty means the legal nature was not stated, which is a value, not a
            // blank to be coerced into one.
            type: formType || null,
            notes: formNotes || undefined,
            email: formEmail.trim() || null,
            phone: formPhone.trim() || null,
            address: formAddress.trim() || null,
            website: formWebsite.trim() || null,
            // An emptied field means "drop this document", so blanks are sent and
            // the server treats them as removals.
            tax_ids: taxIdRows
                .filter((row) => row.value.trim() !== '')
                .map((row) => ({ kind: row.kind, value: row.value })),
        };
        if (editingPayee) {
            updateMutation.mutate({ id: editingPayee.id, ...payload });
        }
        else {
            createMutation.mutate(payload);
        }
    };
    const sortedPayees = useMemo(() => sortPayees(payeesList ?? [], sort, locale, typeLabels), [payeesList, sort, locale, typeLabels]);
    // Sorting runs first, so paging walks the list the user actually sees.
    const totalPages = Math.max(1, Math.ceil(sortedPayees.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const pageItems = sortedPayees.slice((safePage - 1) * pageSize, safePage * pageSize);
    // Resolved from the full filtered list, not from `pageItems`: the dialog must
    // survive a page change made behind it, and a row deleted elsewhere in the
    // list should close it rather than show a stale name.
    const detailPayee = summaryPayee ? sortedPayees.find(payee => payee.id === summaryPayee) ?? null : null;
    // Deleting the last page's contents strands `page` past the end. `safePage`
    // already covers what renders; this keeps the state and the URL honest.
    // Adjusted during render, like the two guards above, so the URL is written
    // once instead of once per stale value. Gated on the list having arrived:
    // during the first fetch there are no rows, `totalPages` is 1, and clamping
    // then would throw away the page a deep link just asked for.
    if (payeesList && page > totalPages)
        setPage(totalPages);
    const toggleSort = (by) => {
        setSort((current) => {
            if (current.by !== by)
                return { by, direction: INITIAL_SORT_DIRECTIONS[by] };
            return { ...current, direction: current.direction === 'asc' ? 'desc' : 'asc' };
        });
    };
    const toggleSelect = (id, isShiftKey = false) => {
        setSelectedIds(prev => calculateRangeSelection(prev, lastSelectedId, id, pageItems, isShiftKey));
        setLastSelectedId(id);
    };
    const allSelected = pageItems.length > 0 && pageItems.every(payee => selectedIds.has(payee.id));
    const someSelected = pageItems.some(payee => selectedIds.has(payee.id)) && !allSelected;
    const toggleSelectAll = () => {
        if (!pageItems.length)
            return;
        setSelectedIds(prev => {
            const next = new Set(prev);
            // Add or remove only this page: the selection itself spans pages, so
            // clearing it wholesale would silently drop rows picked elsewhere.
            for (const payee of pageItems) {
                if (allSelected)
                    next.delete(payee.id);
                else
                    next.add(payee.id);
            }
            return next;
        });
    };
    return (_jsxs("div", { children: [_jsx(PageHeader, { section: t('payees.section'), title: t('payees.title'), action: canWrite ? (_jsxs("div", { className: "flex w-full flex-wrap items-center gap-2 sm:w-auto", children: [selectedIds.size >= 2 && (_jsxs(_Fragment, { children: [_jsxs(Button, { size: "sm", variant: "outline", className: "h-8 gap-1.5", onClick: () => { setMergeTargetId(''); setMergeDialogOpen(true); }, children: [_jsx(Merge, { size: 13 }), t('payees.merge'), " (", selectedIds.size, ")"] }), _jsxs(Button, { size: "sm", variant: "destructive", className: "h-8 gap-1.5", onClick: () => {
                                        setPayeesToDelete(Array.from(selectedIds));
                                        setDeleteDialogOpen(true);
                                    }, disabled: bulkDeleteMutation.isPending, children: [_jsx(Trash2, { size: 13 }), t('common.delete'), " (", selectedIds.size, ")"] })] })), _jsxs(Button, { size: "sm", className: "h-8 gap-1.5", onClick: openCreate, children: [_jsx(Plus, { size: 13 }), _jsx("span", { children: t('payees.add') })] })] })) : undefined }), _jsxs("div", { className: cn('group/filterbar rounded-xl border border-border bg-card shadow-sm transition-colors mb-4', 'focus-within:border-primary/40 focus-within:ring-[3px] focus-within:ring-primary/10'), children: [_jsxs("div", { className: "flex items-center gap-1.5 px-2 py-1.5", children: [_jsxs("div", { className: "relative flex min-w-0 flex-1 items-center gap-1 px-2.5 py-1 min-h-9", children: [_jsx(Search, { size: 15, className: "pointer-events-none shrink-0 text-muted-foreground/70" }), _jsx("input", { type: "text", placeholder: t('payees.searchPlaceholder'), value: search, onChange: (e) => setSearch(e.target.value), className: "flex-1 bg-transparent px-1.5 text-[13.5px] outline-none placeholder:text-muted-foreground/75" })] }), _jsxs("div", { className: "ml-auto flex shrink-0 items-center gap-1 pl-1", children: [(search || filterType || filterFavorites) && (_jsx("button", { type: "button", onClick: () => {
                                            setSearch('');
                                            setSearchQuery('');
                                            setFilterType('');
                                            setFilterFavorites(false);
                                        }, className: "hidden h-7 items-center rounded-md px-2 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:inline-flex", children: t('transactions.clearFilters') })), _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs("button", { type: "button", className: cn('inline-flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-card px-2.5 text-[12px] font-medium text-muted-foreground transition-colors', 'hover:bg-muted hover:text-foreground', (filterType || filterFavorites) && 'border-primary/30 text-primary hover:text-primary'), children: [_jsx(ListFilter, { size: 13 }), _jsx("span", { children: t('transactions.filtersBar.filters') })] }) }), _jsxs(DropdownMenuContent, { align: "end", className: "w-[200px] p-1 bg-card border border-border rounded-xl shadow-md", children: [_jsx(DropdownMenuLabel, { className: "px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider", children: t('transactions.filtersBar.filterBy') || 'Filter By' }), _jsxs(DropdownMenuSub, { children: [_jsxs(DropdownMenuSubTrigger, { className: "gap-2 rounded-lg px-2 py-1.5 text-xs cursor-pointer hover:bg-muted transition-colors", children: [_jsx(ListFilter, { size: 13, className: "text-muted-foreground shrink-0" }), _jsx("span", { className: "flex-1 text-left", children: t('payees.type') }), filterType && (_jsx("span", { className: "text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium", children: typeLabels[filterType] }))] }), _jsx(DropdownMenuPortal, { children: _jsx(DropdownMenuSubContent, { className: "w-[180px] p-1 bg-card border border-border rounded-xl shadow-md", children: [
                                                                        { value: '', label: t('payees.allTypes', 'All Types') },
                                                                        { value: 'person', label: t('payees.typePerson') },
                                                                        { value: 'company', label: t('payees.typeCompany') },
                                                                    ].map((opt) => (_jsxs(DropdownMenuItem, { onSelect: () => setFilterType(opt.value), className: cn('gap-2 rounded-lg px-2 py-1.5 text-xs cursor-pointer hover:bg-muted transition-colors', filterType === opt.value && 'bg-primary/5 text-primary hover:bg-primary/5'), children: [_jsx("span", { className: "min-w-0 flex-1 truncate text-left", children: opt.label }), filterType === opt.value && (_jsx(Check, { size: 13, className: "text-primary" }))] }, opt.value || 'all'))) }) })] }), _jsxs(DropdownMenuCheckboxItem, { checked: filterFavorites, onCheckedChange: setFilterFavorites, className: "gap-2 rounded-lg px-2 py-1.5 text-xs cursor-pointer hover:bg-muted transition-colors", children: [_jsx(Star, { size: 13, className: cn("mr-1 shrink-0", filterFavorites ? "fill-amber-400 text-amber-400" : "text-muted-foreground") }), _jsx("span", { className: "flex-1 text-left", children: t('payees.favoritesOnly') })] }), (filterType || filterFavorites) && (_jsxs(_Fragment, { children: [_jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { onSelect: () => {
                                                                    setFilterType('');
                                                                    setFilterFavorites(false);
                                                                }, className: "gap-2 rounded-lg px-2 py-1.5 text-xs cursor-pointer hover:bg-muted text-destructive hover:text-destructive focus:text-destructive focus:bg-destructive/5 font-medium", children: [_jsx(X, { size: 13, className: "mr-1 shrink-0" }), _jsx("span", { children: t('transactions.clearFilters') })] })] }))] })] })] })] }), (filterType || filterFavorites) && (_jsxs("div", { className: "flex flex-wrap items-center gap-1.5 border-t border-border/60 px-2 py-1.5", children: [filterType && (_jsxs("button", { type: "button", onClick: () => setFilterType(''), className: "group inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-border/80 bg-muted/50 pl-2 pr-1.5 text-[11.5px] text-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5", children: [_jsx("span", { className: "flex items-center text-muted-foreground group-hover:text-destructive", children: _jsx(ListFilter, { size: 12 }) }), _jsxs("span", { className: "text-muted-foreground", children: [t('payees.type'), ":"] }), _jsx("span", { className: "max-w-[140px] truncate font-medium text-foreground", children: typeLabels[filterType] }), _jsx("span", { className: "ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/70 group-hover:text-destructive", children: _jsx(X, { size: 11 }) })] })), filterFavorites && (_jsxs("button", { type: "button", onClick: () => setFilterFavorites(false), className: "group inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-border/80 bg-muted/50 pl-2 pr-1.5 text-[11.5px] text-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5", children: [_jsx("span", { className: "flex items-center text-amber-400 group-hover:text-destructive", children: _jsx(Star, { size: 12, className: "fill-amber-400" }) }), _jsx("span", { className: "text-muted-foreground", children: t('payees.favoritesOnly') }), _jsx("span", { className: "ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/70 group-hover:text-destructive", children: _jsx(X, { size: 11 }) })] }))] }))] }), _jsx("div", { className: "bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-4", children: isLoading ? (_jsx("div", { className: "p-6 space-y-3", children: Array.from({ length: 5 }).map((_, i) => (_jsx(Skeleton, { className: "h-14 w-full" }, i))) })) : (_jsxs(_Fragment, { children: [_jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { className: "border-b border-border hover:bg-transparent", children: [canWrite && (_jsx(TableHead, { className: "w-[40px] py-3 pl-4 pr-0", children: _jsx("input", { type: "checkbox", checked: allSelected, ref: (el) => { if (el)
                                                        el.indeterminate = someSelected; }, onChange: toggleSelectAll, className: "h-4 w-4 rounded border-border accent-primary cursor-pointer" }) })), _jsx(TableHead, { className: "text-xs font-medium text-muted-foreground py-3 w-[32px]" }), _jsx(TableHead, { "aria-sort": sort.by === 'name' ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined, className: "text-xs font-medium text-muted-foreground py-3 w-full max-w-0", children: _jsxs("button", { type: "button", onClick: () => toggleSort('name'), className: "w-full inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground", children: [t('payees.name'), sort.by === 'name'
                                                            && (sort.direction === 'asc' ? _jsx(ArrowUp, { size: 12, "aria-hidden": "true" }) : _jsx(ArrowDown, { size: 12, "aria-hidden": "true" }))] }) }), _jsx(TableHead, { "aria-sort": sort.by === 'type' ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined, className: "hidden text-left text-xs font-medium text-muted-foreground py-3 md:table-cell w-[120px]", children: _jsxs("button", { type: "button", onClick: () => toggleSort('type'), className: "inline-flex w-full cursor-pointer items-center gap-1 transition-colors hover:text-foreground", children: [t('payees.type'), sort.by === 'type'
                                                            && (sort.direction === 'asc' ? _jsx(ArrowUp, { size: 12, "aria-hidden": "true" }) : _jsx(ArrowDown, { size: 12, "aria-hidden": "true" }))] }) }), _jsx(TableHead, { "aria-sort": sort.by === 'transaction_count' ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined, className: "text-left text-xs font-medium text-muted-foreground py-3 w-[120px]", children: _jsxs("button", { type: "button", onClick: () => toggleSort('transaction_count'), className: "inline-flex w-full cursor-pointer items-center gap-1 transition-colors hover:text-foreground", children: [t('payees.transactionCount'), sort.by === 'transaction_count'
                                                            && (sort.direction === 'asc' ? _jsx(ArrowUp, { size: 12, "aria-hidden": "true" }) : _jsx(ArrowDown, { size: 12, "aria-hidden": "true" }))] }) }), canWrite && _jsx(TableHead, { className: "w-[100px]" })] }) }), _jsxs(TableBody, { children: [pageItems.map((payee) => (_jsxs(TableRow, { className: `cursor-pointer hover:bg-muted border-b border-border last:border-0 ${summaryPayee === payee.id ? 'bg-muted/80 font-medium' : selectedIds.has(payee.id) ? 'bg-primary/5' : ''}`, onClick: () => {
                                                setSummaryPayee(summaryPayee === payee.id ? null : payee.id);
                                            }, children: [canWrite && (_jsx(TableCell, { className: "py-2.5 pl-4 pr-0 w-[40px]", children: _jsx("input", { type: "checkbox", checked: selectedIds.has(payee.id), onChange: () => { }, onClick: (e) => {
                                                            e.stopPropagation();
                                                            toggleSelect(payee.id, e.shiftKey);
                                                        }, className: "h-4 w-4 rounded border-border accent-primary cursor-pointer" }) })), _jsx(TableCell, { className: "py-2.5 w-[32px]", children: canWrite ? (_jsx("button", { onClick: (e) => {
                                                            e.stopPropagation();
                                                            favoriteMutation.mutate({ id: payee.id, is_favorite: !payee.is_favorite });
                                                        }, className: "p-1 rounded hover:bg-accent", title: payee.is_favorite ? t('payees.removeFavorite') : t('payees.addFavorite'), children: _jsx(Star, { size: 14, className: payee.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground' }) })) : (_jsx(Star, { size: 14, className: payee.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground opacity-50' })) }), _jsxs(TableCell, { className: "py-2.5 max-w-0 w-full", children: [_jsx("p", { className: "text-sm font-semibold text-foreground truncate", title: payee.name, children: payee.name }), payee.notes && (_jsx("p", { className: "text-xs text-muted-foreground mt-0.5 truncate", title: payee.notes, children: payee.notes }))] }), _jsx(TableCell, { className: "hidden py-2.5 text-left md:table-cell", children: payee.type && (_jsx("span", { className: "text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full capitalize", children: typeLabels[payee.type] })) }), _jsx(TableCell, { className: "py-2.5 text-left", children: _jsx("span", { className: "text-sm tabular-nums text-muted-foreground", children: payee.transaction_count }) }), canWrite && (_jsx(TableCell, { className: "py-2.5 pr-4 sm:pr-5", children: _jsxs("div", { className: "flex items-center justify-end gap-1", children: [_jsx("button", { className: "p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors", onClick: (e) => { e.stopPropagation(); openEdit(payee); }, title: t('common.edit'), children: _jsx(Pencil, { size: 13 }) }), _jsx("button", { className: "p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-50 transition-colors", onClick: (e) => {
                                                                    e.stopPropagation();
                                                                    setPayeesToDelete([payee.id]);
                                                                    setDeleteDialogOpen(true);
                                                                }, disabled: deleteMutation.isPending || bulkDeleteMutation.isPending, title: t('common.delete'), children: _jsx(Trash2, { size: 13 }) })] }) }))] }, payee.id))), sortedPayees.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: canWrite ? 6 : 4, className: "text-center py-16 text-muted-foreground", children: t('payees.empty') }) }))] })] }), sortedPayees.length > 10 && (_jsxs("div", { className: "px-5 py-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4", children: [totalPages > 1 ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { variant: "outline", size: "sm", disabled: safePage <= 1, onClick: () => setPage(safePage - 1), children: t('common.previous') }), _jsxs("span", { className: "text-sm text-muted-foreground tabular-nums", children: [safePage, " / ", totalPages] }), _jsx(Button, { variant: "outline", size: "sm", disabled: safePage >= totalPages, onClick: () => setPage(safePage + 1), children: t('common.next') })] })) : (_jsx("div", { className: "hidden sm:block" })), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-xs text-muted-foreground", children: t('common.rowsPerPage') }), _jsxs(Select, { value: String(pageSize), onValueChange: (value) => {
                                                setPageSize(Number(value));
                                                setPage(1);
                                            }, children: [_jsx(SelectTrigger, { className: "w-[70px] h-8 text-xs", children: _jsx(SelectValue, { placeholder: pageSize }) }), _jsx(SelectContent, { children: PAGE_SIZES.map((value) => (_jsx(SelectItem, { value: String(value), children: value }, value))) })] })] })] }))] })) }), _jsx(PayeeDetailDialog, { payee: detailPayee, canWrite: canWrite, onOpenChange: (open) => { if (!open)
                    setSummaryPayee(null); }, onEdit: openEdit, onDelete: (payee) => {
                    setPayeesToDelete([payee.id]);
                    setDeleteDialogOpen(true);
                } }), _jsx(Dialog, { open: dialogOpen, onOpenChange: setDialogOpen, children: _jsxs(DialogContent, { className: "sm:max-w-md flex flex-col max-h-[calc(100dvh-2rem)]", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: editingPayee ? t('payees.edit') : t('payees.add') }) }), _jsxs("div", { className: "space-y-4 overflow-y-auto flex-1 -mx-1 px-1", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('payees.name') }), _jsx(Input, { value: formName, onChange: (e) => setFormName(e.target.value), required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('payees.type') }), _jsxs("select", { className: "w-full border border-border rounded-md px-3 py-2 text-sm bg-card focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]", value: formType, onChange: (e) => setFormType(e.target.value), children: [_jsx("option", { value: "", children: t('payees.typeUnset', 'Not specified') }), _jsx("option", { value: "person", children: t('payees.typePerson') }), _jsx("option", { value: "company", children: t('payees.typeCompany') })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('payees.notes') }), _jsx("textarea", { className: "w-full border border-input rounded-md px-3 py-2 text-sm bg-card resize-none focus:outline-none focus:ring-2 focus:ring-ring", rows: 2, value: formNotes, onChange: (e) => setFormNotes(e.target.value) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('payees.email', 'Email') }), _jsx(Input, { type: "email", value: formEmail, onChange: (e) => setFormEmail(e.target.value), placeholder: "fin@cliente.com" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('payees.phone', 'Phone') }), _jsx(Input, { value: formPhone, onChange: (e) => setFormPhone(e.target.value) })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('payees.address', 'Address') }), _jsx(Input, { value: formAddress, onChange: (e) => setFormAddress(e.target.value) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('payees.website', 'Website') }), _jsx(Input, { value: formWebsite, onChange: (e) => setFormWebsite(e.target.value), placeholder: "acme.com" })] }), allKinds.length > 0 && (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('payees.taxIds', 'Tax IDs') }), taxIdRows.length === 0 && (_jsx("p", { className: "text-[11px] text-muted-foreground leading-relaxed", children: t('payees.taxIdsEmpty', 'None yet. Add one if you need it for tax purposes.') })), taxIdRows.map((row, index) => {
                                            const option = kindOption(row.kind);
                                            return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(TaxIdKindPicker, { kinds: allKinds, jurisdictions: taxIdMeta?.jurisdictions ?? [], activeJurisdiction: taxIdMeta?.jurisdiction ?? null, value: row.kind, documentValue: row.value, used: usedKinds, onChange: (kind) => setTaxIdRows((prev) => prev.map((r, i) => i === index
                                                            ? // Re-mask under the new kind: what the user typed
                                                                // for a CNPJ is not formatted like a VAT id.
                                                                { kind, value: applyMask(r.value, kindOption(kind)?.mask ?? null) }
                                                            : r)) }), _jsx(Input, { value: row.value, onChange: (e) => setTaxIdRows((prev) => prev.map((r, i) => i === index
                                                            ? { ...r, value: applyMask(e.target.value, option?.mask ?? null) }
                                                            : r)), placeholder: option?.mask ?? '' }), _jsx(Button, { variant: "ghost", size: "icon", "aria-label": t('common.remove'), onClick: () => setTaxIdRows((prev) => prev.filter((_, i) => i !== index)), children: _jsx(X, { size: 14, className: "text-muted-foreground" }) })] }, index));
                                        }), usedKinds.size < allKinds.length && (_jsxs(Button, { variant: "outline", size: "sm", className: "w-full", onClick: () => {
                                                // Default to the jurisdiction's primary document, which is
                                                // the one the overwhelming majority of rows will use.
                                                const next = localKinds.find((k) => !usedKinds.has(k.kind)) ??
                                                    allKinds.find((k) => !usedKinds.has(k.kind));
                                                if (next)
                                                    setTaxIdRows((prev) => [...prev, { kind: next.kind, value: '' }]);
                                            }, children: [_jsx(Plus, { size: 14, className: "mr-1" }), t('payees.addTaxId', 'Add')] }))] }))] }), _jsxs(DialogFooter, { className: editingPayee ? 'flex justify-between sm:justify-between' : '', children: [editingPayee && (_jsxs(Button, { variant: "destructive", onClick: () => deleteMutation.mutate(editingPayee.id), disabled: deleteMutation.isPending, children: [_jsx(Trash2, { size: 14, className: "mr-1" }), t('common.delete')] })), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "outline", onClick: () => setDialogOpen(false), children: t('common.cancel') }), _jsx(Button, { onClick: handleSave, disabled: !formName.trim() || createMutation.isPending || updateMutation.isPending, children: t('common.save') })] })] })] }) }), _jsx(Dialog, { open: mergeDialogOpen, onOpenChange: setMergeDialogOpen, children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('payees.mergeTitle') }) }), _jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: t('payees.mergeDescription') }), _jsx("div", { className: "space-y-1", children: Array.from(selectedIds).map(id => {
                                        const p = payeesList?.find(x => x.id === id);
                                        return p ? (_jsxs("div", { className: "text-sm py-1 px-2 rounded bg-muted", children: [p.name, " (", p.transaction_count, ")"] }, id)) : null;
                                    }) }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('payees.mergeTarget') }), _jsxs("select", { className: "w-full border border-border rounded-md px-3 py-2 text-sm bg-card focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]", value: mergeTargetId, onChange: (e) => setMergeTargetId(e.target.value), children: [_jsx("option", { value: "", children: t('payees.selectTarget') }), Array.from(selectedIds).map(id => {
                                                    const p = payeesList?.find(x => x.id === id);
                                                    return p ? _jsx("option", { value: id, children: p.name }, id) : null;
                                                })] })] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setMergeDialogOpen(false), children: t('common.cancel') }), _jsx(Button, { disabled: !mergeTargetId || mergeMutation.isPending, onClick: () => {
                                        const sourceIds = Array.from(selectedIds).filter(id => id !== mergeTargetId);
                                        mergeMutation.mutate({ targetId: mergeTargetId, sourceIds });
                                    }, children: t('payees.merge') })] })] }) }), _jsx(Dialog, { open: deleteDialogOpen, onOpenChange: setDeleteDialogOpen, children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: payeesToDelete.length > 1 ? t('payees.deleteMultipleTitle') : t('payees.deleteTitle') }) }), _jsx("div", { className: "space-y-4", children: _jsx("p", { className: "text-sm text-muted-foreground", children: payeesToDelete.length > 1 ? t('payees.deleteMultipleConfirm', { count: payeesToDelete.length }) : t('payees.deleteConfirm') }) }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setDeleteDialogOpen(false), children: t('common.cancel') }), _jsxs(Button, { variant: "destructive", disabled: deleteMutation.isPending || bulkDeleteMutation.isPending, onClick: () => {
                                        if (payeesToDelete.length === 1) {
                                            deleteMutation.mutate(payeesToDelete[0]);
                                        }
                                        else if (payeesToDelete.length > 1) {
                                            bulkDeleteMutation.mutate(payeesToDelete);
                                        }
                                    }, children: [_jsx(Trash2, { size: 14, className: "mr-1" }), t('common.delete')] })] })] }) })] }));
}
