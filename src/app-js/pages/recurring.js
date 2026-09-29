import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { getAccountName, sortAccountsByDisplayName } from '../lib/account-utils.js';
import { useTranslation } from 'react-i18next';
import { useDisplayLocale, useDateLocale } from '../hooks/use-display-locale.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categories as categoriesApi, categoryGroups as categoryGroupsApi, recurring as recurringApi, accounts as accountsApi, currencies as currenciesApi } from '../lib/api.js';
import { extractApiError } from '../lib/api-errors.js';
import { localDateString } from '../lib/date-utils.js';
import { invalidateFinancialQueries } from '../lib/invalidate-queries.js';
import { toast } from 'sonner';
import { Button } from '../components/ui/button.js';
import { DeleteConfirmationDialog } from '../components/delete-confirmation-dialog.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from '../components/ui/dialog.js';
import { Pencil, Trash2, Plus, RefreshCw, Info } from 'lucide-react';
import { cn } from '../lib/utils.js';
import { PageHeader } from '../components/page-header.js';
import { CategorySelect } from '../components/category-select.js';
import { DatePickerInput } from '../components/ui/date-picker-input.js';
import { usePrivacyMode } from '../hooks/use-privacy-mode.js';
import { useAuth } from '../contexts/auth-context.js';
import { useWorkspace } from '../contexts/workspace-context.js';
import { formatCurrency } from '../lib/format.js';
const TH = 'text-xs font-medium text-muted-foreground py-3';
function SectionCard({ children }) {
    return (_jsx("div", { className: "bg-card rounded-xl border border-border shadow-sm overflow-hidden", children: children }));
}
function SectionHeader({ title, action }) {
    return (_jsxs("div", { className: "px-4 sm:px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-2", children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: title }), action] }));
}
export default function RecurringPage() {
    const { t } = useTranslation();
    return (_jsxs("div", { children: [_jsx(PageHeader, { section: t('recurring.title'), title: t('recurring.title') }), _jsx(RecurringTab, {})] }));
}
function RecurringTab() {
    const { t } = useTranslation();
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const { mask } = usePrivacyMode();
    const { user } = useAuth();
    const { canWrite } = useWorkspace();
    const userCurrency = user?.preferences?.currency_display ?? 'USD';
    const queryClient = useQueryClient();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [deletingRecurring, setDeletingRecurring] = useState(null);
    const { data: recurringList } = useQuery({
        queryKey: ['recurring'],
        queryFn: recurringApi.list,
    });
    const { data: categoriesList } = useQuery({
        queryKey: ['categories'],
        queryFn: categoriesApi.list,
    });
    const { data: allCategoriesList } = useQuery({
        queryKey: ['categories', 'management'],
        queryFn: categoriesApi.listIncludingHidden,
        enabled: Boolean(editing?.category_id),
    });
    const { data: categoryGroupsList } = useQuery({
        queryKey: ['categoryGroups'],
        queryFn: categoryGroupsApi.list,
    });
    const { data: accountsList } = useQuery({
        queryKey: ['accounts'],
        queryFn: () => accountsApi.list(),
    });
    const createMutation = useMutation({
        mutationFn: (data) => recurringApi.create(data),
        onSuccess: () => {
            invalidateFinancialQueries(queryClient);
            queryClient.invalidateQueries({ queryKey: ['recurring'] });
            setDialogOpen(false);
            toast.success(t('recurring.created'));
        },
        onError: () => toast.error(t('common.error')),
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }) => recurringApi.update(id, data),
        onSuccess: () => {
            invalidateFinancialQueries(queryClient);
            queryClient.invalidateQueries({ queryKey: ['recurring'] });
            setDialogOpen(false);
            setEditing(null);
            toast.success(t('recurring.updated'));
        },
        onError: () => toast.error(t('common.error')),
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => recurringApi.delete(id),
        onSuccess: () => {
            invalidateFinancialQueries(queryClient);
            queryClient.invalidateQueries({ queryKey: ['recurring'] });
            setDeletingRecurring(null);
            toast.success(t('recurring.deleted'));
        },
        onError: (err) => {
            toast.error(extractApiError(err, t('common.error')));
        },
    });
    const generateMutation = useMutation({
        mutationFn: () => recurringApi.generate(),
        onSuccess: (data) => {
            invalidateFinancialQueries(queryClient);
            queryClient.invalidateQueries({ queryKey: ['recurring'] });
            toast.success(t('recurring.generated', { count: data.generated }));
        },
        onError: () => toast.error(t('common.error')),
    });
    const frequencyLabel = (f) => {
        const map = {
            monthly: t('recurring.monthly'),
            quarterly: t('recurring.quarterly'),
            semiannual: t('recurring.semiannual'),
            weekly: t('recurring.weekly'),
            biweekly: t('recurring.biweekly'),
            yearly: t('recurring.yearly'),
        };
        return map[f] ?? f;
    };
    return (_jsxs(_Fragment, { children: [_jsxs(SectionCard, { children: [_jsx(SectionHeader, { title: t('recurring.title'), action: canWrite ? (_jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", className: "gap-1.5 h-8", onClick: () => generateMutation.mutate(), disabled: generateMutation.isPending, children: [_jsx(RefreshCw, { size: 12 }), _jsx("span", { className: "hidden sm:inline", children: t('recurring.generatePending') })] }), _jsxs(Button, { size: "sm", className: "gap-1.5 h-8", onClick: () => { setEditing(null); setDialogOpen(true); }, children: [_jsx(Plus, { size: 13 }), " ", _jsx("span", { className: "hidden sm:inline", children: t('recurring.add') })] })] })) : undefined }), recurringList && recurringList.length > 0 ? (_jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-border", children: [_jsx("th", { className: `${TH} pl-4 sm:pl-5 text-left`, children: t('recurring.description') }), _jsx("th", { className: `${TH} text-left w-36`, children: t('recurring.amount') }), _jsx("th", { className: `${TH} text-left w-28 hidden md:table-cell`, children: t('recurring.frequency') }), _jsx("th", { className: `${TH} text-left w-32 hidden md:table-cell`, children: t('recurring.nextOccurrence') }), _jsx("th", { className: `${TH} text-left w-24 hidden sm:table-cell`, children: t('recurring.status') }), canWrite && _jsx("th", { className: `${TH} pr-4 sm:pr-5 text-right w-24`, children: t('recurring.actions') })] }) }), _jsx("tbody", { children: recurringList.map((rt) => (_jsxs("tr", { className: "border-b border-border last:border-0 hover:bg-muted transition-colors", children: [_jsx("td", { className: "py-3 pl-4 sm:pl-5 text-sm font-medium text-foreground", children: rt.description }), _jsxs("td", { className: `py-3 text-xs sm:text-sm font-bold tabular-nums ${rt.type === 'credit' ? 'text-emerald-600' : 'text-rose-500'}`, children: [mask(`${rt.type === 'credit' ? '+' : '−'}${formatCurrency(rt.amount, rt.currency, locale)}`), rt.currency !== userCurrency && rt.amount_primary != null && (_jsxs("div", { className: "flex items-center gap-1 text-[11px] font-normal text-muted-foreground", children: [_jsx("span", { children: mask(formatCurrency(rt.amount_primary, userCurrency, locale)) }), _jsx("span", { title: t('recurring.fxEstimate', { rate: rt.fx_rate_used?.toFixed(4) ?? '–' }), children: _jsx(Info, { size: 11, className: "inline opacity-60" }) })] }))] }), _jsx("td", { className: "py-3 hidden md:table-cell", children: _jsx("span", { className: "text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium", children: frequencyLabel(rt.frequency) }) }), _jsx("td", { className: "py-3 text-xs text-muted-foreground tabular-nums hidden md:table-cell", children: new Date(rt.next_occurrence + 'T00:00:00').toLocaleDateString(dateLocale) }), _jsx("td", { className: "py-3 hidden sm:table-cell", children: _jsx("span", { className: cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', rt.is_active
                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                    : 'bg-muted text-muted-foreground border-border'), children: rt.is_active ? t('recurring.active') : t('recurring.inactive') }) }), canWrite && (_jsx("td", { className: "py-3 pr-4 sm:pr-5", children: _jsxs("div", { className: "flex items-center justify-end gap-1", children: [_jsx("button", { className: "p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors", onClick: () => { setEditing(rt); setDialogOpen(true); }, "aria-label": t('common.edit'), title: t('common.edit'), children: _jsx(Pencil, { size: 13 }) }), _jsx("button", { className: "p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-50 transition-colors", onClick: () => setDeletingRecurring(rt), disabled: deleteMutation.isPending, "aria-label": t('common.delete'), title: t('common.delete'), children: _jsx(Trash2, { size: 13 }) })] }) }))] }, rt.id))) })] })) : (_jsx("p", { className: "text-sm text-muted-foreground text-center py-10", children: t('recurring.empty') }))] }), _jsx(Dialog, { open: dialogOpen, onOpenChange: () => { setDialogOpen(false); setEditing(null); }, children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: editing ? t('recurring.edit') : t('recurring.add') }) }), _jsx(RecurringForm, { recurring: editing, categories: categoriesList ?? [], categoryGroups: categoryGroupsList ?? [], currentCategory: allCategoriesList?.find((category) => category.id === editing?.category_id), accounts: accountsList ?? [], onSave: (data) => {
                                if (editing) {
                                    updateMutation.mutate({ id: editing.id, ...data });
                                }
                                else {
                                    createMutation.mutate(data);
                                }
                            }, onCancel: () => { setDialogOpen(false); setEditing(null); }, loading: createMutation.isPending || updateMutation.isPending }, editing?.id ?? 'new')] }) }), _jsx(DeleteConfirmationDialog, { open: !!deletingRecurring, title: t('recurring.confirmDeleteTitle'), description: t('recurring.confirmDeleteDescription', { description: deletingRecurring?.description }), isPending: deleteMutation.isPending, onClose: () => setDeletingRecurring(null), onConfirm: () => deletingRecurring && deleteMutation.mutate(deletingRecurring.id) })] }));
}
function RecurringForm({ recurring, categories, categoryGroups, currentCategory, accounts, onSave, onCancel, loading, }) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const userCurrency = user?.preferences?.currency_display ?? 'USD';
    const sortedAccounts = useMemo(() => sortAccountsByDisplayName(accounts), [accounts]);
    const { data: supportedCurrencies } = useQuery({
        queryKey: ['currencies'],
        queryFn: currenciesApi.list,
        staleTime: Infinity,
    });
    const [description, setDescription] = useState(recurring?.description ?? '');
    const [amount, setAmount] = useState(recurring?.amount?.toString() ?? '');
    const [currency, setCurrency] = useState(recurring?.currency ?? userCurrency);
    const [type, setType] = useState(recurring?.type ?? 'debit');
    const [frequency, setFrequency] = useState(recurring?.frequency ?? 'monthly');
    const [weekendAdjustment, setWeekendAdjustment] = useState(recurring?.weekend_adjustment ?? 'none');
    const [dayOfMonth, setDayOfMonth] = useState(recurring?.day_of_month?.toString() ?? '');
    const [startDate, setStartDate] = useState(recurring?.start_date ?? localDateString());
    const [endDate, setEndDate] = useState(recurring?.end_date ?? '');
    const [categoryId, setCategoryId] = useState(recurring?.category_id ?? '');
    const [accountId, setAccountId] = useState(recurring?.account_id ?? sortedAccounts[0]?.id ?? '');
    const [isActive, setIsActive] = useState(recurring?.is_active ?? true);
    const [autoGenerate, setAutoGenerate] = useState(recurring?.auto_generate ?? true);
    const selectClass = 'w-full border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary';
    return (_jsxs("form", { onSubmit: (e) => {
            e.preventDefault();
            onSave({
                description,
                amount: parseFloat(amount),
                currency,
                type,
                frequency,
                weekend_adjustment: weekendAdjustment,
                day_of_month: dayOfMonth ? parseInt(dayOfMonth) : null,
                start_date: startDate,
                end_date: endDate || null,
                category_id: categoryId || null,
                account_id: accountId || null,
                is_active: isActive,
                auto_generate: autoGenerate,
            });
        }, className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('recurring.description') }), _jsx(Input, { value: description, onChange: (e) => setDescription(e.target.value), required: true })] }), _jsxs("div", { className: "grid grid-cols-3 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('recurring.amount') }), _jsx(Input, { type: "number", step: "0.01", value: amount, onChange: (e) => setAmount(e.target.value), required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('recurring.currency') }), _jsx("select", { className: selectClass, value: currency, onChange: (e) => setCurrency(e.target.value), children: (supportedCurrencies ?? [{ code: userCurrency, symbol: userCurrency, name: userCurrency, flag: '' }]).map((c) => (_jsxs("option", { value: c.code, children: [c.flag, " ", c.name] }, c.code))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('recurring.type') }), _jsxs("select", { className: selectClass, value: type, onChange: (e) => setType(e.target.value), children: [_jsx("option", { value: "debit", children: t('recurring.expense') }), _jsx("option", { value: "credit", children: t('recurring.income') })] })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('recurring.frequency') }), _jsxs("select", { className: selectClass, value: frequency, onChange: (e) => setFrequency(e.target.value), children: [_jsx("option", { value: "monthly", children: t('recurring.monthly') }), _jsx("option", { value: "quarterly", children: t('recurring.quarterly') }), _jsx("option", { value: "semiannual", children: t('recurring.semiannual') }), _jsx("option", { value: "weekly", children: t('recurring.weekly') }), _jsx("option", { value: "biweekly", children: t('recurring.biweekly') }), _jsx("option", { value: "yearly", children: t('recurring.yearly') })] })] }), (frequency === 'monthly' || frequency === 'quarterly' || frequency === 'semiannual') && (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('recurring.dayOfMonth') }), _jsx(Input, { type: "number", min: "1", max: "31", value: dayOfMonth, onChange: (e) => setDayOfMonth(e.target.value) })] }))] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('recurring.weekendAdjustment') }), _jsxs("select", { className: selectClass, value: weekendAdjustment, onChange: (e) => setWeekendAdjustment(e.target.value), children: [_jsx("option", { value: "none", children: t('recurring.weekendAdjustmentNone') }), _jsx("option", { value: "previous_friday", children: t('recurring.weekendAdjustmentPreviousFriday') }), _jsx("option", { value: "next_monday", children: t('recurring.weekendAdjustmentNextMonday') })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('recurring.startDate') }), _jsx(DatePickerInput, { value: startDate, onChange: setStartDate, className: "w-full justify-start" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('recurring.endDate') }), _jsx(DatePickerInput, { value: endDate, onChange: setEndDate, placeholder: t('recurring.endDate'), className: "w-full justify-start" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('recurring.category') }), _jsx(CategorySelect, { value: categoryId, onChange: setCategoryId, categories: categories, groups: categoryGroups, currentCategory: currentCategory, allowNone: true, className: selectClass })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('recurring.account') }), _jsxs("select", { className: selectClass, value: accountId, onChange: (e) => setAccountId(e.target.value), required: true, children: [!accountId && _jsx("option", { value: "", disabled: true, children: t('recurring.noAccount') }), sortedAccounts.map((acc) => (_jsx("option", { value: acc.id, children: getAccountName(acc) }, acc.id)))] })] })] }), _jsxs("label", { className: "flex items-start gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: autoGenerate, onChange: (e) => setAutoGenerate(e.target.checked), className: "h-4 w-4 mt-0.5 rounded border-border" }), _jsxs("span", { className: "text-sm text-foreground", children: [t('recurring.autoGenerate'), _jsx("span", { className: "block text-xs text-muted-foreground", children: t('recurring.autoGenerateHelp') })] })] }), recurring && (_jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: isActive, onChange: (e) => setIsActive(e.target.checked), className: "h-4 w-4 rounded border-border" }), _jsx("span", { className: "text-sm text-foreground", children: t('recurring.active') })] })), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: onCancel, children: t('common.cancel') }), _jsx(Button, { type: "submit", disabled: loading, children: loading ? t('common.loading') : t('common.save') })] })] }));
}
