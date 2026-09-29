import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categories as categoriesApi, categoryGroups as categoryGroupsApi, rules as rulesApi, accounts as accountsApi, payees as payeesApi } from '../lib/api.js';
import { extractApiError } from '../lib/api-errors.js';
import { invalidateFinancialQueries } from '../lib/invalidate-queries.js';
import { toast } from 'sonner';
import { Button } from '../components/ui/button.js';
import { DeleteConfirmationDialog } from '../components/delete-confirmation-dialog.js';
import { Label } from '../components/ui/label.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, } from '../components/ui/dialog.js';
import { isConditionGroup } from '../lib/rule-conditions.js';
import { normalizeRuleMatchValue, ruleSearchText } from '../lib/rule-match-utils.js';
import { Trash2, Plus, RefreshCw, Package, Check, ArrowUpDown, ArrowUp, ArrowDown, Download, Upload, Search, Power } from 'lucide-react';
import { cn } from '../lib/utils.js';
import { PageHeader } from '../components/page-header.js';
import { useWorkspace } from '../contexts/workspace-context.js';
import { RuleDialog } from '../components/rule-dialog.js';
import { ReconciliationRules } from '../components/reconciliation-rules.js';
import { ReconciliationQueue } from '../components/reconciliation-queue.js';
import { ReconciliationHistory } from '../components/reconciliation-history.js';
import { Segmented } from '../components/invoice-ui.js';
import { reconciliation as reconciliationApi } from '../lib/api.js';
import { findCategoryReference, getRuleCategoryName } from '../lib/category-reference-utils.js';
function SectionCard({ children }) {
    return (_jsx("div", { className: "bg-card rounded-xl border border-border shadow-sm overflow-hidden", children: children }));
}
function SectionHeader({ title, hint, action, }) {
    return (_jsxs("div", { className: "px-4 sm:px-5 py-4 border-b border-border flex flex-wrap items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: title }), hint && _jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: hint })] }), action] }));
}
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
function conditionSummary(conditions, conditionsOp, t, payeesList) {
    const fieldLabel = (f) => {
        const key = CONDITION_FIELDS.find(x => x.value === f)?.label;
        return key ? t(key) : f;
    };
    const opLabel = (f, op) => {
        const key = getOpsForField(f).find(x => x.value === op)?.label;
        return key ? t(key) : op;
    };
    const valueLabel = (c) => {
        if (c.field === 'payee_id') {
            const p = payeesList.find(p => p.id === c.value);
            return p ? p.name : String(c.value);
        }
        if (c.field === 'status') {
            if (c.value === 'pending')
                return t('rules.statusPending');
            if (c.value === 'posted')
                return t('rules.statusPosted');
        }
        return String(c.value);
    };
    const leafSummary = (c) => `${fieldLabel(c.field)} ${opLabel(c.field, c.op)} "${valueLabel(c)}"`;
    const joiner = (op) => ` ${op === 'or' ? t('rules.orOp') : t('rules.andOp')} `;
    // Groups get parentheses so a mixed AND/OR rule reads unambiguously.
    const parts = conditions.map(node => (isConditionGroup(node)
        ? `(${node.conditions.map(leafSummary).join(joiner(node.op))})`
        : leafSummary(node)));
    return parts.join(joiner(conditionsOp)) || t('rules.noConditions');
}
function actionSummary(actions, categories, payeesList, t) {
    return actions.map(a => {
        if (a.op === 'set_category') {
            const cat = findCategoryReference(categories, a.value);
            return cat ? `→ ${cat.name}` : `→ ${t('transactions.category')}`;
        }
        if (a.op === 'set_payee') {
            const p = payeesList.find(p => p.id === a.value);
            return p ? `→ ${t('payees.payee')}: ${p.name}` : `→ ${t('payees.payee')}`;
        }
        if (a.op === 'set_description') {
            return `→ ${t('rules.fieldDescription')}: ${a.value}`;
        }
        if (a.op === 'append_notes')
            return `→ ${t('rules.fieldNotes')}: ${a.value}`;
        if (a.op === 'ignore')
            return `→ ${t('rules.ignoreAction')}`;
        return a.op;
    }).join('  ') || t('rules.noActions');
}
const ACTION_FILTERS = [
    { value: 'set_category', label: 'rules.setCategory' },
    { value: 'set_description', label: 'rules.setDescription' },
    { value: 'set_payee', label: 'rules.setPayee' },
    { value: 'append_notes', label: 'rules.appendNotes' },
    { value: 'ignore', label: 'rules.ignoreAction' },
];
const FILTER_CONTROL_CLASS = 'h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]';
export default function RulesPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { canWrite } = useWorkspace();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [packsDialogOpen, setPacksDialogOpen] = useState(false);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [pendingImport, setPendingImport] = useState(null);
    const [pendingImportName, setPendingImportName] = useState('');
    const importInputRef = useRef(null);
    const [editing, setEditing] = useState(null);
    const [deletingRule, setDeletingRule] = useState(null);
    // Bumped on every open so the dialog remounts with fresh state instead of
    // retaining the previously entered rule (issue #306).
    const [dialogInstance, setDialogInstance] = useState(0);
    function openCreate() {
        setEditing(null);
        setDialogInstance((n) => n + 1);
        setDialogOpen(true);
    }
    function openEdit(rule) {
        setEditing(rule);
        setDialogInstance((n) => n + 1);
        setDialogOpen(true);
    }
    const { data: rulesList } = useQuery({
        queryKey: ['rules'],
        queryFn: rulesApi.list,
    });
    const { data: categoriesList } = useQuery({
        queryKey: ['categories'],
        queryFn: categoriesApi.list,
    });
    const { data: allCategoriesList } = useQuery({
        queryKey: ['categories', 'management'],
        queryFn: categoriesApi.listIncludingHidden,
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
    const createMutation = useMutation({
        mutationFn: (data) => rulesApi.create(data),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['rules'] });
            queryClient.invalidateQueries({ queryKey: ['rule-packs'] });
            setDialogOpen(false);
            // The rule was applied to existing transactions on creation; refresh
            // financial views and report how many were affected for transparency.
            const applied = result.applied_count ?? 0;
            if (applied > 0) {
                invalidateFinancialQueries(queryClient);
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
    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }) => rulesApi.update(id, data),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['rules'] });
            queryClient.invalidateQueries({ queryKey: ['rule-packs'] });
            setDialogOpen(false);
            setEditing(null);
            const applied = result.applied_count ?? 0;
            if (applied > 0) {
                invalidateFinancialQueries(queryClient);
                queryClient.invalidateQueries({ queryKey: ['payees'] });
                toast.success(t('rules.updatedAndApplied', { count: applied }));
            }
            else {
                toast.success(t('rules.updated'));
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
    // Flipping the switch, and nothing else.
    //
    // Turning a rule on through the editor also runs it over transactions
    // already filed, which is the right default when you have just
    // finished writing the rule. It is the wrong default for one click on
    // an icon: nothing on screen warned that months of categories were
    // about to be rewritten. So the row does the smaller act, and catching
    // up stays explicit: the editor's own checkbox, or "Reset and
    // reapply" in the header.
    const toggleMutation = useMutation({
        mutationFn: (rule) => rulesApi.update(rule.id, { is_active: !rule.is_active, apply_to_existing: false }),
        onSuccess: (_result, rule) => {
            queryClient.invalidateQueries({ queryKey: ['rules'] });
            toast.success(t(rule.is_active ? 'rules.turnedOff' : 'rules.turnedOn'));
        },
        onError: (err) => {
            toast.error(extractApiError(err, t('common.error')));
        },
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => rulesApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rules'] });
            queryClient.invalidateQueries({ queryKey: ['rule-packs'] });
            setDeletingRule(null);
            toast.success(t('rules.deleted'));
        },
        onError: (err) => {
            toast.error(extractApiError(err, t('common.error')));
        },
    });
    const applyAllMutation = useMutation({
        mutationFn: () => rulesApi.applyAll(),
        onSuccess: (data) => {
            invalidateFinancialQueries(queryClient);
            queryClient.invalidateQueries({ queryKey: ['payees'] });
            toast.success(t('rules.applied', { count: data.applied }));
        },
        onError: () => toast.error(t('common.error')),
    });
    const exportMutation = useMutation({
        mutationFn: () => rulesApi.exportFile(),
        onSuccess: () => toast.success(t('rules.exported')),
        onError: () => toast.error(t('common.error')),
    });
    const importMutation = useMutation({
        mutationFn: (payload) => rulesApi.importFile(payload, true),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['rules'] });
            queryClient.invalidateQueries({ queryKey: ['rule-packs'] });
            setImportDialogOpen(false);
            setPendingImport(null);
            setPendingImportName('');
            toast.success(t('rules.imported', { imported: data.imported, skipped: data.skipped }));
        },
        onError: () => toast.error(t('common.error')),
    });
    async function handleImportFile(file) {
        try {
            const parsed = JSON.parse(await file.text());
            if (parsed.format !== 'securo-categorization-rules' || !Array.isArray(parsed.rules)) {
                toast.error(t('rules.invalidImportFile'));
                return;
            }
            setPendingImport(parsed);
            setPendingImportName(file.name);
            setImportDialogOpen(true);
        }
        catch {
            toast.error(t('rules.invalidImportFile'));
        }
        finally {
            if (importInputRef.current)
                importInputRef.current.value = '';
        }
    }
    const categories = useMemo(() => categoriesList ?? [], [categoriesList]);
    const displayCategories = useMemo(() => allCategoriesList ?? categoriesList ?? [], [allCategoriesList, categoriesList]);
    const payees = useMemo(() => payeesList ?? [], [payeesList]);
    const [sortBy, setSortBy] = useState('priority');
    const [sortDir, setSortDir] = useState('asc');
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterAction, setFilterAction] = useState('');
    const hasFilters = !!(search || filterCategory || filterStatus || filterAction);
    function clearFilters() {
        setSearch('');
        setFilterCategory('');
        setFilterStatus('');
        setFilterAction('');
    }
    const filteredRules = useMemo(() => {
        const query = normalizeRuleMatchValue(search);
        return (rulesList ?? []).filter(rule => {
            // displayCategories, not categories: the row and the sort already read
            // from it, so a rule assigning a hidden category shows that name.
            // Searching over the visible-only list made that rule unfindable by the
            // very name on screen.
            if (query && !ruleSearchText(rule, displayCategories).includes(query))
                return false;
            if (filterCategory && !rule.actions.some(a => a.op === 'set_category' && a.value === filterCategory))
                return false;
            if (filterStatus === 'active' && !rule.is_active)
                return false;
            if (filterStatus === 'inactive' && rule.is_active)
                return false;
            if (filterAction && !rule.actions.some(a => a.op === filterAction))
                return false;
            return true;
        });
    }, [rulesList, displayCategories, search, filterCategory, filterStatus, filterAction]);
    const sortedRules = useMemo(() => {
        const list = [...filteredRules];
        const dir = sortDir === 'asc' ? 1 : -1;
        if (sortBy === 'name') {
            return list.sort((a, b) => dir * a.name.localeCompare(b.name));
        }
        if (sortBy === 'category') {
            const getCategoryName = (rule) => {
                return getRuleCategoryName(rule, displayCategories) ?? '';
            };
            return list.sort((a, b) => dir * getCategoryName(a).localeCompare(getCategoryName(b)));
        }
        return list.sort((a, b) => dir * (a.priority - b.priority));
    }, [filteredRules, displayCategories, sortBy, sortDir]);
    // Three reasons to come here, not one. Rules is configuration: visited
    // when somebody wants to change behaviour. The queue is *work*, visited
    // when there is something pending. History is *audit*, visited to find
    // out what happened. Burying work inside a configuration page meant only
    // people who came to configure something ever discovered they had any.
    // Matching used to serve only sets that belonged to a module, so a
    // personal workspace had no rules here, no queue and no history, and
    // the tabs were hidden rather than left empty. Transfer pairing
    // changed that: it runs for everybody, it has always run, and it is
    // now written down where its owner can read it. So there is no
    // workspace without matching any more, and nothing left to hide.
    // Addressable, because the queue is now linked to from elsewhere: a
    // badge on a transaction row is a promise to land on the question, and
    // landing on the rules list instead would break it.
    const [searchParams, setSearchParams] = useSearchParams();
    const requested = searchParams.get('tab');
    const asked = requested === 'queue' || requested === 'history' ? requested : 'rules';
    const tab = asked;
    const setTab = (next) => {
        // `replace`, so the back button leaves the page rather than walking
        // back through tabs somebody clicked on the way.
        setSearchParams(next === 'rules' ? {} : { tab: next }, { replace: true });
    };
    // Fetched here rather than inside the queue so the count can sit on the
    // tab: a queue nobody can see is not a queue.
    const { data: pending } = useQuery({
        queryKey: ['reconciliation-suggestions'],
        queryFn: reconciliationApi.suggestions,
    });
    return (_jsxs("div", { children: [_jsx(PageHeader, { section: t('rules.section'), title: t('nav.rules') }), _jsx("div", { className: "mb-4", children: _jsx(Segmented, { value: tab, onChange: setTab, testIdPrefix: "automation-tab", options: [
                        { value: 'rules', label: t('rules.tab.rules') },
                        {
                            value: 'queue',
                            // The count is rendered here rather than through Segmented's
                            // own `count`, which is a muted figure beside a filter: the
                            // right weight for "Overdue 2" and the wrong one for work
                            // waiting on somebody. This is a nudge, so it looks like
                            // one; when there is nothing waiting it disappears entirely
                            // rather than announcing a zero.
                            label: (_jsxs("span", { className: "inline-flex items-center gap-1.5", children: [t('rules.tab.queue'), !!pending?.length && (_jsx("span", { className: "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-semibold tabular-nums", children: pending.length }))] })),
                        },
                        { value: 'history', label: t('rules.tab.history') },
                    ] }) }), tab === 'queue' && _jsx(ReconciliationQueue, { canWrite: canWrite }), tab === 'history' && _jsx(ReconciliationHistory, {}), _jsxs("div", { className: tab === 'rules' ? '' : 'hidden', children: [_jsxs(SectionCard, { children: [_jsx(SectionHeader, { title: t('rules.sectionTitle'), hint: t('rules.sectionHint'), action: canWrite ? (_jsxs("div", { className: "flex gap-2", children: [_jsx("input", { ref: importInputRef, type: "file", accept: "application/json,.json", className: "hidden", onChange: (event) => {
                                                const file = event.target.files?.[0];
                                                if (file)
                                                    void handleImportFile(file);
                                            } }), _jsxs(Button, { variant: "outline", size: "sm", className: "gap-1.5 h-8", onClick: () => exportMutation.mutate(), disabled: exportMutation.isPending, children: [_jsx(Download, { size: 12 }), _jsx("span", { className: "hidden sm:inline", children: t('rules.export') })] }), _jsxs(Button, { variant: "outline", size: "sm", className: "gap-1.5 h-8", onClick: () => importInputRef.current?.click(), disabled: importMutation.isPending, children: [_jsx(Upload, { size: 12 }), _jsx("span", { className: "hidden sm:inline", children: t('rules.import') })] }), _jsxs(Button, { variant: "outline", size: "sm", className: "gap-1.5 h-8", onClick: () => setPacksDialogOpen(true), children: [_jsx(Package, { size: 12 }), _jsx("span", { className: "hidden sm:inline", children: t('rules.packs') })] }), _jsxs(Button, { variant: "outline", size: "sm", className: "gap-1.5 h-8", onClick: () => {
                                                if (window.confirm(t('rules.confirmResetAndReapplyAll', 'Reset matching transaction categories, notes, and rule-managed descriptions, then reapply all active rules?'))) {
                                                    applyAllMutation.mutate();
                                                }
                                            }, disabled: applyAllMutation.isPending, children: [_jsx(RefreshCw, { size: 12 }), _jsx("span", { className: "hidden sm:inline", children: t('rules.resetAndReapplyAll', 'Reset and reapply') })] }), _jsxs(Button, { size: "sm", className: "gap-1.5 h-8", onClick: openCreate, children: [_jsx(Plus, { size: 13 }), " ", _jsx("span", { className: "hidden sm:inline", children: t('rules.add') })] })] })) : undefined }), _jsxs("div", { className: "px-4 sm:px-5 py-2 bg-muted/50 border-b border-border flex flex-wrap items-center gap-2", children: [_jsxs("div", { className: "flex min-w-[10rem] flex-1 items-center gap-1.5", children: [_jsx(Search, { size: 14, className: "pointer-events-none shrink-0 text-muted-foreground/70" }), _jsx("input", { type: "text", value: search, onChange: (e) => setSearch(e.target.value), placeholder: t('rules.searchPlaceholder'), className: "w-full min-w-0 rounded-sm bg-transparent text-xs text-foreground focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px] placeholder:text-muted-foreground/75" })] }), _jsxs("select", { className: FILTER_CONTROL_CLASS, value: filterCategory, onChange: (e) => setFilterCategory(e.target.value), children: [_jsx("option", { value: "", children: t('rules.filterAllCategories') }), displayCategories.map(cat => (_jsx("option", { value: cat.id, children: cat.name }, cat.id)))] }), _jsxs("select", { className: FILTER_CONTROL_CLASS, value: filterStatus, onChange: (e) => setFilterStatus(e.target.value), children: [_jsx("option", { value: "", children: t('rules.filterAllStatuses') }), _jsx("option", { value: "active", children: t('rules.filterActiveOnly') }), _jsx("option", { value: "inactive", children: t('rules.filterInactiveOnly') })] }), _jsxs("select", { className: FILTER_CONTROL_CLASS, value: filterAction, onChange: (e) => setFilterAction(e.target.value), children: [_jsx("option", { value: "", children: t('rules.filterAllActions') }), ACTION_FILTERS.map(a => (_jsx("option", { value: a.value, children: t(a.label) }, a.value)))] }), hasFilters && (_jsx("button", { type: "button", onClick: clearFilters, className: "h-7 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground", children: t('transactions.clearFilters') })), _jsx("span", { className: "text-xs text-muted-foreground", children: t('rules.sortLabel') }), ['priority', 'name', 'category'].map(opt => (_jsxs("button", { onClick: () => {
                                            if (sortBy === opt)
                                                setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                                            else {
                                                setSortBy(opt);
                                                setSortDir('asc');
                                            }
                                        }, className: cn('flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors', sortBy === opt
                                            ? 'bg-background border border-border text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-background/60'), children: [t(`rules.sortBy_${opt}`), sortBy === opt
                                                ? sortDir === 'asc' ? _jsx(ArrowUp, { size: 11 }) : _jsx(ArrowDown, { size: 11 })
                                                : _jsx(ArrowUpDown, { size: 11, className: "opacity-30" })] }, opt)))] }), sortedRules.length > 0 ? (_jsx("div", { className: "divide-y divide-border", children: sortedRules.map((rule) => (_jsx("div", { className: cn('px-4 sm:px-5 py-3 hover:bg-muted transition-colors', canWrite && 'cursor-pointer'), onClick: () => { if (canWrite)
                                        openEdit(rule); }, children: _jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: rule.name }), !rule.is_active && (_jsx("span", { className: "text-[10px] font-semibold bg-muted text-muted-foreground px-1.5 py-0 rounded-full", children: t('rules.inactive') })), _jsxs("span", { className: "text-[10px] font-semibold bg-muted text-muted-foreground px-1.5 py-0 rounded-full", children: ["p:", rule.priority] })] }), _jsx("p", { className: "text-xs text-muted-foreground font-mono truncate", children: conditionSummary(rule.conditions, rule.conditions_op, t, payees) }), _jsx("p", { className: "text-xs text-emerald-600 font-medium mt-0.5", children: actionSummary(rule.actions, displayCategories, payees, t) })] }), canWrite && (_jsxs("div", { className: "flex items-center gap-1 shrink-0", children: [_jsx("button", { className: cn('p-1.5 rounded-md transition-colors hover:bg-background', rule.is_active
                                                            ? 'text-emerald-600 hover:text-emerald-700'
                                                            : 'text-muted-foreground hover:text-foreground'), onClick: (e) => { e.stopPropagation(); toggleMutation.mutate(rule); }, disabled: toggleMutation.isPending, title: t(rule.is_active ? 'rules.turnOff' : 'rules.turnOn'), children: _jsx(Power, { size: 13 }) }), _jsx("button", { className: "p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-50 transition-colors", onClick: (e) => { e.stopPropagation(); setDeletingRule(rule); }, disabled: deleteMutation.isPending, title: t('common.delete'), children: _jsx(Trash2, { size: 13 }) })] }))] }) }, rule.id))) })) : (_jsx("p", { className: "text-sm text-muted-foreground text-center py-10", children: hasFilters ? t('rules.noFilterResults') : t('rules.empty') }))] }), _jsx("div", { className: "mt-6 space-y-6", children: _jsx(ReconciliationRules, { canWrite: canWrite }) })] }), _jsx(DeleteConfirmationDialog, { open: !!deletingRule, title: t('rules.confirmDeleteTitle'), description: t('rules.confirmDeleteDescription', { name: deletingRule?.name }), isPending: deleteMutation.isPending, onClose: () => setDeletingRule(null), onConfirm: () => deletingRule && deleteMutation.mutate(deletingRule.id) }), _jsx(RulePacksDialog, { open: packsDialogOpen, onClose: () => setPacksDialogOpen(false) }), _jsx(Dialog, { open: importDialogOpen, onOpenChange: setImportDialogOpen, children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('rules.importConfirmTitle') }) }), _jsxs("div", { className: "space-y-3 text-sm text-muted-foreground", children: [_jsx("p", { children: t('rules.importConfirmDescription', { count: pendingImport?.rules.length ?? 0, file: pendingImportName }) }), _jsx("p", { className: "font-medium text-amber-600", children: t('rules.importOverwriteWarning') })] }), _jsxs("div", { className: "flex justify-end gap-2 pt-2", children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => { setImportDialogOpen(false); setPendingImport(null); setPendingImportName(''); }, disabled: importMutation.isPending, children: t('common.cancel') }), _jsx(Button, { type: "button", variant: "destructive", onClick: () => { if (pendingImport)
                                        importMutation.mutate(pendingImport); }, disabled: !pendingImport || importMutation.isPending, children: t('rules.confirmOverwriteImport') })] })] }) }), _jsx(RuleDialog, { open: dialogOpen, onClose: () => { setDialogOpen(false); setEditing(null); }, rule: editing, categories: categories, categoryGroups: categoryGroupsList ?? [], currentCategories: allCategoriesList ?? [], accounts: accountsList ?? [], payees: payees, onSave: (data) => {
                    if (editing) {
                        updateMutation.mutate({ id: editing.id, ...data });
                    }
                    else {
                        createMutation.mutate(data);
                    }
                }, loading: createMutation.isPending || updateMutation.isPending }, dialogInstance)] }));
}
function RulePacksDialog({ open, onClose }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [createMissingCategories, setCreateMissingCategories] = useState(true);
    const { data: rulePacks } = useQuery({
        queryKey: ['rule-packs'],
        queryFn: rulesApi.packs,
        enabled: open,
    });
    const installPackMutation = useMutation({
        mutationFn: (code) => rulesApi.installPack(code, createMissingCategories),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['rules'] });
            queryClient.invalidateQueries({ queryKey: ['rule-packs'] });
            if (data.categories_created > 0) {
                queryClient.invalidateQueries({ queryKey: ['categories'] });
            }
            if (data.installed === 0) {
                if (data.unresolved > 0) {
                    toast.error(t('rules.packMissingCategories'));
                }
                else {
                    toast.info(t('rules.packAlreadyInstalled'));
                }
            }
            else if (data.categories_created > 0) {
                toast.success(t('rules.packInstalledWithCategories', {
                    rules: data.installed,
                    categories: data.categories_created,
                }));
            }
            else {
                toast.success(t('rules.packInstalled', { count: data.installed }));
            }
        },
        onError: () => toast.error(t('common.error')),
    });
    return (_jsx(Dialog, { open: open, onOpenChange: onClose, children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('rules.packs') }) }), _jsxs("div", { className: "flex items-center gap-2 px-1", children: [_jsx("input", { type: "checkbox", id: "create-missing-categories", checked: createMissingCategories, onChange: (e) => setCreateMissingCategories(e.target.checked), className: "rounded border-border text-primary focus:ring-primary" }), _jsx(Label, { htmlFor: "create-missing-categories", className: "text-xs text-muted-foreground cursor-pointer", children: t('rules.createMissingCategories') })] }), _jsx("div", { className: "space-y-2", children: rulePacks?.map((pack) => (_jsxs("div", { className: "flex items-center gap-3 p-3 rounded-lg border border-border", children: [_jsx("span", { className: "text-2xl", children: pack.flag }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: pack.name }), _jsx("p", { className: "text-xs text-muted-foreground", children: t('rules.packRuleCount', { count: pack.rule_count }) })] }), pack.installed ? (_jsxs("span", { className: "flex items-center gap-1 text-xs font-medium text-emerald-600", children: [_jsx(Check, { size: 14 }), t('rules.installed')] })) : (_jsxs(Button, { size: "sm", variant: "outline", className: "gap-1.5 h-7 text-xs", onClick: () => installPackMutation.mutate(pack.code), disabled: installPackMutation.isPending, children: [_jsx(Package, { size: 11 }), t('rules.installPack')] }))] }, pack.code))) })] }) }));
}
