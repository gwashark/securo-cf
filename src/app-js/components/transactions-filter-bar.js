import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useRef, useState } from 'react';
import { getAccountName, sortAccountsByDisplayName } from '../lib/account-utils.js';
import { useTranslation } from 'react-i18next';
import { useDisplayLocale, useDateLocale } from '../hooks/use-display-locale.js';
import { startOfMonth, startOfYear, subDays } from 'date-fns';
import { ArrowUpDown, Calendar as CalendarIcon, Check, ChevronRight, Coins, EyeClosed, ListChecks, ListFilter, Search, Store, Tag, Users, Wallet, X, } from 'lucide-react';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, } from './ui/dropdown-menu.js';
import { Popover, PopoverAnchor, PopoverContent, } from './ui/popover.js';
import { Calendar } from './ui/calendar.js';
import { Button } from './ui/button.js';
import { cn } from '../lib/utils.js';
import { localDateString } from '../lib/date-utils.js';
import { formatDateRange } from '../lib/date-range-format.js';
import { resolveDateFnsLocale } from '../lib/date-fns-locale.js';
import { CategoryFilterContent } from './category-filter-content.js';
import { MobileTransactionsFilterMenu, } from './mobile-transactions-filter-menu.js';
function toggleInArray(arr, id) {
    return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
}
export function TransactionsFilterBar({ searchInput, onSearchChange, onSearchSubmit, filterAccountIds, onAccountIdsChange, accountSelectionMode = 'multiple', filterCategoryIds, onCategoryIdsChange, filterUncategorized, onUncategorizedChange, filterPayee, onPayeeChange, filterGroupId, onGroupIdChange, filterType, onTypeChange, filterStatus, onStatusChange, hideIgnored, onHideIgnoredChange, filterFrom, filterTo, onDateRangeChange, filterMinAmount, filterMaxAmount, onAmountRangeChange, onClearAll, accounts, categories, referenceCategories, categoryGroups, payees, groups, }) {
    const { t, i18n } = useTranslation();
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const dateFnsLocale = resolveDateFnsLocale(i18n.resolvedLanguage ?? i18n.language);
    const [menuOpen, setMenuOpen] = useState(false);
    const [accountSubOpen, setAccountSubOpen] = useState(false);
    const [categorySubOpen, setCategorySubOpen] = useState(false);
    const keepAccountSubOpenRef = useRef(false);
    const keepCategorySubOpenRef = useRef(false);
    const [dateCustomOpen, setDateCustomOpen] = useState(false);
    const [draftFrom, setDraftFrom] = useState(filterFrom);
    const [draftTo, setDraftTo] = useState(filterTo);
    const [amountSubOpen, setAmountSubOpen] = useState(false);
    const [draftMinAmount, setDraftMinAmount] = useState(filterMinAmount);
    const [draftMaxAmount, setDraftMaxAmount] = useState(filterMaxAmount);
    const [mobileFilterView, setMobileFilterView] = useState('root');
    const searchRef = useRef(null);
    const sortedAccounts = useMemo(() => sortAccountsByDisplayName(accounts), [accounts]);
    // When a CheckRow is clicked inside a submenu, Radix tries to close the submenu
    // even if we preventDefault in onSelect. We intercept the close request so the
    // submenu stays open and users can toggle several rows in a row.
    const handleAccountSubOpenChange = (open) => {
        if (!open && keepAccountSubOpenRef.current) {
            keepAccountSubOpenRef.current = false;
            return;
        }
        setAccountSubOpen(open);
    };
    const handleCategorySubOpenChange = (open) => {
        if (!open && keepCategorySubOpenRef.current) {
            keepCategorySubOpenRef.current = false;
            return;
        }
        setCategorySubOpen(open);
    };
    // When the root menu closes, make sure submenus close too so a fresh open starts clean.
    const handleMenuOpenChange = (open) => {
        setMenuOpen(open);
        if (!open) {
            setAccountSubOpen(false);
            setCategorySubOpen(false);
            setAmountSubOpen(false);
            setMobileFilterView('root');
            keepAccountSubOpenRef.current = false;
            keepCategorySubOpenRef.current = false;
        }
    };
    const accountById = useMemo(() => {
        const map = new Map();
        accounts.forEach((a) => map.set(a.id, a));
        return map;
    }, [accounts]);
    const categoryById = useMemo(() => {
        const map = new Map();
        categories.forEach((c) => map.set(c.id, c));
        referenceCategories?.forEach((c) => map.set(c.id, c));
        return map;
    }, [categories, referenceCategories]);
    const selectedPayee = useMemo(() => payees.find((p) => p.id === filterPayee), [payees, filterPayee]);
    const selectedGroup = useMemo(() => groups.find((g) => g.id === filterGroupId), [groups, filterGroupId]);
    const hasAnyFilter = filterAccountIds.length > 0 ||
        filterCategoryIds.length > 0 ||
        filterUncategorized ||
        !!filterPayee ||
        !!filterGroupId ||
        !!filterType ||
        !!filterStatus ||
        hideIgnored ||
        !!filterFrom ||
        !!filterTo ||
        !!filterMinAmount ||
        !!filterMaxAmount ||
        searchInput.trim().length > 0;
    const typeLabel = filterType === 'credit'
        ? t('transactions.income')
        : filterType === 'debit'
            ? t('transactions.expense')
            : filterType === 'transfer'
                ? t('transactions.transfer')
                : '';
    const statusLabel = filterStatus === 'pending'
        ? t('transactions.statusPending')
        : filterStatus === 'posted'
            ? t('transactions.statusPosted')
            : '';
    const dateLabel = useMemo(() => {
        if (!filterFrom && !filterTo)
            return null;
        return formatDateRange(filterFrom, filterTo, dateLocale, { compact: true });
    }, [filterFrom, filterTo, dateLocale]);
    const amountLabel = useMemo(() => {
        if (!filterMinAmount && !filterMaxAmount)
            return null;
        const fmt = (raw) => {
            const n = Number(raw);
            if (!Number.isFinite(n))
                return raw;
            return n.toLocaleString(locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
        };
        if (filterMinAmount && filterMaxAmount) {
            if (filterMinAmount === filterMaxAmount)
                return `= ${fmt(filterMinAmount)}`;
            return `${fmt(filterMinAmount)} — ${fmt(filterMaxAmount)}`;
        }
        if (filterMinAmount)
            return `≥ ${fmt(filterMinAmount)}`;
        return `≤ ${fmt(filterMaxAmount)}`;
    }, [filterMinAmount, filterMaxAmount, locale]);
    const applyAmountRange = () => {
        const normalize = (raw) => raw.trim().replace(',', '.');
        const min = normalize(draftMinAmount);
        const max = normalize(draftMaxAmount);
        const minOk = min === '' || (Number.isFinite(Number(min)) && Number(min) >= 0);
        const maxOk = max === '' || (Number.isFinite(Number(max)) && Number(max) >= 0);
        if (!minOk || !maxOk)
            return;
        // Swap if user inverted the range so the filter still makes sense.
        if (min && max && Number(min) > Number(max)) {
            onAmountRangeChange(max, min);
        }
        else {
            onAmountRangeChange(min, max);
        }
        setAmountSubOpen(false);
        setMenuOpen(false);
    };
    const handleAmountSubOpenChange = (open) => {
        if (open) {
            setDraftMinAmount(filterMinAmount);
            setDraftMaxAmount(filterMaxAmount);
        }
        setAmountSubOpen(open);
    };
    const datePresets = useMemo(() => {
        const today = new Date();
        return [
            {
                key: 'today',
                label: t('transactions.filtersBar.datePresets.today'),
                from: localDateString(today),
                to: localDateString(today),
            },
            {
                key: 'last7',
                label: t('transactions.filtersBar.datePresets.last7'),
                from: localDateString(subDays(today, 6)),
                to: localDateString(today),
            },
            {
                key: 'last30',
                label: t('transactions.filtersBar.datePresets.last30'),
                from: localDateString(subDays(today, 29)),
                to: localDateString(today),
            },
            {
                key: 'thisMonth',
                label: t('transactions.filtersBar.datePresets.thisMonth'),
                from: localDateString(startOfMonth(today)),
                to: localDateString(today),
            },
            {
                key: 'last90',
                label: t('transactions.filtersBar.datePresets.last90'),
                from: localDateString(subDays(today, 89)),
                to: localDateString(today),
            },
            {
                key: 'thisYear',
                label: t('transactions.filtersBar.datePresets.thisYear'),
                from: localDateString(startOfYear(today)),
                to: localDateString(today),
            },
        ];
    }, [t]);
    const openCustomRange = () => {
        setDraftFrom(filterFrom);
        setDraftTo(filterTo);
        setMenuOpen(false);
        // Wait for the dropdown to finish closing before showing the popover
        // so focus and portal state settle correctly.
        setTimeout(() => setDateCustomOpen(true), 80);
    };
    const accountSummary = filterAccountIds.length > 1
        ? t('transactions.filtersBar.nSelected', { count: filterAccountIds.length })
        : filterAccountIds.length === 1
            ? (getAccountName(accountById.get(filterAccountIds[0]) ?? { name: '', display_name: null }))
            : '';
    const categorySummary = (() => {
        const total = filterCategoryIds.length + (filterUncategorized ? 1 : 0);
        if (total > 1)
            return t('transactions.filtersBar.nSelected', { count: total });
        if (filterUncategorized)
            return t('transactions.uncategorized');
        if (filterCategoryIds.length === 1)
            return categoryById.get(filterCategoryIds[0])?.name ?? '';
        return '';
    })();
    return (_jsx("div", { className: "mb-4", children: _jsxs(Popover, { open: dateCustomOpen, onOpenChange: setDateCustomOpen, modal: true, children: [_jsx(PopoverAnchor, { asChild: true, children: _jsxs("div", { className: cn('group/filterbar rounded-xl border border-border bg-card shadow-sm transition-colors', 'focus-within:border-primary/40 focus-within:ring-[3px] focus-within:ring-primary/10'), children: [_jsxs("div", { className: "flex items-center gap-1.5 px-2 py-1.5", children: [_jsx(SearchWithTagChips, { inputRef: searchRef, value: searchInput, placeholder: t('transactions.searchPlaceholder'), onChange: onSearchChange, onSubmit: onSearchSubmit }), _jsxs("div", { className: "ml-auto flex shrink-0 items-center gap-1 pl-1", children: [hasAnyFilter && (_jsx("button", { type: "button", onClick: onClearAll, className: "hidden h-7 items-center rounded-md px-2 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:inline-flex", children: t('transactions.clearFilters') })), _jsxs(DropdownMenu, { open: menuOpen, onOpenChange: handleMenuOpenChange, children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs("button", { type: "button", "aria-label": t('transactions.filtersBar.filters'), className: cn('inline-flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-card px-2.5 text-[12px] font-medium text-muted-foreground transition-colors', 'hover:bg-muted hover:text-foreground', menuOpen && 'bg-muted text-foreground', hasAnyFilter && 'border-primary/30 text-primary hover:text-primary'), children: [_jsx(ListFilter, { size: 13 }), _jsx("span", { className: "hidden sm:inline", children: t('transactions.filtersBar.filters') })] }) }), _jsxs(DropdownMenuContent, { align: "end", sideOffset: 6, className: "w-[min(18rem,calc(100vw-2rem))] p-1 sm:w-[240px]", children: [_jsx(MobileTransactionsFilterMenu, { view: mobileFilterView, setView: setMobileFilterView, setMenuOpen: setMenuOpen, accounts: sortedAccounts, categories: categories, categoryGroups: categoryGroups, payees: payees, groups: groups, accountIds: filterAccountIds, categoryIds: filterCategoryIds, uncategorized: filterUncategorized, payeeId: filterPayee, groupId: filterGroupId, type: filterType, from: filterFrom, to: filterTo, minAmount: draftMinAmount, maxAmount: draftMaxAmount, appliedMinAmount: filterMinAmount, appliedMaxAmount: filterMaxAmount, setMinAmount: setDraftMinAmount, setMaxAmount: setDraftMaxAmount, summaries: {
                                                                    account: accountSummary,
                                                                    category: categorySummary,
                                                                    payee: selectedPayee?.name,
                                                                    group: selectedGroup?.name,
                                                                    type: typeLabel,
                                                                    status: statusLabel,
                                                                    ignored: hideIgnored ? t('transactions.ignoredHide') : undefined,
                                                                    date: dateLabel,
                                                                    amount: amountLabel,
                                                                }, datePresets: datePresets, hasAnyFilter: hasAnyFilter, onAccountIdsChange: onAccountIdsChange, onCategoryIdsChange: onCategoryIdsChange, onUncategorizedChange: onUncategorizedChange, onPayeeChange: onPayeeChange, onGroupIdChange: onGroupIdChange, onTypeChange: onTypeChange, status: filterStatus, onStatusChange: onStatusChange, hideIgnored: hideIgnored, onHideIgnoredChange: onHideIgnoredChange, onDateRangeChange: onDateRangeChange, onAmountRangeChange: onAmountRangeChange, onApplyAmountRange: applyAmountRange, onOpenCustomRange: openCustomRange, onClearAll: onClearAll }), _jsxs("div", { className: "hidden sm:block", children: [_jsx(DropdownMenuLabel, { className: "px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70", children: t('transactions.filtersBar.filterBy') }), _jsxs(DropdownMenuGroup, { children: [_jsxs(DropdownMenuSub, { open: accountSubOpen, onOpenChange: handleAccountSubOpenChange, children: [_jsxs(DropdownMenuSubTrigger, { className: "gap-2 text-[13px]", children: [_jsx(Wallet, { size: 14, className: "text-muted-foreground" }), _jsx("span", { className: "flex-1", children: t('transactions.account') }), accountSummary && (_jsx("span", { className: "max-w-[90px] truncate text-[11px] text-muted-foreground", children: accountSummary }))] }), _jsx(DropdownMenuPortal, { children: _jsxs(DropdownMenuSubContent, { sideOffset: 8, className: "max-h-[320px] w-[240px] overflow-y-auto p-1", children: [accountSelectionMode === 'single' && (_jsxs(_Fragment, { children: [_jsxs(DropdownMenuItem, { onSelect: () => {
                                                                                                                onAccountIdsChange([]);
                                                                                                            }, className: cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', filterAccountIds.length === 0 && 'bg-primary/5'), children: [_jsx("span", { className: "min-w-0 flex-1 truncate text-left", children: t('transactions.all') }), filterAccountIds.length === 0 && _jsx(Check, { size: 13, className: "text-primary" })] }), _jsx("div", { className: "my-1 h-px bg-border/60" })] })), sortedAccounts.length === 0 ? (_jsx("div", { className: "px-2 py-3 text-center text-[12px] text-muted-foreground", children: t('transactions.filtersBar.noOptions') })) : accountSelectionMode === 'single' ? (sortedAccounts.map((a) => {
                                                                                                    const checked = filterAccountIds[0] === a.id;
                                                                                                    return (_jsxs(DropdownMenuItem, { onSelect: () => {
                                                                                                            onAccountIdsChange(checked ? [] : [a.id]);
                                                                                                        }, className: cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', checked && 'bg-primary/5'), children: [_jsx("span", { className: "min-w-0 flex-1 truncate text-left", children: getAccountName(a) }), a.currency && (_jsx("span", { className: "text-[10.5px] uppercase tracking-wide text-muted-foreground/70", children: a.currency })), checked && _jsx(Check, { size: 13, className: "text-primary" })] }, a.id));
                                                                                                })) : (sortedAccounts.map((a) => (_jsxs(DropdownMenuCheckboxItem, { checked: filterAccountIds.includes(a.id), onSelect: (e) => {
                                                                                                        e.preventDefault();
                                                                                                        keepAccountSubOpenRef.current = true;
                                                                                                        onAccountIdsChange(toggleInArray(filterAccountIds, a.id));
                                                                                                    }, className: "gap-2 rounded-sm py-1.5 text-[13px]", children: [_jsx("span", { className: "min-w-0 flex-1 truncate text-left", children: getAccountName(a) }), a.currency && (_jsx("span", { className: "text-[10.5px] uppercase tracking-wide text-muted-foreground/70", children: a.currency }))] }, a.id)))), accountSelectionMode === 'multiple' && filterAccountIds.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { className: "my-1 h-px bg-border/60" }), _jsxs(DropdownMenuItem, { onSelect: (e) => {
                                                                                                                e.preventDefault();
                                                                                                                keepAccountSubOpenRef.current = true;
                                                                                                                onAccountIdsChange([]);
                                                                                                            }, className: "gap-2 rounded-sm px-2 py-1.5 text-[12px] text-muted-foreground", children: [_jsx(X, { size: 12 }), t('transactions.filtersBar.clearSelection')] })] }))] }) })] }), _jsxs(DropdownMenuSub, { open: categorySubOpen, onOpenChange: handleCategorySubOpenChange, children: [_jsxs(DropdownMenuSubTrigger, { className: "gap-2 text-[13px]", children: [_jsx(Tag, { size: 14, className: "text-muted-foreground" }), _jsx("span", { className: "flex-1", children: t('transactions.category') }), categorySummary && (_jsx("span", { className: "max-w-[90px] truncate text-[11px] text-muted-foreground", children: categorySummary }))] }), _jsx(DropdownMenuPortal, { children: _jsx(DropdownMenuSubContent, { sideOffset: 8, className: "max-h-[320px] w-[240px] overflow-y-auto p-1", children: _jsx(CategoryFilterContent, { categoryIds: filterCategoryIds, onCategoryIdsChange: onCategoryIdsChange, filterUncategorized: filterUncategorized, onUncategorizedChange: onUncategorizedChange, categories: categories, groups: categoryGroups, onKeepOpen: () => { keepCategorySubOpenRef.current = true; } }) }) })] }), _jsxs(DropdownMenuSub, { children: [_jsxs(DropdownMenuSubTrigger, { className: "gap-2 text-[13px]", children: [_jsx(Store, { size: 14, className: "text-muted-foreground" }), _jsx("span", { className: "flex-1", children: t('payees.payee') }), selectedPayee && (_jsx("span", { className: "max-w-[90px] truncate text-[11px] text-muted-foreground", children: selectedPayee.name }))] }), _jsx(DropdownMenuPortal, { children: _jsxs(DropdownMenuSubContent, { sideOffset: 8, className: "max-h-[320px] w-[240px] overflow-y-auto p-1", children: [_jsxs(DropdownMenuItem, { onSelect: () => onPayeeChange(''), className: cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', !filterPayee && 'bg-primary/5'), children: [_jsx("span", { className: "size-2.5 shrink-0" }), _jsx("span", { className: "min-w-0 flex-1 truncate text-left", children: t('transactions.all') }), !filterPayee && _jsx(Check, { size: 13, className: "text-primary" })] }), _jsx("div", { className: "my-1 h-px bg-border/60" }), payees.length === 0 ? (_jsx("div", { className: "px-2 py-3 text-center text-[12px] text-muted-foreground", children: t('transactions.filtersBar.noOptions') })) : (payees.map((p) => (_jsxs(DropdownMenuItem, { onSelect: () => onPayeeChange(p.id), className: cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', filterPayee === p.id && 'bg-primary/5'), children: [_jsx("span", { className: "size-2.5 shrink-0" }), _jsx("span", { className: "min-w-0 flex-1 truncate text-left", children: p.name }), filterPayee === p.id && (_jsx(Check, { size: 13, className: "text-primary" }))] }, p.id))))] }) })] }), _jsxs(DropdownMenuSub, { children: [_jsxs(DropdownMenuSubTrigger, { className: "gap-2 text-[13px]", children: [_jsx(Users, { size: 14, className: "text-muted-foreground" }), _jsx("span", { className: "flex-1", children: t('splitGroups.group') }), selectedGroup && (_jsx("span", { className: "max-w-[90px] truncate text-[11px] text-muted-foreground", children: selectedGroup.name }))] }), _jsx(DropdownMenuPortal, { children: _jsxs(DropdownMenuSubContent, { sideOffset: 8, className: "max-h-[320px] w-[240px] overflow-y-auto p-1", children: [_jsxs(DropdownMenuItem, { onSelect: () => onGroupIdChange(''), className: cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', !filterGroupId && 'bg-primary/5'), children: [_jsx("span", { className: "size-2.5 shrink-0" }), _jsx("span", { className: "min-w-0 flex-1 truncate text-left", children: t('transactions.all') }), !filterGroupId && _jsx(Check, { size: 13, className: "text-primary" })] }), _jsx("div", { className: "my-1 h-px bg-border/60" }), groups.length === 0 ? (_jsx("div", { className: "px-2 py-3 text-center text-[12px] text-muted-foreground", children: t('transactions.filtersBar.noOptions') })) : (groups.map((g) => (_jsxs(DropdownMenuItem, { onSelect: () => onGroupIdChange(g.id), className: cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', filterGroupId === g.id && 'bg-primary/5'), children: [_jsx("span", { className: "size-2.5 shrink-0" }), _jsx("span", { className: "min-w-0 flex-1 truncate text-left", children: g.name }), filterGroupId === g.id && (_jsx(Check, { size: 13, className: "text-primary" }))] }, g.id))))] }) })] }), _jsxs(DropdownMenuSub, { children: [_jsxs(DropdownMenuSubTrigger, { className: "gap-2 text-[13px]", children: [_jsx(ArrowUpDown, { size: 14, className: "text-muted-foreground" }), _jsx("span", { className: "flex-1", children: t('transactions.type') }), typeLabel && (_jsx("span", { className: "max-w-[90px] truncate text-[11px] text-muted-foreground", children: typeLabel }))] }), _jsx(DropdownMenuPortal, { children: _jsx(DropdownMenuSubContent, { sideOffset: 8, className: "w-[200px] p-1", children: [
                                                                                                { value: '', label: t('transactions.all') },
                                                                                                { value: 'credit', label: t('transactions.income') },
                                                                                                { value: 'debit', label: t('transactions.expense') },
                                                                                                { value: 'transfer', label: t('transactions.transfer') },
                                                                                            ].map((opt) => (_jsxs(DropdownMenuItem, { onSelect: () => onTypeChange(opt.value), className: cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', filterType === opt.value && 'bg-primary/5'), children: [_jsx("span", { className: "size-2.5 shrink-0" }), _jsx("span", { className: "min-w-0 flex-1 truncate text-left", children: opt.label }), filterType === opt.value && (_jsx(Check, { size: 13, className: "text-primary" }))] }, opt.value || 'all'))) }) })] }), _jsxs(DropdownMenuSub, { children: [_jsxs(DropdownMenuSubTrigger, { className: "gap-2 text-[13px]", children: [_jsx(ListChecks, { size: 14, className: "text-muted-foreground" }), _jsx("span", { className: "flex-1", children: t('transactions.status') }), statusLabel && (_jsx("span", { className: "max-w-[90px] truncate text-[11px] text-muted-foreground", children: statusLabel }))] }), _jsx(DropdownMenuPortal, { children: _jsx(DropdownMenuSubContent, { sideOffset: 8, className: "w-[200px] p-1", children: [
                                                                                                { value: '', label: t('transactions.all') },
                                                                                                { value: 'pending', label: t('transactions.statusPending') },
                                                                                                { value: 'posted', label: t('transactions.statusPosted') },
                                                                                            ].map((opt) => (_jsxs(DropdownMenuItem, { onSelect: () => onStatusChange(opt.value), className: cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', filterStatus === opt.value && 'bg-primary/5'), children: [_jsx("span", { className: "size-2.5 shrink-0" }), _jsx("span", { className: "min-w-0 flex-1 truncate text-left", children: opt.label }), filterStatus === opt.value && (_jsx(Check, { size: 13, className: "text-primary" }))] }, opt.value || 'all'))) }) })] }), _jsxs(DropdownMenuItem, { onSelect: (e) => {
                                                                                    e.preventDefault();
                                                                                    onHideIgnoredChange(!hideIgnored);
                                                                                }, className: "gap-2 text-[13px]", children: [_jsx(EyeClosed, { size: 14, className: "text-muted-foreground" }), _jsx("span", { className: "flex-1", children: t('transactions.hideIgnored') }), hideIgnored && _jsx(Check, { size: 13, className: "text-primary" })] }), _jsxs(DropdownMenuSub, { children: [_jsxs(DropdownMenuSubTrigger, { className: "gap-2 text-[13px]", children: [_jsx(CalendarIcon, { size: 14, className: "text-muted-foreground" }), _jsx("span", { className: "flex-1", children: t('transactions.filtersBar.date') }), dateLabel && (_jsx("span", { className: "max-w-[90px] truncate text-[11px] text-muted-foreground", children: dateLabel }))] }), _jsx(DropdownMenuPortal, { children: _jsxs(DropdownMenuSubContent, { sideOffset: 8, className: "w-[220px] p-1", children: [_jsxs(DropdownMenuItem, { onSelect: () => onDateRangeChange('', ''), className: cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', !filterFrom && !filterTo && 'bg-primary/5'), children: [_jsx("span", { className: "size-2.5 shrink-0" }), _jsx("span", { className: "min-w-0 flex-1 truncate text-left", children: t('transactions.all') }), !filterFrom && !filterTo && (_jsx(Check, { size: 13, className: "text-primary" }))] }), _jsx("div", { className: "my-1 h-px bg-border/60" }), datePresets.map((preset) => {
                                                                                                    const active = filterFrom === preset.from && filterTo === preset.to;
                                                                                                    return (_jsxs(DropdownMenuItem, { onSelect: () => onDateRangeChange(preset.from, preset.to), className: cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', active && 'bg-primary/5'), children: [_jsx("span", { className: "size-2.5 shrink-0" }), _jsx("span", { className: "min-w-0 flex-1 truncate text-left", children: preset.label }), active && _jsx(Check, { size: 13, className: "text-primary" })] }, preset.key));
                                                                                                }), _jsx("div", { className: "my-1 h-px bg-border/60" }), _jsxs(DropdownMenuItem, { onSelect: openCustomRange, className: "justify-between rounded-sm px-2 py-1.5 text-[13px]", children: [_jsx("span", { children: t('transactions.filtersBar.customRange') }), _jsx(ChevronRight, { size: 13, className: "text-muted-foreground/60" })] })] }) })] }), _jsxs(DropdownMenuSub, { open: amountSubOpen, onOpenChange: handleAmountSubOpenChange, children: [_jsxs(DropdownMenuSubTrigger, { className: "gap-2 text-[13px]", children: [_jsx(Coins, { size: 14, className: "text-muted-foreground" }), _jsx("span", { className: "flex-1", children: t('transactions.filtersBar.amount') }), amountLabel && (_jsx("span", { className: "max-w-[90px] truncate text-[11px] text-muted-foreground", children: amountLabel }))] }), _jsx(DropdownMenuPortal, { children: _jsxs(DropdownMenuSubContent, { sideOffset: 8, className: "w-[260px] p-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("div", { className: "flex-1", children: [_jsx("label", { className: "block px-1 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80", children: t('transactions.filtersBar.amountMinLabel') }), _jsx("input", { type: "number", inputMode: "decimal", min: 0, step: "0.01", placeholder: "0.00", value: draftMinAmount, onChange: (e) => setDraftMinAmount(e.target.value), onKeyDown: (e) => {
                                                                                                                        if (e.key === 'Enter') {
                                                                                                                            e.preventDefault();
                                                                                                                            applyAmountRange();
                                                                                                                        }
                                                                                                                    }, className: "h-8 w-full rounded-md border border-border bg-card px-2 text-[13px] outline-none focus:border-primary/60 focus:ring-[2px] focus:ring-primary/15" })] }), _jsxs("div", { className: "flex-1", children: [_jsx("label", { className: "block px-1 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80", children: t('transactions.filtersBar.amountMaxLabel') }), _jsx("input", { type: "number", inputMode: "decimal", min: 0, step: "0.01", placeholder: "0.00", value: draftMaxAmount, onChange: (e) => setDraftMaxAmount(e.target.value), onKeyDown: (e) => {
                                                                                                                        if (e.key === 'Enter') {
                                                                                                                            e.preventDefault();
                                                                                                                            applyAmountRange();
                                                                                                                        }
                                                                                                                    }, className: "h-8 w-full rounded-md border border-border bg-card px-2 text-[13px] outline-none focus:border-primary/60 focus:ring-[2px] focus:ring-primary/15" })] })] }), _jsx("p", { className: "mt-2 text-[10.5px] leading-snug text-muted-foreground/80", children: t('transactions.filtersBar.amountHint') }), _jsxs("div", { className: "mt-2 flex items-center justify-between gap-2", children: [_jsx("button", { type: "button", onClick: () => {
                                                                                                                setDraftMinAmount('');
                                                                                                                setDraftMaxAmount('');
                                                                                                                onAmountRangeChange('', '');
                                                                                                                setAmountSubOpen(false);
                                                                                                                setMenuOpen(false);
                                                                                                            }, className: "text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground", children: t('transactions.filtersBar.reset') }), _jsx(Button, { type: "button", size: "sm", disabled: !draftMinAmount && !draftMaxAmount, onClick: applyAmountRange, children: t('transactions.filtersBar.apply') })] })] }) })] })] }), hasAnyFilter && (_jsxs(_Fragment, { children: [_jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { onSelect: () => {
                                                                                    onClearAll();
                                                                                    setMenuOpen(false);
                                                                                }, className: "gap-2 rounded-sm px-2 py-1.5 text-[12.5px] text-muted-foreground", children: [_jsx(X, { size: 13 }), t('transactions.clearFilters')] })] }))] })] })] })] })] }), (filterAccountIds.length > 0 ||
                                filterCategoryIds.length > 0 ||
                                filterUncategorized ||
                                !!selectedPayee ||
                                !!typeLabel ||
                                !!statusLabel ||
                                !!dateLabel ||
                                !!amountLabel) && (_jsxs("div", { className: "flex flex-wrap items-center gap-1 border-t border-border/60 px-2 py-1.5", children: [filterAccountIds.map((id) => {
                                        const account = accountById.get(id);
                                        if (!account)
                                            return null;
                                        return (_jsx(FilterChip, { icon: _jsx(Wallet, { size: 12 }), label: t('transactions.account'), value: getAccountName(account), onRemove: () => onAccountIdsChange(filterAccountIds.filter((x) => x !== id)) }, `acc-${id}`));
                                    }), filterCategoryIds.map((id) => {
                                        const cat = categoryById.get(id);
                                        if (!cat)
                                            return null;
                                        return (_jsx(FilterChip, { icon: _jsx(Tag, { size: 12 }), label: t('transactions.category'), value: cat.name, tint: cat.color ?? undefined, onRemove: () => onCategoryIdsChange(filterCategoryIds.filter((x) => x !== id)) }, `cat-${id}`));
                                    }), filterUncategorized && (_jsx(FilterChip, { icon: _jsx(Tag, { size: 12 }), label: t('transactions.category'), value: t('transactions.uncategorized'), onRemove: () => onUncategorizedChange(false) })), selectedPayee && (_jsx(FilterChip, { icon: _jsx(Store, { size: 12 }), label: t('payees.payee'), value: selectedPayee.name, onRemove: () => onPayeeChange('') })), typeLabel && (_jsx(FilterChip, { icon: _jsx(ArrowUpDown, { size: 12 }), label: t('transactions.type'), value: typeLabel, onRemove: () => onTypeChange('') })), statusLabel && (_jsx(FilterChip, { icon: _jsx(ListChecks, { size: 12 }), label: t('transactions.status'), value: statusLabel, onRemove: () => onStatusChange('') })), hideIgnored && (_jsx(FilterChip, { icon: _jsx(EyeClosed, { size: 12 }), label: t('transactions.hideIgnored'), value: t('transactions.ignoredHiddenValue'), onRemove: () => onHideIgnoredChange(false) })), dateLabel && (_jsx(FilterChip, { icon: _jsx(CalendarIcon, { size: 12 }), label: t('transactions.filtersBar.date'), value: dateLabel, onRemove: () => onDateRangeChange('', '') })), amountLabel && (_jsx(FilterChip, { icon: _jsx(Coins, { size: 12 }), label: t('transactions.filtersBar.amount'), value: amountLabel, onRemove: () => onAmountRangeChange('', '') }))] }))] }) }), _jsxs(PopoverContent, { align: "end", sideOffset: 8, className: "w-auto p-0", onOpenAutoFocus: (e) => e.preventDefault(), children: [_jsxs("div", { className: "border-b border-border/70 px-4 py-3", children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground", children: t('transactions.filtersBar.customRange') }), _jsx("p", { className: "mt-0.5 text-[11px] text-muted-foreground/70", children: draftFrom || draftTo
                                        ? formatDateRange(draftFrom, draftTo, dateLocale)
                                        : t('transactions.filtersBar.pickRange') })] }), _jsxs("div", { className: "flex flex-col gap-4 p-3 sm:flex-row sm:gap-0", children: [_jsxs("div", { className: "sm:border-r sm:border-border/60 sm:pr-2", children: [_jsx("p", { className: "px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80", children: t('transactions.filtersBar.fromLabel') }), _jsx(Calendar, { selected: draftFrom ? new Date(draftFrom + 'T00:00:00') : undefined, defaultMonth: draftFrom ? new Date(draftFrom + 'T00:00:00') : new Date(), locale: dateFnsLocale, onSelect: (d) => setDraftFrom(d ? localDateString(d) : '') })] }), _jsxs("div", { className: "sm:pl-2", children: [_jsx("p", { className: "px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80", children: t('transactions.filtersBar.toLabel') }), _jsx(Calendar, { selected: draftTo ? new Date(draftTo + 'T00:00:00') : undefined, defaultMonth: draftTo
                                                ? new Date(draftTo + 'T00:00:00')
                                                : draftFrom
                                                    ? new Date(draftFrom + 'T00:00:00')
                                                    : new Date(), locale: dateFnsLocale, onSelect: (d) => setDraftTo(d ? localDateString(d) : '') })] })] }), _jsxs("div", { className: "flex items-center justify-between gap-2 border-t border-border/70 px-3 py-2", children: [_jsx("button", { type: "button", onClick: () => {
                                        setDraftFrom('');
                                        setDraftTo('');
                                    }, className: "text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground", children: t('transactions.filtersBar.reset') }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: () => setDateCustomOpen(false), children: t('transactions.filtersBar.cancel') }), _jsx(Button, { type: "button", size: "sm", disabled: !draftFrom && !draftTo, onClick: () => {
                                                // Normalize: if user only picked one of the two, mirror it.
                                                const from = draftFrom || draftTo;
                                                const to = draftTo || draftFrom;
                                                if (from && to && from > to) {
                                                    onDateRangeChange(to, from);
                                                }
                                                else {
                                                    onDateRangeChange(from, to);
                                                }
                                                setDateCustomOpen(false);
                                            }, children: t('transactions.filtersBar.apply') })] })] })] })] }) }));
}
function FilterChip({ icon, label, value, tint, onRemove }) {
    return (_jsxs("button", { type: "button", onClick: onRemove, className: "group inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-border/80 bg-muted/50 pl-2 pr-1.5 text-[11.5px] text-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5", style: tint ? { borderColor: `${tint}55`, backgroundColor: `${tint}12` } : undefined, children: [_jsx("span", { className: "flex items-center text-muted-foreground group-hover:text-destructive", style: tint ? { color: tint } : undefined, children: icon }), _jsxs("span", { className: "text-muted-foreground", children: [label, ":"] }), _jsx("span", { className: "max-w-[140px] truncate font-medium text-foreground", children: value }), _jsx("span", { className: "ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/70 group-hover:text-destructive", children: _jsx(X, { size: 11 }) })] }));
}
// Search input with inline `#tag` chips. Free text is a normal input;
// `#`-prefixed words become purple chips when committed via comma, space
// (when token starts with `#`), or Enter, and immediately apply as filters.
function SearchWithTagChips({ inputRef, value, placeholder, onChange, onSubmit, }) {
    // Split into leading `#tag` chips (terminated by whitespace) + free text.
    // We only treat a `#tag` as a chip when it has a trailing whitespace —
    // otherwise the user is still typing it.
    const [chips, freeText] = (() => {
        const parts = [];
        let rest = value;
        while (true) {
            const m = rest.match(/^(#\S+)\s+/);
            if (!m)
                break;
            parts.push(m[1]);
            rest = rest.slice(m[0].length);
        }
        return [parts, rest];
    })();
    const rebuild = (nextChips, nextFreeText) => {
        const head = nextChips.length ? nextChips.join(' ') + ' ' : '';
        return head + nextFreeText;
    };
    const removeChipAt = (index) => {
        const next = [...chips];
        next.splice(index, 1);
        onChange(rebuild(next, freeText));
        inputRef.current?.focus();
    };
    const commitTrailingTagInFreeText = (text) => {
        // Match a `#tag` that ends the string (just typed before comma/space/Enter).
        const m = text.match(/^(.*?)(\s|^)(#\S+)$/);
        if (!m)
            return null;
        const before = (m[1] + m[2]).trimEnd();
        const tag = m[3];
        const newChips = [...chips, tag];
        return { newChips, rest: before };
    };
    return (_jsxs("div", { className: "relative flex min-w-0 flex-1 flex-wrap items-center gap-1 px-2.5 py-1 min-h-9 cursor-text", onClick: () => inputRef.current?.focus(), children: [_jsx(Search, { size: 15, className: "pointer-events-none shrink-0 text-muted-foreground/70" }), chips.map((tag, i) => (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/5 px-2 py-0.5 text-[11.5px] font-medium text-primary", children: [tag, _jsx("button", { type: "button", tabIndex: -1, onClick: (e) => {
                            e.stopPropagation();
                            removeChipAt(i);
                        }, className: "text-primary/60 hover:text-primary", children: _jsx(X, { size: 10 }) })] }, `${tag}-${i}`))), _jsx("input", { ref: inputRef, type: "text", placeholder: chips.length === 0 ? placeholder : undefined, value: freeText, onChange: (e) => {
                    const next = e.target.value;
                    // Comma right after a `#tag` token commits it. Other commas stay
                    // as literal characters in the free-text search.
                    if (next.endsWith(',')) {
                        const beforeComma = next.slice(0, -1);
                        const result = commitTrailingTagInFreeText(beforeComma);
                        if (result) {
                            const submitValue = rebuild(result.newChips, result.rest);
                            if (onSubmit)
                                onSubmit(submitValue);
                            else
                                onChange(submitValue);
                            return;
                        }
                    }
                    onChange(rebuild(chips, next));
                }, onKeyDown: (e) => {
                    if (e.key === 'Enter' && onSubmit) {
                        e.preventDefault();
                        // Promote a still-being-typed `#tag` at the end to a chip too.
                        const result = commitTrailingTagInFreeText(freeText);
                        const submitValue = result
                            ? rebuild(result.newChips, result.rest)
                            : rebuild(chips, freeText);
                        onSubmit(submitValue);
                    }
                    else if (e.key === 'Backspace' && freeText === '' && chips.length > 0) {
                        e.preventDefault();
                        removeChipAt(chips.length - 1);
                    }
                    else if (e.key === ' ') {
                        // Space after a `#tag` commits it; space inside free text is
                        // a normal whitespace.
                        const result = commitTrailingTagInFreeText(freeText);
                        if (result) {
                            e.preventDefault();
                            const submitValue = rebuild(result.newChips, result.rest);
                            if (onSubmit)
                                onSubmit(submitValue);
                            else
                                onChange(submitValue);
                        }
                    }
                }, className: "min-w-[80px] flex-1 border-0 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground" })] }));
}
