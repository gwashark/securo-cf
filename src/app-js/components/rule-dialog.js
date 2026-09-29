import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getAccountName, sortAccountsByDisplayName } from '../lib/account-utils.js';
import { isInvalidDescriptionAction, parseRulePriority, previewableActions } from '../lib/rule-form-utils.js';
import { rules as rulesApi } from '../lib/api.js';
import { formatCurrency } from '../lib/format.js';
import { useDisplayLocale, useDateLocale } from '../hooks/use-display-locale.js';
import { usePrivacyMode } from '../hooks/use-privacy-mode.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { Button } from './ui/button.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from './ui/dialog.js';
import { X, Plus, ChevronDown, Eye, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils.js';
import { CategorySelect } from './category-select.js';
import { flattenConditions, isConditionGroup } from '../lib/rule-conditions.js';
const CONDITION_FIELDS = [
    { value: 'description', label: 'rules.fieldDescription' },
    { value: 'payee', label: 'rules.fieldRawPayee' },
    { value: 'notes', label: 'rules.fieldNotes' },
    { value: 'amount', label: 'rules.fieldAmount' },
    { value: 'type', label: 'rules.fieldType' },
    { value: 'account_id', label: 'rules.fieldAccount' },
    { value: 'payee_id', label: 'rules.fieldPayee' },
    { value: 'date', label: 'rules.fieldDate' },
    { value: 'status', label: 'rules.fieldStatus' },
];
const STRING_OPS = [
    { value: 'contains', label: 'rules.opContains' },
    { value: 'not_contains', label: 'rules.opNotContains' },
    { value: 'equals', label: 'rules.opEquals' },
    { value: 'not_equals', label: 'rules.opNotEquals' },
    { value: 'starts_with', label: 'rules.opStartsWith' },
    { value: 'ends_with', label: 'rules.opEndsWith' },
    { value: 'regex', label: 'rules.opRegex' },
];
const NUMERIC_OPS = [
    { value: 'equals', label: '=' },
    { value: 'gt', label: '>' },
    { value: 'gte', label: '>=' },
    { value: 'lt', label: '<' },
    { value: 'lte', label: '<=' },
];
function getOpsForField(field) {
    if (field === 'amount' || field === 'date')
        return NUMERIC_OPS;
    if (field === 'type')
        return [{ value: 'equals', label: 'rules.opIs' }];
    if (field === 'payee_id' || field === 'account_id' || field === 'status')
        return [
            { value: 'equals', label: 'rules.opIs' },
            { value: 'not_equals', label: 'rules.opIsNot' },
        ];
    return STRING_OPS;
}
function defaultValueForField(field) {
    if (field === 'type')
        return 'debit';
    if (field === 'status')
        return 'pending';
    return '';
}
function newCondition() {
    return { field: 'description', op: 'contains', value: '' };
}
/** Apply one edit to a leaf, resetting op/value when the field changes. */
function applyLeafChange(condition, key, val) {
    if (key !== 'field')
        return { ...condition, [key]: val };
    return {
        ...condition,
        field: String(val),
        op: getOpsForField(String(val))[0].value,
        value: defaultValueForField(String(val)),
    };
}
const SELECT_CLASS = 'border border-border rounded-lg px-2 py-1.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary';
/** AND/OR switch, used for the rule itself and for each nested group. */
function OpToggle({ value, onChange }) {
    const { t } = useTranslation();
    return (_jsx("div", { className: "flex items-center gap-1 bg-muted rounded-lg p-0.5", children: ['and', 'or'].map(op => (_jsx("button", { type: "button", className: cn('px-3 py-1 text-xs font-semibold rounded-md transition-all', value === op ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'), onClick: () => onChange(op), children: op === 'and' ? t('rules.andOp') : t('rules.orOp') }, op))) }));
}
function ConditionRow({ condition, accounts, payees, onChange, onRemove, }) {
    const { t } = useTranslation();
    return (_jsxs("div", { className: "relative grid min-w-0 grid-cols-2 gap-2 pr-7 sm:flex sm:items-center sm:pr-0", children: [_jsx("select", { className: `${SELECT_CLASS} w-full sm:w-32 sm:shrink-0`, value: condition.field, onChange: (e) => onChange('field', e.target.value), children: CONDITION_FIELDS.map(f => (_jsx("option", { value: f.value, children: t(f.label) }, f.value))) }), _jsx("select", { className: `${SELECT_CLASS} w-full sm:w-32 sm:shrink-0`, value: condition.op, onChange: (e) => onChange('op', e.target.value), children: getOpsForField(condition.field).map(o => (_jsx("option", { value: o.value, children: t(o.label) }, o.value))) }), condition.field === 'type' ? (_jsxs("select", { className: `${SELECT_CLASS} col-span-2 w-full min-w-0 sm:w-0 sm:flex-1`, value: String(condition.value), onChange: (e) => onChange('value', e.target.value), children: [_jsx("option", { value: "debit", children: t('rules.typeExpense') }), _jsx("option", { value: "credit", children: t('rules.typeIncome') })] })) : condition.field === 'status' ? (_jsxs("select", { className: `${SELECT_CLASS} col-span-2 w-full min-w-0 sm:w-0 sm:flex-1`, value: String(condition.value), onChange: (e) => onChange('value', e.target.value), children: [_jsx("option", { value: "pending", children: t('rules.statusPending') }), _jsx("option", { value: "posted", children: t('rules.statusPosted') })] })) : condition.field === 'account_id' ? (_jsxs("select", { className: `${SELECT_CLASS} col-span-2 w-full min-w-0 sm:w-0 sm:flex-1`, value: String(condition.value), onChange: (e) => onChange('value', e.target.value), children: [_jsx("option", { value: "", children: t('rules.selectAccount') }), accounts.map(acc => (_jsx("option", { value: acc.id, children: getAccountName(acc) }, acc.id)))] })) : condition.field === 'payee_id' ? (_jsxs("select", { className: `${SELECT_CLASS} col-span-2 w-full min-w-0 sm:w-0 sm:flex-1`, value: String(condition.value), onChange: (e) => onChange('value', e.target.value), children: [_jsx("option", { value: "", children: t('rules.selectPayee') }), payees.map(p => (_jsx("option", { value: p.id, children: p.name }, p.id)))] })) : (_jsx(Input, { className: "col-span-2 h-8 w-full min-w-0 text-sm sm:w-0 sm:flex-1", value: String(condition.value), onChange: (e) => onChange('value', e.target.value), placeholder: condition.field === 'amount' ? '0.00' : condition.field === 'date' ? 'YYYY-MM-DD' : t('rules.valuePlaceholder'), type: condition.field === 'amount' ? 'number' : condition.field === 'date' ? 'date' : 'text' })), _jsx("button", { type: "button", className: "absolute right-0 top-1 shrink-0 p-1 text-muted-foreground transition-colors hover:text-rose-500 sm:static", onClick: onRemove, children: _jsx(X, { size: 13 }) })] }));
}
/** Rows per preview request. Each one re-evaluates the whole ledger, so the
 * page is large enough that reading through a broad rule's matches is a few
 * requests rather than dozens. The API caps it at 100. */
const PREVIEW_PAGE_SIZE = 50;
/** Collapsible "what would this rule do?" panel.
 *
 * Matching runs on the backend against the same engine that applies rules, so
 * the table shows exactly what saving the draft would produce — including the
 * transactions it matches but leaves untouched because they already have a
 * category. The counts cover every match; the table is one window of them at a
 * time, so a broad rule — the kind this panel exists to catch before it is
 * saved — can be read through rather than judged by its first screenful. Any
 * edit to the draft collapses the panel rather than leaving a stale table on
 * screen.
 */
function RulePreviewPanel({ conditionsOp, conditions, actions, isActive, applyToExisting, overwriteExistingCategories, disabled, open, onOpenChange, }) {
    const { t } = useTranslation();
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const { mask } = usePrivacyMode();
    // A half-filled action row is a draft in progress, not a rule to reject, so
    // it is left out of the request the backend validates.
    const draftActions = useMemo(() => previewableActions(actions), [actions]);
    // Keyed on the whole draft, so flipping a flag refetches while the panel
    // stays open — and a slower response for a previous draft can never land on
    // top of the current one. Paged, because a rule matching four figures of
    // transactions is one worth reading past the first page of.
    const preview = useInfiniteQuery({
        queryKey: [
            'rule-preview', conditionsOp, conditions, draftActions,
            isActive, applyToExisting, overwriteExistingCategories,
        ],
        queryFn: ({ pageParam }) => rulesApi.preview({
            conditions_op: conditionsOp,
            conditions,
            actions: draftActions,
            is_active: isActive,
            apply_to_existing: applyToExisting,
            overwrite_existing_categories: overwriteExistingCategories,
            limit: PREVIEW_PAGE_SIZE,
            offset: pageParam,
        }),
        initialPageParam: 0,
        // The counts are exact whatever window came back, so what is already on
        // screen is the offset of the next page.
        getNextPageParam: (lastPage, pages) => {
            const shown = pages.reduce((total, page) => total + page.sample.length, 0);
            return shown < lastPage.matched ? shown : undefined;
        },
        enabled: open,
        staleTime: Infinity,
        gcTime: 0,
    });
    // Editing the rule itself collapses the panel rather than leaving a table
    // that describes a draft the user has moved on from. The flags don't: their
    // whole point is watching the numbers move.
    useEffect(() => {
        onOpenChange(false);
    }, [conditionsOp, conditions, actions, onOpenChange]);
    // Every page carries the same counts; the rows accumulate.
    const data = preview.data?.pages[0];
    const sample = useMemo(() => preview.data?.pages.flatMap(page => page.sample) ?? [], [preview.data]);
    return (_jsxs("div", { className: "rounded-lg border border-border", children: [_jsxs("button", { type: "button", disabled: disabled, "aria-expanded": open, className: "flex w-full items-center justify-between gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50", onClick: () => onOpenChange(!open), children: [_jsxs("span", { className: "flex items-center gap-1.5 font-medium", children: [_jsx(Eye, { size: 13 }), " ", t('rules.preview')] }), _jsxs("span", { className: "flex items-center gap-2 text-xs text-muted-foreground", children: [data && t('rules.previewMatched', { matched: data.matched }), _jsx(ChevronDown, { size: 14, className: cn('transition-transform', open && 'rotate-180') })] })] }), open && (_jsx("div", { className: "border-t border-border p-3", children: preview.isError ? (_jsx("p", { className: "text-xs text-rose-500", children: t('rules.previewError') })) : /* also while a flag change is being recomputed: the old numbers
                       no longer describe the flags now on screen. Fetching a further
                       page is not that — those rows are appended to a table that is
                       still current. */
                    !data || (preview.isFetching && !preview.isFetchingNextPage) ? (_jsx("p", { className: "text-xs text-muted-foreground", children: t('common.loading') })) : data.matched === 0 ? (_jsx("p", { className: "text-xs text-muted-foreground", children: t('rules.previewEmpty') })) : (_jsxs("div", { className: "space-y-2", children: [_jsxs("p", { className: "text-xs text-muted-foreground", children: [t('rules.previewSummary', { matched: data.matched, changed: data.will_change }), !data.will_apply && (_jsxs(_Fragment, { children: [" \u00B7 ", _jsx("span", { className: "font-medium text-amber-600 dark:text-amber-400", children: isActive ? t('rules.previewNotAppliedToExisting') : t('rules.previewInactive') })] })), sample.length < data.matched && (_jsxs(_Fragment, { children: [" \u00B7 ", t('rules.previewSampleNote', { shown: sample.length })] }))] }), _jsx("div", { className: "max-h-56 overflow-y-auto overflow-x-auto", children: _jsxs("table", { className: "w-full text-xs", children: [_jsx("thead", { className: "sticky top-0 bg-card text-muted-foreground", children: _jsxs("tr", { className: "border-b border-border text-left", children: [_jsx("th", { className: "py-1.5 pr-2 font-medium", children: t('transactions.date') }), _jsx("th", { className: "py-1.5 pr-2 font-medium", children: t('transactions.description') }), _jsx("th", { className: "py-1.5 pr-2 text-right font-medium", children: t('transactions.amount') }), _jsx("th", { className: "py-1.5 font-medium", children: t('transactions.category') })] }) }), _jsx("tbody", { className: "divide-y divide-border", children: sample.map(item => (_jsxs("tr", { className: cn(!item.will_change && 'text-muted-foreground'), children: [_jsx("td", { className: "whitespace-nowrap py-1.5 pr-2 tabular-nums", children: new Date(item.date + 'T00:00:00').toLocaleDateString(dateLocale) }), _jsx("td", { className: "max-w-[22rem] truncate py-1.5 pr-2", title: item.description, children: item.description }), _jsx("td", { className: cn('whitespace-nowrap py-1.5 pr-2 text-right tabular-nums', item.will_change && item.type === 'credit' && 'text-emerald-600'), children: mask(formatCurrency(Math.abs(item.amount), item.currency, locale)) }), _jsx("td", { className: "py-1.5", children: item.will_change ? (_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: "truncate", children: item.current_category_name ?? t('transactions.uncategorized') }), _jsx(ArrowRight, { size: 11, className: "shrink-0 text-muted-foreground" }), _jsx("span", { className: "truncate font-medium text-emerald-600", children: item.new_category_name ?? t('transactions.uncategorized') })] })) : (_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: "truncate", children: item.current_category_name ?? t('transactions.uncategorized') }), _jsx("span", { className: "shrink-0 rounded-full bg-muted px-1.5 text-[10px] font-semibold", children: t('rules.previewNoChange') })] })) })] }, item.id))) })] }) }), preview.hasNextPage && (_jsx("button", { type: "button", className: "w-full rounded-md border border-border py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50", disabled: preview.isFetchingNextPage, onClick: () => preview.fetchNextPage(), children: preview.isFetchingNextPage
                                    ? t('common.loading')
                                    : t('rules.previewLoadMore', {
                                        more: Math.min(PREVIEW_PAGE_SIZE, data.matched - sample.length),
                                    }) }))] })) }))] }));
}
export function RuleDialog({ open, onClose, rule, categories, categoryGroups, currentCategories = [], accounts, payees, onSave, loading, initialData, }) {
    const { t } = useTranslation();
    const sortedAccounts = useMemo(() => sortAccountsByDisplayName(accounts), [accounts]);
    const defaultConditions = initialData?.conditions ?? rule?.conditions ?? [newCondition()];
    const defaultActions = initialData?.actions ?? rule?.actions ?? [{ op: 'set_category', value: '' }];
    const [name, setName] = useState(initialData?.name ?? rule?.name ?? '');
    const [conditionsOp, setConditionsOp] = useState(rule?.conditions_op ?? 'and');
    const [conditions, setConditions] = useState(defaultConditions.length ? defaultConditions : [newCondition()]);
    const [actions, setActions] = useState(defaultActions.length ? defaultActions : [{ op: 'set_category', value: '' }]);
    const [priority, setPriority] = useState(String(rule?.priority ?? 0));
    // Read, never written here: the row owns the switch. Kept so an edit
    // preserves the rule's own state instead of resetting it to on, and so
    // the preview can still say "this will match, but the rule is off".
    const [isActive] = useState(rule?.is_active ?? true);
    const [applyToExisting, setApplyToExisting] = useState(initialData?.applyToExisting ?? !rule);
    const [overwriteExistingCategories, setOverwriteExistingCategories] = useState(initialData?.overwriteExistingCategories ?? false);
    const [previewOpen, setPreviewOpen] = useState(false);
    function updateCondition(i, field, val) {
        setConditions(prev => prev.map((node, idx) => (idx === i && !isConditionGroup(node) ? applyLeafChange(node, field, val) : node)));
    }
    function removeCondition(i) {
        setConditions(prev => prev.filter((_, idx) => idx !== i));
    }
    function addCondition() {
        setConditions(prev => [...prev, newCondition()]);
    }
    // A group starts with two conditions: one alone would carry no AND/OR meaning.
    function addGroup() {
        setConditions(prev => [...prev, { op: 'or', conditions: [newCondition(), newCondition()] }]);
    }
    function setGroupOp(i, op) {
        setConditions(prev => prev.map((node, idx) => (idx === i && isConditionGroup(node) ? { ...node, op } : node)));
    }
    function addGroupCondition(i) {
        setConditions(prev => prev.map((node, idx) => (idx === i && isConditionGroup(node)
            ? { ...node, conditions: [...node.conditions, newCondition()] }
            : node)));
    }
    function updateGroupCondition(i, j, field, val) {
        setConditions(prev => prev.map((node, idx) => {
            if (idx !== i || !isConditionGroup(node))
                return node;
            return {
                ...node,
                conditions: node.conditions.map((c, cIdx) => (cIdx === j ? applyLeafChange(c, field, val) : c)),
            };
        }));
    }
    // Removing a group's last condition removes the group — an empty one never
    // matches anything and the API rejects it.
    function removeGroupCondition(i, j) {
        setConditions(prev => prev.flatMap((node, idx) => {
            if (idx !== i || !isConditionGroup(node))
                return [node];
            const remaining = node.conditions.filter((_, cIdx) => cIdx !== j);
            return remaining.length ? [{ ...node, conditions: remaining }] : [];
        }));
    }
    function updateAction(i, field, val) {
        setActions(prev => prev.map((a, idx) => {
            if (idx !== i)
                return a;
            const next = { ...a, [field]: val };
            if (field === 'op')
                next.value = '';
            return next;
        }));
    }
    function removeAction(i) {
        setActions(prev => prev.filter((_, idx) => idx !== i));
    }
    function addAction() {
        setActions(prev => [...prev, { op: 'set_category', value: '' }]);
    }
    // A blank condition value matches every transaction, so the rule would apply
    // its actions to the whole ledger. The API rejects these too.
    const hasBlankCondition = flattenConditions(conditions).some(c => String(c.value ?? '').trim() === '');
    const hasInvalidDescriptionAction = actions.some(isInvalidDescriptionAction);
    function handleSubmit(e) {
        e.preventDefault();
        // Dialog renders its content through a portal, but React still bubbles
        // events along the component tree rather than the DOM tree, so without
        // this the submit would also reach the transaction form wrapping this
        // dialog and trigger an unrelated save of it.
        e.stopPropagation();
        if (hasBlankCondition || hasInvalidDescriptionAction)
            return;
        onSave({
            name,
            conditions_op: conditionsOp,
            conditions,
            actions,
            priority: parseRulePriority(priority),
            is_active: isActive,
            apply_to_existing: applyToExisting,
            overwrite_existing_categories: applyToExisting && overwriteExistingCategories,
        });
    }
    return (_jsx(Dialog, { open: open, onOpenChange: onClose, children: _jsxs(DialogContent, { "aria-describedby": undefined, className: cn(
            // The preview table needs room to breathe, so the dialog widens while
            // it is expanded — same idiom as the transaction dialog's preview pane.
            'max-h-[90vh] overflow-y-auto overflow-x-hidden transition-[max-width] duration-300', previewOpen ? 'sm:max-w-5xl max-w-2xl' : 'sm:max-w-2xl max-w-2xl'), children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: rule ? t('rules.editRule') : t('rules.newRule') }) }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-5", children: [_jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsxs("div", { className: "col-span-2 space-y-1.5", children: [_jsx(Label, { children: t('rules.name') }), _jsx(Input, { value: name, onChange: (e) => setName(e.target.value), required: true, placeholder: "Ex: Uber" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: t('rules.priority') }), _jsx(Input, { type: "number", step: "1", value: priority, onChange: (e) => setPriority(e.target.value), onBlur: () => {
                                                if (priority.trim() === '' || !Number.isFinite(Number(priority))) {
                                                    setPriority('0');
                                                }
                                            } })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Label, { children: t('rules.conditions') }), _jsx(OpToggle, { value: conditionsOp, onChange: setConditionsOp })] }), _jsxs("div", { className: "space-y-2", children: [conditions.map((node, i) => (isConditionGroup(node) ? (_jsxs("div", { className: "rounded-lg border border-border bg-muted/40 p-2 space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { className: "text-xs font-medium text-muted-foreground", children: t('rules.group') }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(OpToggle, { value: node.op, onChange: (op) => setGroupOp(i, op) }), _jsx("button", { type: "button", className: "shrink-0 p-1 text-muted-foreground transition-colors hover:text-rose-500", title: t('rules.removeGroup'), onClick: () => removeCondition(i), children: _jsx(X, { size: 13 }) })] })] }), node.conditions.map((cond, j) => (_jsx(ConditionRow, { condition: cond, accounts: sortedAccounts, payees: payees, onChange: (field, val) => updateGroupCondition(i, j, field, val), onRemove: () => removeGroupCondition(i, j) }, j))), _jsxs("button", { type: "button", className: "text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1", onClick: () => addGroupCondition(i), children: [_jsx(Plus, { size: 12 }), " ", t('rules.addCondition')] })] }, i)) : (_jsx(ConditionRow, { condition: node, accounts: sortedAccounts, payees: payees, onChange: (field, val) => updateCondition(i, field, val), onRemove: () => removeCondition(i) }, i)))), hasBlankCondition && (_jsx("p", { className: "text-xs text-rose-500", children: t('rules.blankConditionValue') })), _jsxs("div", { className: "flex flex-wrap items-center gap-4", children: [_jsxs("button", { type: "button", className: "text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1", onClick: addCondition, children: [_jsx(Plus, { size: 12 }), " ", t('rules.addCondition')] }), _jsxs("button", { type: "button", className: "text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1", title: t('rules.addGroupHint'), onClick: addGroup, children: [_jsx(Plus, { size: 12 }), " ", t('rules.addGroup')] })] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('rules.actions') }), _jsxs("div", { className: "space-y-2", children: [actions.map((action, i) => {
                                            const invalidDescription = isInvalidDescriptionAction(action);
                                            return (_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "relative grid min-w-0 gap-2 pr-7 sm:flex sm:items-center sm:pr-0", children: [_jsxs("select", { className: `${SELECT_CLASS} w-full sm:w-40 sm:shrink-0`, value: action.op, onChange: (e) => updateAction(i, 'op', e.target.value), children: [_jsx("option", { value: "set_category", children: t('rules.setCategory') }), _jsx("option", { value: "set_description", children: t('rules.setDescription') }), _jsx("option", { value: "set_payee", children: t('rules.setPayee') }), _jsx("option", { value: "append_notes", children: t('rules.appendNotes') }), _jsx("option", { value: "ignore", children: t('rules.ignoreAction') })] }), action.op === 'ignore' ? (_jsx("span", { className: "min-w-0 text-sm italic text-muted-foreground sm:w-0 sm:flex-1", children: t('rules.ignoreActionHint') })) : action.op === 'set_category' ? (_jsx("div", { className: "w-full min-w-0 sm:w-0 sm:flex-1", children: _jsx(CategorySelect, { value: action.value, onChange: (val) => updateAction(i, 'value', val), categories: categories, groups: categoryGroups, currentCategory: currentCategories.find((category) => category.id === action.value), placeholder: t('rules.selectCategory'), creatable: true, className: `${SELECT_CLASS} w-full` }) })) : action.op === 'set_payee' ? (_jsxs("select", { className: `${SELECT_CLASS} w-full min-w-0 sm:w-0 sm:flex-1`, value: action.value, onChange: (e) => updateAction(i, 'value', e.target.value), required: true, children: [_jsx("option", { value: "", children: t('rules.selectPayee') }), payees.map(p => (_jsx("option", { value: p.id, children: p.name }, p.id)))] })) : (_jsx(Input, { className: "h-8 w-full min-w-0 text-sm aria-invalid:border-input aria-invalid:ring-0 dark:aria-invalid:ring-0 sm:w-0 sm:flex-1", value: action.value, onChange: (e) => updateAction(i, 'value', e.target.value), placeholder: action.op === 'set_description'
                                                                    ? t('rules.descriptionValuePlaceholder')
                                                                    : t('rules.notesValuePlaceholder'), maxLength: action.op === 'set_description' ? 500 : undefined, required: action.op === 'set_description', "aria-invalid": invalidDescription || undefined, "aria-describedby": invalidDescription ? `action-${i}-description-error` : undefined })), _jsx("button", { type: "button", className: "absolute right-0 top-1 shrink-0 p-1 text-muted-foreground transition-colors hover:text-rose-500 sm:static", onClick: () => removeAction(i), children: _jsx(X, { size: 13 }) })] }), invalidDescription && (_jsx("p", { id: `action-${i}-description-error`, className: "text-xs text-rose-500", children: t('rules.invalidDescriptionValue') }))] }, i));
                                        }), _jsxs("button", { type: "button", className: "text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1", onClick: addAction, children: [_jsx(Plus, { size: 12 }), " ", t('rules.addAction')] })] })] }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: applyToExisting, onChange: (e) => setApplyToExisting(e.target.checked), className: "h-4 w-4 rounded border-border" }), _jsx("span", { className: "text-sm text-foreground", children: t('rules.applyToExisting', 'Apply matching actions to existing transactions') })] }), applyToExisting && (_jsxs("label", { className: "flex items-center gap-2 cursor-pointer pl-6", children: [_jsx("input", { type: "checkbox", checked: overwriteExistingCategories, onChange: (e) => setOverwriteExistingCategories(e.target.checked), className: "h-4 w-4 rounded border-border" }), _jsx("span", { className: "text-sm text-foreground", children: t('rules.overwriteExistingCategories', 'Also replace existing categories') })] })), _jsx(RulePreviewPanel, { conditionsOp: conditionsOp, conditions: conditions, actions: actions, isActive: isActive, applyToExisting: applyToExisting, overwriteExistingCategories: overwriteExistingCategories, disabled: hasBlankCondition || conditions.length === 0, open: previewOpen, onOpenChange: setPreviewOpen }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: onClose, children: t('common.cancel') }), _jsx(Button, { type: "submit", disabled: loading || hasBlankCondition, children: loading ? t('common.loading') : t('common.save') })] })] }, rule?.id ?? 'new')] }) }));
}
