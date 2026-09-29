import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
import { ArrowUpDown, Calendar as CalendarIcon, Check, ChevronLeft, ChevronRight, Coins, EyeClosed, ListChecks, Store, Tag, Users, Wallet, X, } from 'lucide-react';
import { Button } from './ui/button.js';
import { CategoryFilterContent } from './category-filter-content.js';
import { DropdownMenuCheckboxItem, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, } from './ui/dropdown-menu.js';
import { getAccountName } from '../lib/account-utils.js';
import { cn } from '../lib/utils.js';
function toggleSelection(selectedIds, id) {
    return selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id];
}
function MobileRootOption({ option, onSelect, }) {
    const Icon = option.icon;
    return (_jsxs(DropdownMenuItem, { onSelect: (event) => {
            event.preventDefault();
            onSelect(option.view);
        }, className: "gap-2 py-2 text-[13px]", children: [_jsx(Icon, { size: 14, className: "text-muted-foreground" }), _jsx("span", { className: "flex-1", children: option.label }), option.summary && (_jsx("span", { className: "max-w-24 truncate text-[11px] text-muted-foreground", children: option.summary })), _jsx(ChevronRight, { size: 13, className: "text-muted-foreground/60" })] }));
}
function MobileFilterRoot({ options, hasAnyFilter, onSelect, onClear, }) {
    const { t } = useTranslation();
    return (_jsxs(_Fragment, { children: [_jsx(DropdownMenuLabel, { className: "px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70", children: t('transactions.filtersBar.filterBy') }), options.map((option) => (_jsx(MobileRootOption, { option: option, onSelect: onSelect }, option.view))), hasAnyFilter && _jsx(MobileClearFilters, { onClear: onClear })] }));
}
function MobileClearFilters({ onClear }) {
    const { t } = useTranslation();
    return (_jsxs(_Fragment, { children: [_jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { onSelect: onClear, className: "gap-2 text-[12.5px] text-muted-foreground", children: [_jsx(X, { size: 13 }), t('transactions.clearFilters')] })] }));
}
function MobileDetailHeader({ title, onBack, }) {
    const { t } = useTranslation();
    return (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", onClick: onBack, className: "flex w-full items-center gap-1 rounded-sm px-2 py-1.5 text-left text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground", children: [_jsx(ChevronLeft, { size: 14 }), t('common.back')] }), _jsx(DropdownMenuLabel, { className: "px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70", children: title })] }));
}
function MobileAccountOption({ account, checked, onChange, }) {
    return (_jsxs(DropdownMenuCheckboxItem, { checked: checked, onSelect: (event) => {
            event.preventDefault();
            onChange();
        }, className: "gap-2 py-2 text-[13px]", children: [_jsx("span", { className: "min-w-0 flex-1 truncate text-left", children: getAccountName(account) }), account.currency && (_jsx("span", { className: "text-[10.5px] uppercase tracking-wide text-muted-foreground/70", children: account.currency }))] }));
}
function MobileAccountView({ accounts, selectedIds, onChange, }) {
    const { t } = useTranslation();
    if (accounts.length === 0) {
        return _jsx(MobileEmptyOptions, {});
    }
    return (_jsxs(_Fragment, { children: [accounts.map((account) => (_jsx(MobileAccountOption, { account: account, checked: selectedIds.includes(account.id), onChange: () => onChange(toggleSelection(selectedIds, account.id)) }, account.id))), selectedIds.length > 0 && (_jsxs(DropdownMenuItem, { onSelect: (event) => {
                    event.preventDefault();
                    onChange([]);
                }, className: "mt-1 gap-2 border-t border-border/60 text-xs text-muted-foreground", children: [_jsx(X, { size: 12 }), t('transactions.filtersBar.clearSelection')] }))] }));
}
function MobileEmptyOptions() {
    const { t } = useTranslation();
    return (_jsx("div", { className: "px-2 py-3 text-center text-xs text-muted-foreground", children: t('transactions.filtersBar.noOptions') }));
}
function MobileSelectionView({ options, selectedValue, onChange, }) {
    return options.map((option) => (_jsxs(DropdownMenuItem, { onSelect: (event) => {
            event.preventDefault();
            onChange(option.value);
        }, className: cn('gap-2 py-2 text-[13px]', selectedValue === option.value && 'bg-primary/5'), children: [_jsx("span", { className: "min-w-0 flex-1 truncate", children: option.label }), selectedValue === option.value && _jsx(Check, { size: 13, className: "text-primary" })] }, option.value || 'all')));
}
function MobileDateView({ from, to, presets, onChange, onOpenCustomRange, }) {
    const { t } = useTranslation();
    const options = [
        { value: '|', label: t('transactions.all') },
        ...presets.map((preset) => ({
            value: `${preset.from}|${preset.to}`,
            label: preset.label,
        })),
    ];
    return (_jsxs(_Fragment, { children: [_jsx(MobileSelectionView, { options: options, selectedValue: `${from}|${to}`, onChange: (value) => onChange(...splitDateRange(value)) }), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { onSelect: onOpenCustomRange, className: "justify-between py-2 text-[13px]", children: [t('transactions.filtersBar.customRange'), _jsx(ChevronRight, { size: 13, className: "text-muted-foreground/60" })] })] }));
}
function splitDateRange(value) {
    const [from, to] = value.split('|');
    return [from, to];
}
function MobileAmountField({ label, value, onChange, }) {
    return (_jsxs("label", { className: "text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80", children: [label, _jsx("input", { type: "number", inputMode: "decimal", min: 0, step: "0.01", placeholder: "0.00", value: value, onChange: (event) => onChange(event.target.value), className: "mt-1 h-9 w-full rounded-md border border-border bg-card px-2 text-[13px] font-normal tracking-normal text-foreground outline-none focus:border-primary/60" })] }));
}
function MobileAmountView({ minAmount, maxAmount, setMinAmount, setMaxAmount, onReset, onApply, }) {
    const { t } = useTranslation();
    return (_jsxs("div", { className: "p-2", children: [_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(MobileAmountField, { label: t('transactions.filtersBar.amountMinLabel'), value: minAmount, onChange: setMinAmount }), _jsx(MobileAmountField, { label: t('transactions.filtersBar.amountMaxLabel'), value: maxAmount, onChange: setMaxAmount })] }), _jsx("p", { className: "mt-2 text-[10.5px] leading-snug text-muted-foreground/80", children: t('transactions.filtersBar.amountHint') }), _jsxs("div", { className: "mt-2 flex items-center justify-between gap-2", children: [_jsx("button", { type: "button", onClick: onReset, className: "text-xs font-medium text-muted-foreground hover:text-foreground", children: t('transactions.filtersBar.reset') }), _jsx(Button, { type: "button", size: "sm", disabled: !minAmount && !maxAmount, onClick: onApply, children: t('transactions.filtersBar.apply') })] })] }));
}
function buildRootOptions(labels, summaries) {
    return [
        { view: 'account', icon: Wallet, label: labels.account, summary: summaries.account },
        { view: 'category', icon: Tag, label: labels.category, summary: summaries.category },
        { view: 'payee', icon: Store, label: labels.payee, summary: summaries.payee },
        { view: 'group', icon: Users, label: labels.group, summary: summaries.group },
        { view: 'type', icon: ArrowUpDown, label: labels.type, summary: summaries.type },
        { view: 'status', icon: ListChecks, label: labels.status, summary: summaries.status },
        { view: 'ignored', icon: EyeClosed, label: labels.ignored, summary: summaries.ignored },
        { view: 'date', icon: CalendarIcon, label: labels.date, summary: summaries.date },
        { view: 'amount', icon: Coins, label: labels.amount, summary: summaries.amount },
    ];
}
function buildLabels(t) {
    return {
        account: t('transactions.account'),
        category: t('transactions.category'),
        payee: t('payees.payee'),
        group: t('splitGroups.group'),
        type: t('transactions.type'),
        status: t('transactions.status'),
        ignored: t('transactions.ignoredRows'),
        date: t('transactions.filtersBar.date'),
        amount: t('transactions.filtersBar.amount'),
    };
}
function MobileFilterDetail({ menu, labels, }) {
    const { t } = useTranslation();
    const allOption = { value: '', label: t('transactions.all') };
    if (menu.view === 'account') {
        return _jsx(MobileAccountView, { accounts: menu.accounts, selectedIds: menu.accountIds, onChange: menu.onAccountIdsChange });
    }
    if (menu.view === 'category') {
        return _jsx(CategoryFilterContent, { categoryIds: menu.categoryIds, onCategoryIdsChange: menu.onCategoryIdsChange, filterUncategorized: menu.uncategorized, onUncategorizedChange: menu.onUncategorizedChange, categories: menu.categories, groups: menu.categoryGroups, onKeepOpen: () => undefined });
    }
    if (menu.view === 'payee') {
        return _jsx(MobileSelectionView, { options: [allOption, ...menu.payees.map(({ id, name }) => ({ value: id, label: name }))], selectedValue: menu.payeeId, onChange: menu.onPayeeChange });
    }
    if (menu.view === 'group') {
        return _jsx(MobileSelectionView, { options: [allOption, ...menu.groups.map(({ id, name }) => ({ value: id, label: name }))], selectedValue: menu.groupId, onChange: menu.onGroupIdChange });
    }
    if (menu.view === 'type') {
        const options = [allOption, { value: 'credit', label: t('transactions.income') }, { value: 'debit', label: t('transactions.expense') }, { value: 'transfer', label: t('transactions.transfer') }];
        return _jsx(MobileSelectionView, { options: options, selectedValue: menu.type, onChange: menu.onTypeChange });
    }
    if (menu.view === 'status') {
        const options = [allOption, { value: 'pending', label: t('transactions.statusPending') }, { value: 'posted', label: t('transactions.statusPosted') }];
        return _jsx(MobileSelectionView, { options: options, selectedValue: menu.status, onChange: menu.onStatusChange });
    }
    if (menu.view === 'ignored') {
        const options = [
            { value: 'show', label: t('transactions.ignoredShow') },
            { value: 'hide', label: t('transactions.ignoredHide') },
        ];
        return _jsx(MobileSelectionView, { options: options, selectedValue: menu.hideIgnored ? 'hide' : 'show', onChange: (value) => menu.onHideIgnoredChange(value === 'hide') });
    }
    if (menu.view === 'date') {
        return _jsx(MobileDateView, { from: menu.from, to: menu.to, presets: menu.datePresets, onChange: menu.onDateRangeChange, onOpenCustomRange: menu.onOpenCustomRange });
    }
    if (menu.view === 'amount') {
        return _jsx(MobileAmountView, { minAmount: menu.minAmount, maxAmount: menu.maxAmount, setMinAmount: menu.setMinAmount, setMaxAmount: menu.setMaxAmount, onReset: () => resetAmount(menu), onApply: menu.onApplyAmountRange });
    }
    return _jsx(MobileFilterRoot, { options: buildRootOptions(labels, menu.summaries), hasAnyFilter: menu.hasAnyFilter, onSelect: (view) => openDetail(menu, view), onClear: () => clearAll(menu) });
}
function openDetail(menu, view) {
    if (view === 'amount') {
        menu.setMinAmount(menu.appliedMinAmount);
        menu.setMaxAmount(menu.appliedMaxAmount);
    }
    menu.setView(view);
}
function resetAmount(menu) {
    menu.setMinAmount('');
    menu.setMaxAmount('');
    menu.onAmountRangeChange('', '');
}
function clearAll(menu) {
    menu.onClearAll();
    menu.setMenuOpen(false);
}
/**
 * Keeps mobile transaction filters inside one navigable dropdown.
 * @example <MobileTransactionsFilterMenu {...menuProps} />
 */
export function MobileTransactionsFilterMenu(menu) {
    const { t } = useTranslation();
    const labels = buildLabels(t);
    return (_jsxs("div", { className: "sm:hidden", children: [menu.view !== 'root' && (_jsx(MobileDetailHeader, { title: labels[menu.view], onBack: () => menu.setView('root') })), _jsx(MobileFilterDetail, { menu: menu, labels: labels })] }));
}
