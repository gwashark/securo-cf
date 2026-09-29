import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, } from './ui/dropdown-menu.js';
import { CategoryFilterContent } from './category-filter-content.js';
export function CategoryFilterDropdown({ categoryIds, onCategoryIdsChange, filterUncategorized, onUncategorizedChange, categories, groups, label, triggerClassName, }) {
    const { t } = useTranslation();
    const categoryById = useMemo(() => {
        const map = new Map();
        categories.forEach((c) => map.set(c.id, c));
        return map;
    }, [categories]);
    const summary = useMemo(() => {
        const total = categoryIds.length + (filterUncategorized ? 1 : 0);
        if (total > 1)
            return t('transactions.filtersBar.nSelected', { count: total });
        if (filterUncategorized)
            return t('transactions.uncategorized');
        if (categoryIds.length === 1)
            return categoryById.get(categoryIds[0])?.name ?? '';
        return '';
    }, [categoryIds, filterUncategorized, categoryById, t]);
    const displayLabel = label ?? t('transactions.category');
    const hasFilter = categoryIds.length > 0 || filterUncategorized;
    return (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs("button", { type: "button", className: triggerClassName ??
                        `inline-flex min-w-[10rem] h-8 items-center gap-1.5 justify-between rounded-md border border-border px-3 text-sm bg-card hover:bg-muted transition-colors focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]`, children: [_jsx(Tag, { size: 13, className: "text-muted-foreground" }), _jsx("span", { className: `flex-1 text-left ${hasFilter ? 'text-foreground' : 'text-muted-foreground'}`, children: summary || displayLabel }), _jsx(ChevronDown, { size: 12, className: "text-muted-foreground" })] }) }), _jsx(DropdownMenuContent, { align: "start", className: "max-h-[320px] w-[240px] overflow-y-auto p-1", children: _jsx(CategoryFilterContent, { categoryIds: categoryIds, onCategoryIdsChange: onCategoryIdsChange, filterUncategorized: filterUncategorized, onUncategorizedChange: onUncategorizedChange, categories: categories, groups: groups }) })] }));
}
