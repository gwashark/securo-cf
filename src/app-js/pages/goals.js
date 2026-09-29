import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createElement, useState } from 'react';
import { getAccountName, sortAccountsByDisplayName } from '../lib/account-utils.js';
import { useTranslation } from 'react-i18next';
import { useDisplayLocale } from '../hooks/use-display-locale.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goals as goalsApi, accounts as accountsApi, assets as assetsApi, assetGroups as assetGroupsApi, currencies as currenciesApi } from '../lib/api.js';
import { toast } from 'sonner';
import { Button } from '../components/ui/button.js';
import { DatePickerInput } from '../components/ui/date-picker-input.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from '../components/ui/dialog.js';
import { Popover, PopoverTrigger, PopoverContent, } from '../components/ui/popover.js';
import { Pencil, Trash2, Plus, Pause, Play, CheckCircle2, Archive, ArchiveRestore, Target, ChevronDown, } from 'lucide-react';
import { ICON_MAP } from '../lib/category-icons.js';
import { IconPicker } from '../components/icon-picker.js';
import { PageHeader } from '../components/page-header.js';
import { usePrivacyMode } from '../hooks/use-privacy-mode.js';
import { useAuth } from '../contexts/auth-context.js';
import { useWorkspace } from '../contexts/workspace-context.js';
import { formatCurrency } from '../lib/format.js';
function getGoalIcon(iconKey) {
    return (iconKey && ICON_MAP[iconKey]) || Target;
}
const PRESET_COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];
const SELECT_CLASS = 'w-full border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary';
function LinkedResourceSelect({ name, label, placeholder, defaultValue, items, renderOption, hint, }) {
    return (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: label }), _jsxs("select", { name: name, defaultValue: defaultValue ?? '', className: SELECT_CLASS, required: true, children: [_jsx("option", { value: "", children: placeholder }), items?.map((item) => (_jsx("option", { value: item.id, children: renderOption(item) }, item.id)))] }), hint && _jsx("p", { className: "text-xs text-muted-foreground", children: hint })] }));
}
function SectionCard({ children }) {
    return (_jsx("div", { className: "bg-card rounded-xl border border-border shadow-sm overflow-hidden", children: children }));
}
function SectionHeader({ title, action }) {
    return (_jsxs("div", { className: "px-4 sm:px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-2", children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: title }), action] }));
}
function OnTrackBadge({ status, t }) {
    if (!status)
        return null;
    const config = {
        ahead: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400', key: 'goals.onTrackAhead' },
        on_track: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400', key: 'goals.onTrackOnTrack' },
        behind: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400', key: 'goals.onTrackBehind' },
        overdue: { bg: 'bg-rose-100 dark:bg-rose-500/20', text: 'text-rose-700 dark:text-rose-400', key: 'goals.onTrackOverdue' },
        achieved: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400', key: 'goals.onTrackAchieved' },
    };
    const c = config[status];
    if (!c)
        return null;
    return (_jsx("span", { className: `inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.text}`, children: t(c.key) }));
}
function StatusBadge({ status, t }) {
    const config = {
        active: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400', key: 'goals.statusActive' },
        completed: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400', key: 'goals.statusCompleted' },
        paused: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400', key: 'goals.statusPaused' },
        archived: { bg: 'bg-muted', text: 'text-muted-foreground', key: 'goals.statusArchived' },
    };
    const c = config[status] ?? config.active;
    return (_jsx("span", { className: `inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.text}`, children: t(c.key) }));
}
function daysUntil(dateStr) {
    const target = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
export default function GoalsPage() {
    const { t } = useTranslation();
    const { mask } = usePrivacyMode();
    const { user } = useAuth();
    const { canWrite } = useWorkspace();
    const userCurrency = user?.preferences?.currency_display ?? 'USD';
    const locale = useDisplayLocale();
    const queryClient = useQueryClient();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [trackingType, setTrackingType] = useState('manual');
    const [statusFilter, setStatusFilter] = useState('active');
    const [deletingGoal, setDeletingGoal] = useState(null);
    const [selectedIcon, setSelectedIcon] = useState('target');
    const [selectedColor, setSelectedColor] = useState('#3B82F6');
    const [targetDate, setTargetDate] = useState('');
    const { data: goalsList } = useQuery({
        queryKey: ['goals', statusFilter],
        queryFn: () => goalsApi.list(statusFilter || undefined),
    });
    const { data: accountsList } = useQuery({
        queryKey: ['accounts'],
        queryFn: () => accountsApi.list(),
    });
    const { data: assetsList } = useQuery({
        queryKey: ['assets'],
        queryFn: () => assetsApi.list(),
    });
    const { data: walletsList } = useQuery({
        queryKey: ['asset-groups'],
        queryFn: assetGroupsApi.list,
    });
    const { data: supportedCurrencies } = useQuery({
        queryKey: ['currencies'],
        queryFn: currenciesApi.list,
        staleTime: Infinity,
    });
    const createMutation = useMutation({
        mutationFn: (data) => goalsApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['goals'] });
            setDialogOpen(false);
            toast.success(t('goals.created'));
        },
        onError: () => toast.error(t('common.error')),
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }) => goalsApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['goals'] });
            setDialogOpen(false);
            setEditing(null);
            toast.success(t('goals.updated'));
        },
        onError: () => toast.error(t('common.error')),
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => goalsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['goals'] });
            setDeletingGoal(null);
            toast.success(t('goals.deleted'));
        },
        onError: () => toast.error(t('common.error')),
    });
    const statusMutation = useMutation({
        mutationFn: ({ id, status }) => goalsApi.update(id, { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['goals'] });
            toast.success(t('goals.updated'));
        },
    });
    const openCreateDialog = () => {
        setEditing(null);
        setTrackingType('manual');
        setSelectedIcon('target');
        setSelectedColor('#3B82F6');
        setTargetDate('');
        setDialogOpen(true);
    };
    const openEditDialog = (goal) => {
        setEditing(goal);
        setTrackingType(goal.tracking_type);
        setSelectedIcon(goal.icon ?? 'target');
        setSelectedColor(goal.color ?? '#3B82F6');
        setTargetDate(goal.target_date ?? '');
        setDialogOpen(true);
    };
    return (_jsxs("div", { children: [_jsx(PageHeader, { section: t('goals.title'), title: t('goals.title') }), _jsx("div", { className: "flex items-center gap-2 mb-4", children: ['active', 'completed', 'paused', 'archived', ''].map((s) => (_jsx("button", { onClick: () => setStatusFilter(s), className: `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'}`, children: s ? t(`goals.status${s.charAt(0).toUpperCase() + s.slice(1)}`) : t('transactions.all') }, s))) }), _jsxs(SectionCard, { children: [_jsx(SectionHeader, { title: t('goals.title'), action: canWrite ? (_jsxs(Button, { size: "sm", className: "gap-1.5 h-8", onClick: openCreateDialog, children: [_jsx(Plus, { size: 13 }), " ", t('goals.add')] })) : undefined }), goalsList && goalsList.length > 0 ? (_jsx("div", { className: "divide-y divide-border", children: goalsList.map((goal) => {
                            const days = goal.target_date ? daysUntil(goal.target_date) : null;
                            const progressColor = goal.percentage >= 100
                                ? 'bg-emerald-500'
                                : goal.percentage >= 60
                                    ? 'bg-blue-500'
                                    : goal.percentage >= 30
                                        ? 'bg-amber-400'
                                        : 'bg-muted-foreground/30';
                            const GoalIcon = getGoalIcon(goal.icon);
                            return (_jsx("div", { className: "px-4 sm:px-5 py-4 hover:bg-muted/50 transition-colors", children: _jsxs("div", { className: "flex items-start gap-4", children: [_jsx("div", { className: "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white", style: { backgroundColor: goal.color ?? '#6B7280' }, children: _jsx(GoalIcon, { size: 18 }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("span", { className: "text-sm font-semibold text-foreground truncate", children: goal.name }), _jsx(StatusBadge, { status: goal.status, t: t }), _jsx(OnTrackBadge, { status: goal.on_track, t: t })] }), _jsxs("div", { className: "flex items-center gap-3 mb-1.5", children: [_jsx("div", { className: "flex-1 h-2 bg-muted/60 rounded-full overflow-hidden", children: _jsx("div", { className: `h-full rounded-full transition-all ${progressColor}`, style: { width: `${Math.min(goal.percentage, 100)}%` } }) }), _jsxs("span", { className: "text-xs font-bold tabular-nums text-foreground shrink-0", children: [goal.percentage.toFixed(0), "%"] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground", children: [_jsxs("span", { className: "tabular-nums font-medium", children: [mask(formatCurrency(goal.current_amount, goal.currency, locale)), ' / ', mask(formatCurrency(goal.target_amount, goal.currency, locale))] }), goal.monthly_contribution != null && goal.monthly_contribution > 0 && (_jsxs("span", { className: "tabular-nums", children: [mask(formatCurrency(goal.monthly_contribution, goal.currency, locale)), t('goals.perMonth')] })), days !== null && (_jsx("span", { className: days < 0 ? 'text-rose-500' : '', children: days >= 0
                                                                ? t('goals.daysRemaining', { count: days })
                                                                : t('goals.daysOverdue', { count: Math.abs(days) }) })), !goal.target_date && (_jsx("span", { children: t('goals.noTargetDate') })), goal.account_name && (_jsx("span", { children: goal.account_name })), goal.asset_name && (_jsx("span", { children: goal.asset_name })), goal.asset_group_name && (_jsx("span", { children: goal.asset_group_name }))] })] }), canWrite && (_jsxs("div", { className: "flex items-center gap-1 shrink-0", children: [goal.status === 'active' && (_jsx("button", { className: "p-1.5 rounded-md text-muted-foreground hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors", onClick: () => statusMutation.mutate({ id: goal.id, status: 'paused' }), title: t('goals.pause'), children: _jsx(Pause, { size: 13 }) })), goal.status === 'paused' && (_jsx("button", { className: "p-1.5 rounded-md text-muted-foreground hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors", onClick: () => statusMutation.mutate({ id: goal.id, status: 'active' }), title: t('goals.resume'), children: _jsx(Play, { size: 13 }) })), (goal.status === 'active' || goal.status === 'paused') && (_jsx("button", { className: "p-1.5 rounded-md text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors", onClick: () => statusMutation.mutate({ id: goal.id, status: 'completed' }), title: t('goals.complete'), children: _jsx(CheckCircle2, { size: 13 }) })), goal.status !== 'archived' && (_jsx("button", { className: "p-1.5 rounded-md text-muted-foreground hover:text-muted-foreground/80 hover:bg-muted transition-colors", onClick: () => statusMutation.mutate({ id: goal.id, status: 'archived' }), title: t('goals.archive'), children: _jsx(Archive, { size: 13 }) })), (goal.status === 'completed' || goal.status === 'archived') && (_jsx("button", { className: "p-1.5 rounded-md text-muted-foreground hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors", onClick: () => statusMutation.mutate({ id: goal.id, status: 'active' }), title: t('goals.reactivate'), children: _jsx(ArchiveRestore, { size: 13 }) })), _jsx("button", { className: "p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors", onClick: () => openEditDialog(goal), title: t('common.edit'), children: _jsx(Pencil, { size: 13 }) }), _jsx("button", { className: "p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors", onClick: () => setDeletingGoal(goal), title: t('common.delete'), children: _jsx(Trash2, { size: 13 }) })] }))] }) }, goal.id));
                        }) })) : (_jsx("p", { className: "text-sm text-muted-foreground text-center py-10", children: t('goals.empty') }))] }), _jsx(Dialog, { open: dialogOpen, onOpenChange: () => { setDialogOpen(false); setEditing(null); }, children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: editing ? t('goals.edit') : t('goals.add') }) }), _jsxs("form", { onSubmit: (e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                const payload = {
                                    name: formData.get('name'),
                                    target_amount: parseFloat(formData.get('target_amount')),
                                    currency: formData.get('currency') || userCurrency,
                                    tracking_type: formData.get('tracking_type'),
                                    target_date: targetDate || null,
                                    icon: selectedIcon || null,
                                    color: selectedColor || null,
                                };
                                const tt = formData.get('tracking_type');
                                if (tt === 'manual') {
                                    payload.current_amount = parseFloat(formData.get('current_amount') || '0');
                                }
                                if (tt === 'account') {
                                    payload.account_id = formData.get('account_id') || null;
                                }
                                if (tt === 'asset') {
                                    payload.asset_id = formData.get('asset_id') || null;
                                }
                                if (tt === 'asset_group') {
                                    payload.asset_group_id = formData.get('asset_group_id') || null;
                                }
                                if (editing) {
                                    updateMutation.mutate({ id: editing.id, ...payload });
                                }
                                else {
                                    createMutation.mutate(payload);
                                }
                            }, className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('goals.name') }), _jsx(Input, { name: "name", defaultValue: editing?.name ?? '', required: true })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('goals.targetAmount') }), _jsx(Input, { name: "target_amount", type: "number", step: "0.01", defaultValue: editing?.target_amount?.toString() ?? '', required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('goals.currency') }), _jsx("select", { name: "currency", defaultValue: editing?.currency ?? userCurrency, className: SELECT_CLASS, children: supportedCurrencies?.map((c) => (_jsxs("option", { value: c.code, children: [c.flag, " ", c.name, " (", c.code, ")"] }, c.code))) })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('goals.targetDate') }), _jsx(DatePickerInput, { value: targetDate, onChange: setTargetDate, className: "w-full justify-start" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('goals.trackingType') }), _jsxs("select", { name: "tracking_type", value: trackingType, onChange: (e) => setTrackingType(e.target.value), className: SELECT_CLASS, children: [_jsx("option", { value: "manual", children: t('goals.trackingManual') }), _jsx("option", { value: "account", children: t('goals.trackingAccount') }), _jsx("option", { value: "asset", children: t('goals.trackingAsset') }), _jsx("option", { value: "asset_group", children: t('goals.trackingWallet') }), _jsx("option", { value: "net_worth", children: t('goals.trackingNetWorth') })] })] }), trackingType === 'manual' && (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('goals.currentAmount') }), _jsx(Input, { name: "current_amount", type: "number", step: "0.01", defaultValue: editing?.tracking_type === 'manual' ? editing?.current_amount?.toString() : '0' })] })), trackingType === 'account' && (_jsx(LinkedResourceSelect, { name: "account_id", label: t('goals.account'), placeholder: t('goals.selectAccount'), defaultValue: editing?.account_id, items: sortAccountsByDisplayName(accountsList ?? []), renderOption: (acc) => `${getAccountName(acc)} (${acc.currency})` })), trackingType === 'asset' && (_jsx(LinkedResourceSelect, { name: "asset_id", label: t('goals.asset'), placeholder: t('goals.selectAsset'), defaultValue: editing?.asset_id, items: assetsList, renderOption: (asset) => `${asset.name} (${asset.currency})` })), trackingType === 'asset_group' && (_jsx(LinkedResourceSelect, { name: "asset_group_id", label: t('goals.wallet'), placeholder: t('goals.selectWallet'), defaultValue: editing?.asset_group_id, items: walletsList, renderOption: (wallet) => wallet.name, hint: t('goals.walletHint') })), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('goals.icon') }), _jsxs(Popover, { children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs("button", { type: "button", className: "w-full flex items-center gap-3 border border-border rounded-lg px-3 py-2 text-sm bg-card hover:bg-muted/50 transition-colors text-left", children: [_jsx("div", { className: "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white", style: { backgroundColor: selectedColor }, children: createElement(getGoalIcon(selectedIcon), { size: 18 }) }), _jsx("span", { className: "flex-1 text-muted-foreground", children: t('goals.chooseIconColor') }), _jsx(ChevronDown, { size: 14, className: "text-muted-foreground" })] }) }), _jsxs(PopoverContent, { align: "start", className: "w-80 p-3 space-y-3", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [PRESET_COLORS.map((c) => (_jsx("button", { type: "button", "aria-label": c, title: c, onClick: () => setSelectedColor(c), className: `w-7 h-7 rounded-full transition-all ${selectedColor === c ? 'ring-2 ring-offset-1 ring-primary scale-110' : 'hover:scale-110'}`, style: { backgroundColor: c } }, c))), _jsx("input", { type: "color", value: selectedColor, onChange: (e) => setSelectedColor(e.target.value), className: "w-7 h-7 rounded-full cursor-pointer border-0 p-0" })] }), _jsx(IconPicker, { value: selectedIcon, color: selectedColor, onChange: setSelectedIcon })] })] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => { setDialogOpen(false); setEditing(null); }, children: t('common.cancel') }), _jsx(Button, { type: "submit", disabled: createMutation.isPending || updateMutation.isPending, children: t('common.save') })] })] }, editing?.id ?? 'new')] }) }), _jsx(Dialog, { open: !!deletingGoal, onOpenChange: () => setDeletingGoal(null), children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('goals.confirmDeleteTitle') }) }), _jsx("p", { className: "text-sm text-muted-foreground", children: t('goals.confirmDeleteDesc', { name: deletingGoal?.name }) }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setDeletingGoal(null), children: t('common.cancel') }), _jsx(Button, { variant: "destructive", onClick: () => deletingGoal && deleteMutation.mutate(deletingGoal.id), disabled: deleteMutation.isPending, children: deleteMutation.isPending ? t('common.loading') : t('common.delete') })] })] }) })] }));
}
