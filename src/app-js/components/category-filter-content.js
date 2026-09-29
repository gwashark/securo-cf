import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { DropdownMenuCheckboxItem, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, } from './ui/dropdown-menu.js';
import { normalizeText } from '../lib/utils.js';
function toggleInArray(arr, id) {
    return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
}
export function CategoryFilterContent({ categoryIds, onCategoryIdsChange, filterUncategorized, onUncategorizedChange, categories, groups, onKeepOpen, }) {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const displayCategoryGroups = useMemo(() => {
        const ungrouped = (categories ?? []).filter((c) => !c.group_id);
        const baseGroups = ungrouped.length === 0 ? groups : [
            ...groups,
            {
                id: 'ungrouped-virtual',
                name: t('groups.noGroup'),
                categories: ungrouped,
            },
        ];
        if (!search.trim())
            return baseGroups;
        const query = normalizeText(search);
        return baseGroups
            .map((g) => ({
            ...g,
            categories: g.categories.filter((c) => normalizeText(c.name).includes(query)),
        }))
            .filter((g) => g.categories.length > 0);
    }, [categories, groups, search, t]);
    const showUncategorized = useMemo(() => {
        if (!search.trim())
            return true;
        return normalizeText(t('transactions.uncategorized')).includes(normalizeText(search));
    }, [search, t]);
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "px-2 py-1.5 border-b border-border/50 sticky top-0 bg-popover z-10", children: _jsxs("div", { className: "relative", children: [_jsx(Search, { className: "pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/60" }), _jsx("input", { type: "text", placeholder: t('transactions.searchCategory'), value: search, onChange: (e) => setSearch(e.target.value), onClick: (e) => e.stopPropagation(), onKeyDown: (e) => e.stopPropagation(), className: "w-full rounded-md border border-input bg-transparent pl-7 pr-2.5 py-1 text-xs outline-hidden placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/25" })] }) }), showUncategorized && (_jsxs(_Fragment, { children: [_jsx(DropdownMenuCheckboxItem, { checked: filterUncategorized, onSelect: (e) => {
                            e.preventDefault();
                            onKeepOpen?.();
                            onUncategorizedChange(!filterUncategorized);
                        }, className: "gap-2 rounded-sm py-1.5 text-[13px]", children: _jsx("span", { className: "min-w-0 flex-1 truncate text-left italic text-muted-foreground", children: t('transactions.uncategorized') }) }), _jsx("div", { className: "my-1 h-px bg-border/60" })] })), displayCategoryGroups.length === 0 ? (_jsx("div", { className: "px-2 py-3 text-center text-[12px] text-muted-foreground", children: search.trim()
                    ? t('transactions.noCategoryFound')
                    : t('transactions.filtersBar.noOptions') })) : (displayCategoryGroups.map((group) => (_jsxs(DropdownMenuGroup, { children: [_jsx(DropdownMenuLabel, { className: "px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70", children: group.name }), group.categories.map((c) => (_jsxs(DropdownMenuCheckboxItem, { checked: categoryIds.includes(c.id), onSelect: (e) => {
                            e.preventDefault();
                            onKeepOpen?.();
                            onCategoryIdsChange(toggleInArray(categoryIds, c.id));
                        }, className: "gap-2 rounded-sm py-1.5 text-[13px]", children: [c.color ? (_jsx("span", { className: "size-2.5 shrink-0 rounded-full border border-black/5", style: { backgroundColor: c.color } })) : null, _jsx("span", { className: "min-w-0 flex-1 truncate text-left", children: c.name })] }, c.id)))] }, group.id)))), (categoryIds.length > 0 || filterUncategorized) && (_jsxs(_Fragment, { children: [_jsx("div", { className: "my-1 h-px bg-border/60" }), _jsxs(DropdownMenuItem, { onSelect: (e) => {
                            e.preventDefault();
                            onKeepOpen?.();
                            onCategoryIdsChange([]);
                            onUncategorizedChange(false);
                        }, className: "gap-2 rounded-sm px-2 py-1.5 text-[12px] text-muted-foreground", children: [_jsx(X, { size: 12 }), t('transactions.filtersBar.clearSelection')] })] }))] }));
}
