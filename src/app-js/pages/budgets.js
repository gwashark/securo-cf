import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDisplayLocale } from '../hooks/use-display-locale.js';
import { monthLabel } from '../lib/month-utils.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categories as categoriesApi, categoryGroups as groupsApi, budgets as budgetsApi } from '../lib/api.js';
import { extractApiError } from '../lib/api-errors.js';
import { toast } from 'sonner';
import { Button } from '../components/ui/button.js';
import { DeleteConfirmationDialog } from '../components/delete-confirmation-dialog.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from '../components/ui/dialog.js';
import { Pencil, Trash2, Plus, Repeat, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Popover, PopoverTrigger, PopoverContent } from '../components/ui/popover.js';
import { MonthPicker } from '../components/ui/monthpicker.js';
import { PageHeader } from '../components/page-header.js';
import { CategoryIcon } from '../components/category-icon.js';
import { usePrivacyMode } from '../hooks/use-privacy-mode.js';
import { useAuth } from '../contexts/auth-context.js';
import { useWorkspace } from '../contexts/workspace-context.js';
import { resolveDateFnsLocale } from '../lib/date-fns-locale.js';
import { findCategoryReference } from '../lib/category-reference-utils.js';
import { formatCurrency } from '../lib/format.js';
function currentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
const TH = 'text-xs font-medium text-muted-foreground py-3';
function SectionCard({ children }) {
    return (_jsx("div", { className: "bg-card rounded-xl border border-border shadow-sm overflow-hidden", children: children }));
}
function SectionHeader({ title, action }) {
    return (_jsxs("div", { className: "px-4 sm:px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-2", children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: title }), action] }));
}
export default function BudgetsPage() {
    const { t, i18n } = useTranslation();
    const { mask } = usePrivacyMode();
    const { user } = useAuth();
    const { canWrite } = useWorkspace();
    const userCurrency = user?.preferences?.currency_display ?? 'USD';
    const locale = useDisplayLocale();
    const queryClient = useQueryClient();
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [monthCalOpen, setMonthCalOpen] = useState(false);
    const dateFnsLocale = resolveDateFnsLocale(i18n.resolvedLanguage ?? i18n.language);
    const monthParam = `${selectedMonth}-01`;
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [deletingBudget, setDeletingBudget] = useState(null);
    const { data: budgetsList } = useQuery({
        queryKey: ['budgets', selectedMonth],
        queryFn: () => budgetsApi.list(monthParam),
    });
    const { data: categoriesList } = useQuery({
        queryKey: ['categories'],
        queryFn: categoriesApi.list,
    });
    // Budgets can point at a hidden default category. The picker below only
    // offers visible ones, but existing rows still have to name what they budget.
    const { data: allCategoriesList } = useQuery({
        queryKey: ['categories', 'management'],
        queryFn: categoriesApi.listIncludingHidden,
    });
    const { data: groupsList } = useQuery({
        queryKey: ['category-groups'],
        queryFn: groupsApi.list,
    });
    const createMutation = useMutation({
        mutationFn: (data) => budgetsApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
            setDialogOpen(false);
            toast.success(t('budgets.created'));
        },
        onError: () => toast.error(t('common.error')),
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, amount }) => budgetsApi.update(id, { amount }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
            setDialogOpen(false);
            setEditing(null);
            toast.success(t('budgets.updated'));
        },
        onError: () => toast.error(t('common.error')),
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => budgetsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
            setDeletingBudget(null);
            toast.success(t('budgets.deleted'));
        },
        onError: (err) => {
            toast.error(extractApiError(err, t('common.error')));
        },
    });
    const displayCategories = allCategoriesList ?? categoriesList ?? [];
    const getCategoryDisplay = (categoryId) => {
        const category = findCategoryReference(displayCategories, categoryId);
        if (!category)
            return _jsx("span", { children: categoryId });
        return (_jsxs("span", { className: "flex items-center gap-2", children: [_jsx(CategoryIcon, { icon: category.icon, color: category.color, size: "sm" }), _jsx("span", { children: category.name })] }));
    };
    const uiLocale = i18n.resolvedLanguage ?? i18n.language;
    const monthTitle = monthLabel(selectedMonth, uiLocale).replace(/^\w/, c => c.toUpperCase());
    return (_jsxs("div", { children: [_jsx(PageHeader, { section: t('budgets.title'), title: monthTitle, action: _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { className: "h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-border hover:text-foreground transition-all text-base", onClick: () => {
                                const [y, m] = selectedMonth.split('-').map(Number);
                                const d = new Date(y, m - 2, 1);
                                setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                            }, children: "\u2039" }), _jsxs(Popover, { open: monthCalOpen, onOpenChange: setMonthCalOpen, children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs("button", { type: "button", className: "inline-flex items-center justify-center gap-2 border border-border rounded-lg px-3 py-1.5 text-sm bg-card text-foreground hover:bg-muted/50 transition-all cursor-pointer min-w-[180px]", children: [_jsx(CalendarIcon, { className: "size-3.5 text-muted-foreground" }), monthTitle] }) }), _jsx(PopoverContent, { align: "center", className: "w-auto p-0", children: _jsx(MonthPicker, { locale: dateFnsLocale, selectedMonth: new Date(`${selectedMonth}-01T00:00:00`), onMonthSelect: (date) => {
                                            if (!date)
                                                return;
                                            setSelectedMonth(format(date, 'yyyy-MM'));
                                            setMonthCalOpen(false);
                                        } }) })] }), _jsx("button", { className: "h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-border hover:text-foreground transition-all text-base", onClick: () => {
                                const [y, m] = selectedMonth.split('-').map(Number);
                                const d = new Date(y, m, 1);
                                setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                            }, children: "\u203A" })] }) }), _jsxs(SectionCard, { children: [_jsx(SectionHeader, { title: t('budgets.title'), action: canWrite ? (_jsxs(Button, { size: "sm", className: "gap-1.5 h-8", onClick: () => { setEditing(null); setDialogOpen(true); }, children: [_jsx(Plus, { size: 13 }), " ", t('budgets.add')] })) : undefined }), budgetsList && budgetsList.length > 0 ? (_jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-border", children: [_jsx("th", { className: `${TH} pl-4 sm:pl-5 text-left`, children: t('budgets.category') }), _jsx("th", { className: `${TH} text-left w-36`, children: t('budgets.amount') }), canWrite && _jsx("th", { className: `${TH} pr-4 sm:pr-5 text-right w-24`, children: t('budgets.actions') })] }) }), _jsx("tbody", { children: budgetsList.map((budget) => (_jsxs("tr", { className: "border-b border-border last:border-0 hover:bg-muted transition-colors", children: [_jsx("td", { className: "py-3 pl-4 sm:pl-5 text-sm font-medium text-foreground", children: _jsxs("span", { className: "flex items-center gap-1.5", children: [getCategoryDisplay(budget.category_id), budget.is_recurring && (_jsx("span", { title: t('budgets.recurringLabel'), className: "text-muted-foreground", children: _jsx(Repeat, { size: 12 }) }))] }) }), _jsx("td", { className: "py-3 text-sm font-semibold tabular-nums text-foreground", children: mask(formatCurrency(budget.amount, userCurrency, locale)) }), canWrite && (_jsx("td", { className: "py-3 pr-4 sm:pr-5", children: _jsxs("div", { className: "flex items-center justify-end gap-1", children: [_jsx("button", { className: "p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors", onClick: () => { setEditing(budget); setDialogOpen(true); }, "aria-label": t('common.edit'), title: t('common.edit'), children: _jsx(Pencil, { size: 13 }) }), _jsx("button", { className: "p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-50 transition-colors", onClick: () => setDeletingBudget(budget), disabled: deleteMutation.isPending, "aria-label": t('common.delete'), title: t('common.delete'), children: _jsx(Trash2, { size: 13 }) })] }) }))] }, budget.id))) })] })) : (_jsx("p", { className: "text-sm text-muted-foreground text-center py-10", children: t('budgets.empty') }))] }), _jsx(Dialog, { open: dialogOpen, onOpenChange: () => { setDialogOpen(false); setEditing(null); }, children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: editing ? t('budgets.edit') : t('budgets.add') }) }), _jsxs("form", { onSubmit: (e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                if (editing) {
                                    updateMutation.mutate({
                                        id: editing.id,
                                        amount: parseFloat(formData.get('amount')),
                                    });
                                }
                                else {
                                    const isRecurring = formData.get('is_recurring') === 'on';
                                    createMutation.mutate({
                                        category_id: formData.get('category_id'),
                                        amount: parseFloat(formData.get('amount')),
                                        month: monthParam,
                                        is_recurring: isRecurring,
                                    });
                                }
                            }, className: "space-y-4", children: [!editing && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('budgets.category') }), _jsxs("select", { name: "category_id", className: "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary", required: true, children: [_jsx("option", { value: "", children: t('budgets.selectCategory') }), groupsList?.map((group) => (_jsx("optgroup", { label: group.name, children: group.categories.map((cat) => (_jsx("option", { value: cat.id, children: cat.name }, cat.id))) }, group.id))), categoriesList?.filter((c) => !c.group_id).map((cat) => (_jsx("option", { value: cat.id, children: cat.name }, cat.id)))] })] }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", name: "is_recurring", className: "rounded border-border" }), _jsx("span", { className: "text-sm text-foreground", children: t('budgets.repeatEveryMonth') })] })] })), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('budgets.amount') }), _jsx(Input, { name: "amount", type: "number", step: "0.01", defaultValue: editing?.amount?.toString() ?? '', required: true })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => { setDialogOpen(false); setEditing(null); }, children: t('common.cancel') }), _jsx(Button, { type: "submit", disabled: createMutation.isPending || updateMutation.isPending, children: t('common.save') })] })] }, editing?.id ?? 'new')] }) }), _jsx(DeleteConfirmationDialog, { open: !!deletingBudget, title: t('budgets.confirmDeleteTitle'), description: t(deletingBudget?.is_recurring
                    ? 'budgets.confirmDeleteRecurringDescription'
                    : 'budgets.confirmDeleteDescription', {
                    name: findCategoryReference(displayCategories, deletingBudget?.category_id ?? '')?.name
                        ?? t('budgets.category'),
                }), isPending: deleteMutation.isPending, onClose: () => setDeletingBudget(null), onConfirm: () => deletingBudget && deleteMutation.mutate(deletingBudget.id) })] }));
}
