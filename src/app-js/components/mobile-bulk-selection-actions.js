import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ArrowLeftRight, Check, MoreHorizontal, SlidersHorizontal, Trash2, Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CategorySelect } from './category-select.js';
import { Button } from './ui/button.js';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from './ui/dropdown-menu.js';
function parseBulkTags(value) {
    return value.trim().split(/[\s,]+/).filter(Boolean);
}
function BulkCategoryPicker(props) {
    const { t } = useTranslation();
    return (_jsx("div", { className: "min-w-0 flex-1", children: _jsx(CategorySelect, { value: props.categoryValue, onChange: props.onCategoryChange, categories: props.categories, groups: props.categoryGroups, placeholder: t('transactions.selectCategory'), disabled: props.categoryPending, className: "h-9 min-w-0 border-transparent bg-transparent px-2 shadow-none hover:bg-muted/60 focus:bg-muted/60 focus-visible:ring-0", contentProps: { side: 'top', sideOffset: 8 } }, `mobile-${props.categoryValue}`) }));
}
function BulkTagButtons(props) {
    const { t } = useTranslation();
    const tags = parseBulkTags(props.tagInput);
    return (_jsxs("div", { className: "mt-1.5 grid grid-cols-2 gap-1.5", children: [_jsxs(Button, { size: "sm", variant: "ghost", disabled: !tags.length || props.addTagsPending, onClick: () => props.onAddTags(tags), children: [_jsx(Check, { size: 15 }), t('transactions.bulkAddTags', 'Add tags')] }), _jsxs(Button, { size: "sm", variant: "ghost", disabled: !tags.length || props.removeTagsPending, onClick: () => props.onRemoveTags(tags), children: [_jsx(X, { size: 15 }), t('transactions.bulkRemoveTags', 'Remove tags')] })] }));
}
function BulkTagEditor(props) {
    const { t } = useTranslation();
    const submitTags = () => {
        const tags = parseBulkTags(props.tagInput);
        if (tags.length)
            props.onAddTags(tags);
    };
    return (_jsxs("div", { className: "mt-1 border-t border-border px-2 pt-2", children: [_jsx("input", { type: "text", value: props.tagInput, onChange: (event) => props.onTagInputChange(event.target.value), placeholder: t('transactions.addTagsPlaceholder', '#tag…'), className: "h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring", onKeyDown: (event) => { event.stopPropagation(); if (event.key === 'Enter') {
                    event.preventDefault();
                    submitTags();
                } } }), _jsx(BulkTagButtons, { ...props })] }));
}
function BulkActionItems(props) {
    const { t } = useTranslation();
    return (_jsxs(_Fragment, { children: [_jsxs(DropdownMenuItem, { disabled: props.groupPending, onSelect: props.onOpenGroup, children: [_jsx(Users, { size: 15 }), t('transactions.addToGroup')] }), _jsxs(DropdownMenuItem, { disabled: props.transferDisabled, title: props.transferTitle, onSelect: props.onOpenTransfer, children: [_jsx(ArrowLeftRight, { size: 15 }), t('transactions.linkAsTransfer')] }), props.onCreateRule && _jsxs(DropdownMenuItem, { onSelect: props.onCreateRule, children: [_jsx(SlidersHorizontal, { size: 15 }), t('transactions.createRule')] }), _jsxs(DropdownMenuItem, { onSelect: props.onBulkDelete, className: "text-destructive", children: [_jsx(Trash2, { size: 15 }), t('transactions.bulkDelete')] }), _jsx(BulkTagEditor, { ...props })] }));
}
function BulkActionsMenu(props) {
    const { t } = useTranslation();
    return (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "sm", className: "h-9 shrink-0 px-2.5", children: [_jsx(MoreHorizontal, { size: 16 }), t('rules.actions')] }) }), _jsx(DropdownMenuContent, { side: "top", align: "end", sideOffset: 8, className: "w-64", children: _jsx(BulkActionItems, { ...props }) })] }));
}
/**
 * Exposes bulk count, categorization, secondary actions, and close control on mobile.
 * @example `<MobileBulkSelectionActions selectedCount={2} {...bulkActionProps} />`
 */
export function MobileBulkSelectionActions(props) {
    const { t } = useTranslation();
    return (_jsxs("div", { className: "flex w-full items-center gap-1.5 sm:hidden", children: [_jsx("span", { className: "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary", children: props.selectedCount }), _jsx(BulkCategoryPicker, { ...props }), _jsx(BulkActionsMenu, { ...props }), _jsx("button", { type: "button", onClick: props.onClear, className: "shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted/60 hover:text-foreground", "aria-label": t('common.close', 'Close'), children: _jsx(X, { size: 16 }) })] }));
}
