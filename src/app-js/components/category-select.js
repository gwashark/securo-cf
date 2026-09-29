import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDownIcon, CheckIcon, PlusIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover.js';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from './ui/command.js';
import { WorkspaceContext } from '../contexts/workspace-context.js';
import { categories as categoriesApi } from '../lib/api.js';
import { extractApiError } from '../lib/api-errors.js';
import { invalidateCategoryQueries } from '../lib/invalidate-queries.js';
import { inlineCreateItemValue, inlineCreateName } from '../lib/inline-create.js';
import { cn, normalizeText } from '../lib/utils.js';
import { isCategoryHiddenFromSelection, resolveSelectedCategory, } from '../lib/category-selection-utils.js';
// Same starting look the categories page gives a new category, so one made
// from a picker is indistinguishable from one made there.
const NEW_CATEGORY_ICON = 'circle-help';
const NEW_CATEGORY_COLOR = '#6366f1';
export function CategorySelect({ value, onChange, categories, groups, currentCategory, placeholder, disabled = false, className, allowNone = false, creatable = false, contentProps, }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    // The category just created here. The list catches up once the refetch
    // lands; until then this keeps the trigger showing the new name.
    const [created, setCreated] = useState(null);
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    // Read the context directly rather than through useWorkspace, so the
    // picker still renders (without creation) outside a workspace provider.
    const canWrite = useContext(WorkspaceContext)?.canWrite ?? false;
    const canCreate = creatable && canWrite;
    const createMutation = useMutation({
        mutationFn: (name) => categoriesApi.create({ name, icon: NEW_CATEGORY_ICON, color: NEW_CATEGORY_COLOR }),
        onSuccess: (category) => {
            // Only the category lists refetch. Whatever form hosts this picker
            // (an import preview, a half-filled transaction) keeps its state.
            invalidateCategoryQueries(queryClient);
            setCreated(category);
            onChange(category.id);
            handleOpenChange(false);
            toast.success(t('categories.created'));
        },
        onError: (err) => toast.error(extractApiError(err, t('common.error'))),
    });
    function handleOpenChange(next) {
        setOpen(next);
        if (!next)
            setSearch('');
    }
    const createName = canCreate
        ? inlineCreateName(search, (categories ?? []).map((c) => c.name))
        : null;
    const resolvedPlaceholder = placeholder ?? t('transactions.selectCategory', 'Select category');
    const displayGroups = useMemo(() => {
        const ungrouped = (categories ?? []).filter((c) => !c.group_id);
        if (ungrouped.length === 0)
            return groups;
        return [
            ...groups,
            {
                id: 'ungrouped-virtual',
                name: t('groups.noGroup'),
                categories: ungrouped,
            },
        ];
    }, [categories, groups, t]);
    const selectedCategory = useMemo(() => {
        const fallback = created && created.id === value ? created : currentCategory;
        return resolveSelectedCategory(categories ?? [], value, fallback);
    }, [categories, created, currentCategory, value]);
    // A category created a moment ago is not hidden, only not refetched yet.
    const selectedCategoryIsHidden = selectedCategory !== created
        && isCategoryHiddenFromSelection(categories ?? [], selectedCategory);
    return (_jsxs(Popover, { open: open, onOpenChange: handleOpenChange, children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs("button", { type: "button", disabled: disabled, className: cn("flex w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm text-left shadow-xs transition-[color,box-shadow] outline-hidden focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50 h-9 cursor-pointer", className), children: [_jsx("span", { className: "flex items-center gap-2 min-w-0 truncate", children: selectedCategory ? (_jsxs(_Fragment, { children: [selectedCategory.color ? (_jsx("span", { className: "size-2.5 shrink-0 rounded-full border border-black/5", style: { backgroundColor: selectedCategory.color } })) : null, _jsx("span", { className: "truncate", children: selectedCategory.name }), selectedCategoryIsHidden && (_jsx("span", { className: "shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground", children: t('categories.hiddenBadge') }))] })) : value === '' && allowNone ? (_jsx("span", { className: "italic text-muted-foreground truncate", children: t('transactions.noCategory') })) : (_jsx("span", { className: "text-muted-foreground truncate", children: resolvedPlaceholder })) }), _jsx(ChevronDownIcon, { className: "size-4 shrink-0 opacity-50" })] }) }), _jsx(PopoverContent, { align: "start", className: "w-[var(--radix-popover-trigger-width)] p-0 overflow-hidden", ...contentProps, children: _jsxs(Command, { filter: (itemValue, search) => {
                        return normalizeText(itemValue).includes(normalizeText(search)) ? 1 : 0;
                    }, children: [_jsx(CommandInput, { placeholder: t('transactions.searchCategory'), value: search, onValueChange: setSearch }), _jsxs(CommandList, { children: [_jsx(CommandEmpty, { children: t('transactions.noCategoryFound') }), allowNone && (_jsx(CommandGroup, { children: _jsxs(CommandItem, { value: `none ${t('transactions.noCategory')}`, onSelect: () => {
                                            onChange('');
                                            handleOpenChange(false);
                                        }, className: "italic text-muted-foreground cursor-pointer", children: [_jsx("span", { className: "flex-1", children: t('transactions.noCategory') }), value === '' && _jsx(CheckIcon, { className: "size-4 shrink-0" })] }) })), displayGroups.map((group) => (_jsxs(CommandGroup, { children: [_jsx("div", { className: "px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70", children: group.name }), group.categories.map((cat) => (_jsxs(CommandItem, { value: `${group.name} ${cat.name}`, onSelect: () => {
                                                onChange(cat.id);
                                                handleOpenChange(false);
                                            }, className: "cursor-pointer", children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0 truncate flex-1", children: [cat.color ? (_jsx("span", { className: "size-2.5 shrink-0 rounded-full border border-black/5", style: { backgroundColor: cat.color } })) : null, _jsx("span", { className: "truncate", children: cat.name })] }), value === cat.id && _jsx(CheckIcon, { className: "size-4 shrink-0" })] }, cat.id)))] }, group.id))), createName && (_jsx(CommandGroup, { children: _jsxs(CommandItem, { value: inlineCreateItemValue(search), disabled: createMutation.isPending, onSelect: () => createMutation.mutate(createName), className: "cursor-pointer", children: [_jsx(PlusIcon, { className: "size-4 shrink-0 text-muted-foreground" }), _jsx("span", { className: "truncate", children: t('common.createNamed', { name: createName }) })] }) }))] })] }) })] }));
}
