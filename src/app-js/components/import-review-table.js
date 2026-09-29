import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../lib/format.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from './ui/table.js';
import { Input } from './ui/input.js';
import { CategorySelect } from './category-select.js';
import { CategoryFilterDropdown } from './category-filter-dropdown.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from './ui/select.js';
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
function formatLocalDate(date, locale) {
    const match = ISO_DATE_RE.exec(date);
    if (!match)
        return new Date(date).toLocaleDateString(locale);
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString(locale);
}
export function ImportReviewTable({ transactions, categories, groups, userCurrency, locale, dateLocale, searchQuery, filterCategoryIds, filterUncategorized, statusFilter, currentPage, onToggleExcluded, onChangeCategory, onSearchChange, onCategoryIdsChange, onUncategorizedChange, onStatusFilterChange, onPageChange, }) {
    const { t } = useTranslation();
    const [pageSize, setPageSize] = useState(() => {
        try {
            const stored = localStorage.getItem('securo.import.pageSize');
            return stored ? Number(stored) : 50;
        }
        catch {
            return 50;
        }
    });
    const hasCategoryFilter = filterCategoryIds.length > 0 || filterUncategorized;
    const filtered = useMemo(() => {
        return transactions.filter(tx => {
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (!tx.description.toLowerCase().includes(q))
                    return false;
            }
            if (hasCategoryFilter) {
                const catId = tx.selected_category_id !== undefined ? tx.selected_category_id : tx.suggested_category_id;
                if (filterUncategorized && !filterCategoryIds.length) {
                    if (catId)
                        return false;
                }
                else if (filterUncategorized) {
                    if (catId && !filterCategoryIds.includes(catId))
                        return false;
                }
                else {
                    if (!catId || !filterCategoryIds.includes(catId))
                        return false;
                }
            }
            if (statusFilter === 'included' && tx.excluded)
                return false;
            if (statusFilter === 'excluded' && !tx.excluded)
                return false;
            return true;
        });
    }, [transactions, searchQuery, filterCategoryIds, filterUncategorized, hasCategoryFilter, statusFilter]);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
    return (_jsxs("div", { children: [_jsxs("div", { className: "px-5 py-3 border-b border-border bg-muted/30 flex flex-wrap items-center gap-3", children: [_jsx(Input, { placeholder: t('import.searchTransactions'), value: searchQuery, onChange: (e) => { onSearchChange(e.target.value); onPageChange(1); }, className: "max-w-xs h-8 text-sm border border-border rounded-md px-3 bg-card focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]" }), _jsx(CategoryFilterDropdown, { categoryIds: filterCategoryIds, onCategoryIdsChange: (ids) => { onCategoryIdsChange(ids); onPageChange(1); }, filterUncategorized: filterUncategorized, onUncategorizedChange: (v) => { onUncategorizedChange(v); onPageChange(1); }, categories: categories, groups: groups, label: t('import.filterCategory') }), _jsxs("select", { className: "border border-border rounded-md px-3 py-1.5 text-sm bg-card focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]", value: statusFilter, onChange: (e) => { onStatusFilterChange(e.target.value); onPageChange(1); }, children: [_jsx("option", { value: "all", children: t('import.allStatus') }), _jsx("option", { value: "included", children: t('import.included') }), _jsx("option", { value: "excluded", children: t('import.excluded') })] })] }), _jsx("div", { className: "max-h-[480px] overflow-auto", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { className: "hover:bg-transparent bg-transparent border-b border-border", children: [_jsx(TableHead, { className: "text-xs font-medium text-muted-foreground py-3 pl-4 w-[40px]", children: _jsx("span", { className: "sr-only", children: "Toggle" }) }), _jsx(TableHead, { className: "text-xs font-medium text-muted-foreground py-3 w-[100px]", children: t('transactions.date') }), _jsx(TableHead, { className: "text-xs font-medium text-muted-foreground py-3", children: t('transactions.description') }), _jsx(TableHead, { className: "text-xs font-medium text-muted-foreground py-3 text-right w-[120px]", children: t('transactions.amount') }), _jsx(TableHead, { className: "text-xs font-medium text-muted-foreground py-3 w-[160px]", children: t('import.category') }), _jsx(TableHead, { className: "text-xs font-medium text-muted-foreground py-3 pr-4 w-[90px]", children: t('transactions.status') })] }) }), _jsx(TableBody, { children: pageItems.map((tx) => {
                                return (_jsxs(TableRow, { className: `border-b border-border last:border-0 hover:bg-muted ${tx.excluded ? 'opacity-50' : ''}`, children: [_jsx(TableCell, { className: "py-2.5 pl-4", children: _jsx("input", { type: "checkbox", checked: !tx.excluded, onChange: () => onToggleExcluded(tx._id), className: "rounded border-border text-primary focus:ring-primary" }) }), _jsx(TableCell, { className: "py-2.5 text-xs text-muted-foreground whitespace-nowrap", children: formatLocalDate(tx.date, dateLocale) }), _jsx(TableCell, { className: `py-2.5 text-sm ${tx.excluded ? 'line-through text-muted-foreground' : 'text-foreground'}`, children: tx.description }), _jsxs(TableCell, { className: `py-2.5 text-right text-sm font-bold tabular-nums ${tx.type === 'credit' ? 'text-emerald-600' : 'text-rose-500'}`, children: [tx.type === 'credit' ? '+' : '−', formatCurrency(Math.abs(Number(tx.amount)), userCurrency, locale)] }), _jsx(TableCell, { className: "py-2.5", children: _jsx(CategorySelect, { value: tx.selected_category_id !== undefined
                                                    ? (tx.selected_category_id ?? '')
                                                    : (tx.suggested_category_id ?? ''), onChange: (v) => onChangeCategory(tx._id, v || null), categories: categories, groups: groups, placeholder: t('import.noCategory'), allowNone: true, creatable: true, className: "w-full border border-border rounded-md px-2 py-1 text-xs bg-card focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]" }) }), _jsx(TableCell, { className: "py-2.5 pr-4", children: tx.excluded ? (_jsx("span", { className: "text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded", children: t('import.excluded') })) : (_jsx("span", { className: "text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded", children: t('import.included') })) })] }, tx._id));
                            }) })] }) }), filtered.length > 10 && (_jsxs("div", { className: "px-5 py-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-sm", children: [totalPages > 1 ? (_jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("button", { className: "text-muted-foreground hover:text-foreground disabled:opacity-30 font-medium", disabled: safePage <= 1, onClick: () => onPageChange(safePage - 1), children: ["\u2190 ", t('common.previous', 'Previous')] }), _jsx("span", { className: "text-xs text-muted-foreground", children: t('import.page', { current: safePage, total: totalPages }) }), _jsxs("button", { className: "text-muted-foreground hover:text-foreground disabled:opacity-30 font-medium", disabled: safePage >= totalPages, onClick: () => onPageChange(safePage + 1), children: [t('common.next', 'Next'), " \u2192"] })] })) : (_jsx("div", { className: "hidden sm:block" })), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-xs text-muted-foreground", children: t('common.rowsPerPage', 'Rows per page') }), _jsxs(Select, { value: String(pageSize), onValueChange: (val) => {
                                    const nextSize = Number(val);
                                    setPageSize(nextSize);
                                    onPageChange(1);
                                    try {
                                        localStorage.setItem('securo.import.pageSize', String(nextSize));
                                    }
                                    catch {
                                        // ignored
                                    }
                                }, children: [_jsx(SelectTrigger, { className: "w-[70px] h-8 text-xs", children: _jsx(SelectValue, { placeholder: pageSize }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "10", children: "10" }), _jsx(SelectItem, { value: "20", children: "20" }), _jsx(SelectItem, { value: "50", children: "50" }), _jsx(SelectItem, { value: "100", children: "100" })] })] })] })] }))] }));
}
