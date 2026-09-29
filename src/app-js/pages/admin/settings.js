import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { admin as adminApi, currencies as currenciesApi } from '../../lib/api.js';
import { resolveDisplayLocale, resolveDateLocale } from '../../lib/format.js';
import { resolveSupportedLang, SUPPORTED_LANGS } from '../../lib/i18n.js';
import { useAuth } from '../../contexts/auth-context.js';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Label } from '../../components/ui/label.js';
import { Badge } from '../../components/ui/badge.js';
import { Skeleton } from '../../components/ui/skeleton.js';
import { Avatar, AvatarFallback } from '../../components/ui/avatar.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, } from '../../components/ui/dialog.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '../../components/ui/select.js';
import { PageHeader } from '../../components/page-header.js';
import { TimezoneSettings } from '../../components/timezone-settings.js';
import { setThemeBasedOnSystem } from '../../lib/theme-utils.js';
import { useLocalAuthEnabled } from '../../hooks/use-local-auth.js';
import { Search, Plus, Trash2, Shield, ShieldOff, UserCog, Users, Scale, Tag, Palette, Save, Hash, CalendarDays } from 'lucide-react';
export default function AdminSettingsPage() {
    const { t, i18n } = useTranslation();
    const { user: currentUser } = useAuth();
    const queryClient = useQueryClient();
    const { resolvedTheme } = useTheme();
    const [search, setSearch] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [editUser, setEditUser] = useState(null);
    const [deleteUser, setDeleteUser] = useState(null);
    const [formEmail, setFormEmail] = useState('');
    const [formPassword, setFormPassword] = useState('');
    const [formIsAdmin, setFormIsAdmin] = useState(false);
    const [formLanguage, setFormLanguage] = useState('en');
    const [formCurrency, setFormCurrency] = useState('USD');
    const [editEmail, setEditEmail] = useState('');
    const [editIsActive, setEditIsActive] = useState(true);
    const [editIsAdmin, setEditIsAdmin] = useState(false);
    const [editPassword, setEditPassword] = useState('');
    const [showPasswordField, setShowPasswordField] = useState(false);
    const [lastSyncedLight, setLastSyncedLight] = useState();
    const [lastSyncedDark, setLastSyncedDark] = useState();
    const [localLight, setLocalLight] = useState('#6366F1');
    const [localDark, setLocalDark] = useState('#818CF8');
    const { data: usersData, isLoading: usersLoading } = useQuery({
        queryKey: ['admin', 'users', search],
        queryFn: () => adminApi.listUsers({ search: search || undefined }),
    });
    const localAuthEnabled = useLocalAuthEnabled();
    const createMutation = useMutation({
        mutationFn: (data) => adminApi.createUser(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
            setCreateOpen(false);
            resetCreateForm();
            toast.success(t('admin.users.created'));
        },
        onError: (err) => {
            toast.error(err.response?.data?.detail || t('common.error'));
        },
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }) => adminApi.updateUser(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
            setEditUser(null);
            toast.success(t('admin.users.updated'));
        },
        onError: (err) => {
            toast.error(err.response?.data?.detail || t('common.error'));
        },
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => adminApi.deleteUser(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
            setDeleteUser(null);
            toast.success(t('admin.users.deleted'));
        },
        onError: (err) => {
            toast.error(err.response?.data?.detail || t('common.error'));
        },
    });
    const { data: regSetting, isLoading: settingsLoading } = useQuery({
        queryKey: ['admin', 'settings', 'registration_enabled'],
        queryFn: () => adminApi.getSetting('registration_enabled'),
    });
    const updateSettingMutation = useMutation({
        mutationFn: (value) => adminApi.updateSetting('registration_enabled', value),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
            toast.success(t('admin.settings.updated'));
        },
        onError: () => {
            toast.error(t('common.error'));
        },
    });
    // Theme color settings
    const { data: themeColorLightSetting } = useQuery({
        queryKey: ['admin', 'settings', 'theme_color_light'],
        queryFn: () => adminApi.getSetting('theme_color_light').catch(() => null),
        retry: false,
    });
    const { data: themeColorDarkSetting } = useQuery({
        queryKey: ['admin', 'settings', 'theme_color_dark'],
        queryFn: () => adminApi.getSetting('theme_color_dark').catch(() => null),
        retry: false,
    });
    // Credit card accounting mode: returns 404 when unset → defaults to "cash".
    const { data: ccModeSetting } = useQuery({
        queryKey: ['admin', 'settings', 'credit_card_accounting_mode'],
        queryFn: () => adminApi.getSetting('credit_card_accounting_mode').catch(() => null),
        retry: false,
    });
    const updateAccountingModeMutation = useMutation({
        mutationFn: (value) => adminApi.updateSetting('credit_card_accounting_mode', value),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'credit_card_accounting_mode'] });
            toast.success(t('admin.settings.updated'));
        },
        onError: () => {
            toast.error(t('common.error'));
        },
    });
    const accountingMode = (ccModeSetting?.value === 'accrual' ? 'accrual' : 'cash');
    // Provider categories: returns 404 when unset → defaults to "true" so
    // existing installs keep the historical sync behavior.
    const { data: providerCatsSetting } = useQuery({
        queryKey: ['admin', 'settings', 'use_provider_categories'],
        queryFn: () => adminApi.getSetting('use_provider_categories').catch(() => null),
        retry: false,
    });
    const { data: supportedCurrencies } = useQuery({
        queryKey: ['currencies'],
        queryFn: currenciesApi.list,
        staleTime: Infinity,
    });
    const updateProviderCatsMutation = useMutation({
        mutationFn: (value) => adminApi.updateSetting('use_provider_categories', value),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'use_provider_categories'] });
            toast.success(t('admin.settings.updated'));
        },
        onError: () => {
            toast.error(t('common.error'));
        },
    });
    const useProviderCats = providerCatsSetting?.value !== 'false';
    // Number/date display format: 404 when unset → defaults to "auto" (derive
    // separators from each user's display currency).
    const { data: numberFormatSetting } = useQuery({
        queryKey: ['admin', 'settings', 'number_format'],
        queryFn: () => adminApi.getSetting('number_format').catch(() => null),
        retry: false,
    });
    const numberFormat = numberFormatSetting?.value ?? 'auto';
    const updateNumberFormatMutation = useMutation({
        mutationFn: (value) => adminApi.updateSetting('number_format', value),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'number_format'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'number-format'] });
            toast.success(t('admin.settings.updated'));
        },
        onError: () => {
            toast.error(t('common.error'));
        },
    });
    // Date format: 404 when unset → defaults to "auto" (order follows the
    // number format / currency).
    const { data: dateFormatSetting } = useQuery({
        queryKey: ['admin', 'settings', 'date_format'],
        queryFn: () => adminApi.getSetting('date_format').catch(() => null),
        retry: false,
    });
    const dateFormat = dateFormatSetting?.value ?? 'auto';
    const updateDateFormatMutation = useMutation({
        mutationFn: (value) => adminApi.updateSetting('date_format', value),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'date_format'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'date-format'] });
            toast.success(t('admin.settings.updated'));
        },
        onError: () => {
            toast.error(t('common.error'));
        },
    });
    if (themeColorLightSetting?.value && themeColorLightSetting.value !== lastSyncedLight) {
        setLastSyncedLight(themeColorLightSetting.value);
        setLocalLight(themeColorLightSetting.value);
    }
    if (themeColorDarkSetting?.value && themeColorDarkSetting.value !== lastSyncedDark) {
        setLastSyncedDark(themeColorDarkSetting.value);
        setLocalDark(themeColorDarkSetting.value);
    }
    const saveColorsMutation = useMutation({
        mutationFn: async () => {
            await Promise.all([
                adminApi.updateSetting('theme_color_light', localLight),
                adminApi.updateSetting('theme_color_dark', localDark),
            ]);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
            setThemeBasedOnSystem(localLight, localDark, resolvedTheme);
            toast.success(t('admin.settings.updated'));
        },
        onError: () => {
            toast.error(t('common.error'));
        },
    });
    function resetCreateForm() {
        setFormEmail('');
        setFormPassword('');
        setFormIsAdmin(false);
        setFormLanguage('en');
        // New users default to the admin's current display currency so they
        // follow the currency the workspace is running in.
        setFormCurrency(currentUser?.preferences?.currency_display ?? 'USD');
    }
    function openEdit(u) {
        setEditUser(u);
        setEditEmail(u.email);
        setEditIsActive(u.is_active);
        setEditIsAdmin(u.is_superuser);
        setEditPassword('');
        setShowPasswordField(false);
    }
    const users = usersData?.items ?? [];
    const isSelf = (u) => u.id === currentUser?.id;
    const isEnabled = regSetting?.value === 'true';
    const filteredUsers = users;
    return (_jsxs("div", { children: [_jsx(PageHeader, { section: t('nav.groupAdmin'), title: t('admin.settings.title'), action: localAuthEnabled ? (_jsxs(Button, { onClick: () => { resetCreateForm(); setCreateOpen(true); }, children: [_jsx(Plus, { size: 16, className: "mr-1.5" }), t('admin.users.add')] })) : undefined }), _jsxs("div", { className: "relative max-w-md mb-5", children: [_jsx(Search, { size: 16, className: "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" }), _jsx(Input, { value: search, onChange: (e) => setSearch(e.target.value), placeholder: t('admin.users.searchPlaceholder'), className: "pl-9 h-10 bg-card border-border/60 rounded-xl" })] }), _jsx("div", { className: "rounded-xl border border-border/60 bg-card overflow-hidden mb-8", children: usersLoading ? (_jsx("div", { className: "p-4 space-y-3", children: [...Array(3)].map((_, i) => _jsx(Skeleton, { className: "h-14 w-full rounded-lg" }, i)) })) : filteredUsers.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center py-16 text-muted-foreground", children: [_jsx(Users, { size: 32, className: "mb-3 opacity-40" }), _jsx("p", { className: "text-sm", children: t('admin.users.empty') })] })) : (_jsx("div", { className: "divide-y divide-border/40", children: filteredUsers.map((u) => (_jsxs("button", { onClick: () => openEdit(u), className: "flex items-center gap-4 w-full px-5 py-3.5 text-left hover:bg-muted/40 transition-colors", children: [_jsx(Avatar, { className: "h-9 w-9 shrink-0", children: _jsx(AvatarFallback, { className: u.is_superuser ? 'bg-primary/15 text-primary text-xs font-semibold' : 'bg-muted text-muted-foreground text-xs font-semibold', children: u.email.charAt(0).toUpperCase() }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm font-medium text-foreground truncate", children: u.email }), isSelf(u) && (_jsx("span", { className: "text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded", children: t('admin.users.you') }))] }), _jsx("span", { className: "text-xs text-muted-foreground", children: u.is_superuser ? t('admin.users.admin') : t('admin.users.user') })] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [!u.is_active && (_jsx(Badge, { variant: "secondary", className: "text-[10px] font-medium", children: t('admin.users.inactive') })), u.is_superuser && (_jsx(Shield, { size: 14, className: "text-primary" })), !isSelf(u) && (_jsx("span", { role: "button", onClick: (e) => { e.stopPropagation(); setDeleteUser(u); }, className: "p-1.5 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors", title: t('common.delete'), children: _jsx(Trash2, { size: 14 }) }))] })] }, u.id))) })) }), _jsx(TimezoneSettings, {}), _jsx("div", { className: "grid grid-cols-1 gap-6 mb-8", children: _jsxs("div", { className: "rounded-xl border border-border/60 bg-card overflow-hidden", children: [_jsxs("div", { className: "px-5 py-4 border-b border-border/40 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Palette, { size: 15, className: "text-muted-foreground" }), _jsx("h3", { className: "text-sm font-semibold text-foreground", children: t('settings.customization') })] }), _jsxs(Button, { onClick: () => saveColorsMutation.mutate(), disabled: saveColorsMutation.isPending, children: [_jsx(Save, { size: 13 }), saveColorsMutation.isPending ? t('common.loading') : t('common.save')] })] }), _jsxs("div", { className: "p-5 grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-[10px] font-bold uppercase tracking-wider text-muted-foreground", children: t('settings.lightMode') }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { className: "text-xs", children: t('settings.themeColor') }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Input, { type: "color", className: "w-12 h-9 p-1 cursor-pointer", value: localLight, onChange: (e) => setLocalLight(e.target.value) }), _jsx("span", { className: "text-xs font-mono text-muted-foreground", children: localLight })] })] })] }), _jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-[10px] font-bold uppercase tracking-wider text-muted-foreground", children: t('settings.darkMode') }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { className: "text-xs", children: t('settings.themeColor') }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Input, { type: "color", className: "w-12 h-9 p-1 cursor-pointer", value: localDark, onChange: (e) => setLocalDark(e.target.value) }), _jsx("span", { className: "text-xs font-mono text-muted-foreground", children: localDark })] })] })] })] })] }) }), _jsxs("div", { className: "rounded-xl border border-border/60 bg-card overflow-hidden mb-8", children: [_jsxs("div", { className: "px-5 py-4 border-b border-border/40", children: [_jsxs("div", { className: "flex items-center gap-2 mb-0.5", children: [_jsx(Scale, { size: 15, className: "text-muted-foreground" }), _jsx("h3", { className: "text-sm font-semibold text-foreground", children: t('admin.settings.accountingTitle') })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: t('admin.settings.accountingSubtitle') })] }), _jsxs("div", { className: "divide-y divide-border/40", children: [_jsxs("button", { type: "button", onClick: () => updateAccountingModeMutation.mutate('cash'), disabled: updateAccountingModeMutation.isPending, className: "flex items-start gap-3 w-full px-5 py-4 text-left hover:bg-muted/40 transition-colors", children: [_jsx("div", { className: `mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 ${accountingMode === 'cash' ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`, children: accountingMode === 'cash' && _jsx("div", { className: "h-full w-full rounded-full bg-primary ring-2 ring-background ring-inset" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-foreground", children: t('admin.settings.accountingCash') }), _jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: t('admin.settings.accountingCashDesc') })] })] }), _jsxs("button", { type: "button", onClick: () => updateAccountingModeMutation.mutate('accrual'), disabled: updateAccountingModeMutation.isPending, className: "flex items-start gap-3 w-full px-5 py-4 text-left hover:bg-muted/40 transition-colors", children: [_jsx("div", { className: `mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 ${accountingMode === 'accrual' ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`, children: accountingMode === 'accrual' && _jsx("div", { className: "h-full w-full rounded-full bg-primary ring-2 ring-background ring-inset" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-foreground", children: t('admin.settings.accountingAccrual') }), _jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: t('admin.settings.accountingAccrualDesc') })] })] })] })] }), _jsxs("div", { className: "rounded-xl border border-border/60 bg-card overflow-hidden mb-8", children: [_jsx("div", { className: "px-5 py-4 border-b border-border/40", children: _jsxs("div", { className: "flex items-center gap-2 mb-0.5", children: [_jsx(Tag, { size: 15, className: "text-muted-foreground" }), _jsx("h3", { className: "text-sm font-semibold text-foreground", children: t('admin.settings.providerCategoriesTitle') })] }) }), _jsxs("div", { className: "px-5 py-4 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-foreground", children: t('admin.settings.providerCategories') }), _jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: t('admin.settings.providerCategoriesDesc') })] }), _jsx("button", { "aria-label": t('admin.settings.providerCategories'), onClick: () => updateProviderCatsMutation.mutate(useProviderCats ? 'false' : 'true'), disabled: updateProviderCatsMutation.isPending, className: `relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${useProviderCats ? 'bg-primary' : 'bg-muted-foreground/20'}`, children: _jsx("span", { className: `pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${useProviderCats ? 'translate-x-6' : 'translate-x-1'}` }) })] })] }), _jsxs("div", { className: "rounded-xl border border-border/60 bg-card overflow-hidden mb-8", children: [_jsxs("div", { className: "px-5 py-4 border-b border-border/40", children: [_jsxs("div", { className: "flex items-center gap-2 mb-0.5", children: [_jsx(Hash, { size: 15, className: "text-muted-foreground" }), _jsx("h3", { className: "text-sm font-semibold text-foreground", children: t('admin.settings.numberFormatTitle') })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: t('admin.settings.numberFormatDesc') })] }), _jsx("div", { className: "divide-y divide-border/40", children: [
                            { value: 'auto', label: t('admin.settings.numberFormatAuto'), desc: t('admin.settings.numberFormatAutoDesc') },
                            { value: 'comma_dot', label: t('admin.settings.numberFormatCommaDot'), desc: t('admin.settings.numberFormatCommaDotDesc') },
                            { value: 'dot_comma', label: t('admin.settings.numberFormatDotComma'), desc: t('admin.settings.numberFormatDotCommaDesc') },
                            { value: 'space_comma', label: t('admin.settings.numberFormatSpaceComma'), desc: t('admin.settings.numberFormatSpaceCommaDesc') },
                        ].map((opt) => {
                            // Live preview of how this option renders a sample amount, resolved
                            // against the admin's currency + UI language.
                            const adminCurrency = currentUser?.preferences?.currency_display ?? 'USD';
                            const numLocale = resolveDisplayLocale(opt.value, adminCurrency, i18n.language === 'en' ? 'en-US' : i18n.language);
                            const numExample = new Intl.NumberFormat(numLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(1234.56);
                            return (_jsxs("button", { type: "button", onClick: () => updateNumberFormatMutation.mutate(opt.value), disabled: updateNumberFormatMutation.isPending, className: "flex items-start gap-3 w-full px-5 py-4 text-left hover:bg-muted/40 transition-colors", children: [_jsx("div", { className: `mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 ${numberFormat === opt.value ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`, children: numberFormat === opt.value && _jsx("div", { className: "h-full w-full rounded-full bg-primary ring-2 ring-background ring-inset" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-baseline gap-2 flex-wrap", children: [_jsx("p", { className: "text-sm font-medium text-foreground tabular-nums", children: opt.label }), _jsx("span", { className: "text-xs tabular-nums text-muted-foreground", children: numExample })] }), opt.desc && (_jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: opt.desc }))] })] }, opt.value));
                        }) })] }), _jsxs("div", { className: "rounded-xl border border-border/60 bg-card overflow-hidden mb-8", children: [_jsxs("div", { className: "px-5 py-4 border-b border-border/40", children: [_jsxs("div", { className: "flex items-center gap-2 mb-0.5", children: [_jsx(CalendarDays, { size: 15, className: "text-muted-foreground" }), _jsx("h3", { className: "text-sm font-semibold text-foreground", children: t('admin.settings.dateFormatTitle') })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: t('admin.settings.dateFormatDesc') })] }), _jsx("div", { className: "divide-y divide-border/40", children: [
                            { value: 'auto', label: t('admin.settings.dateFormatAuto'), desc: t('admin.settings.dateFormatAutoDesc') },
                            { value: 'dmy', label: t('admin.settings.dateFormatDmy'), desc: t('admin.settings.dateFormatDmyDesc') },
                            { value: 'mdy', label: t('admin.settings.dateFormatMdy'), desc: t('admin.settings.dateFormatMdyDesc') },
                            { value: 'ymd', label: t('admin.settings.dateFormatYmd'), desc: t('admin.settings.dateFormatYmdDesc') },
                        ].map((opt) => {
                            // Live preview, resolved against the current number format + UI
                            // language. Sample 4 June makes the day/month order unambiguous.
                            const adminCurrency = currentUser?.preferences?.currency_display ?? 'USD';
                            const dateLocale = resolveDateLocale(opt.value, numberFormat, adminCurrency, resolveSupportedLang(i18n.resolvedLanguage ?? i18n.language));
                            const numericExample = new Date(2026, 5, 4).toLocaleDateString(dateLocale);
                            const wordedExample = new Date(2026, 5, 4).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' });
                            return (_jsxs("button", { type: "button", onClick: () => updateDateFormatMutation.mutate(opt.value), disabled: updateDateFormatMutation.isPending, className: "flex items-start gap-3 w-full px-5 py-4 text-left hover:bg-muted/40 transition-colors", children: [_jsx("div", { className: `mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 ${dateFormat === opt.value ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`, children: dateFormat === opt.value && _jsx("div", { className: "h-full w-full rounded-full bg-primary ring-2 ring-background ring-inset" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-baseline gap-2 flex-wrap", children: [_jsx("p", { className: "text-sm font-medium text-foreground tabular-nums", children: opt.label }), _jsxs("span", { className: "text-xs tabular-nums text-muted-foreground", children: [numericExample, " ", _jsx("span", { className: "opacity-50", children: "\u00B7" }), " ", wordedExample] })] }), opt.desc && (_jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: opt.desc }))] })] }, opt.value));
                        }) })] }), _jsxs("div", { className: "rounded-xl border border-border/60 bg-card overflow-hidden", children: [_jsx("div", { className: "px-5 py-4 border-b border-border/40", children: _jsxs("div", { className: "flex items-center gap-2 mb-0.5", children: [_jsx(UserCog, { size: 15, className: "text-muted-foreground" }), _jsx("h3", { className: "text-sm font-semibold text-foreground", children: t('admin.settings.registrationTitle') })] }) }), settingsLoading ? (_jsx("div", { className: "p-5", children: _jsx(Skeleton, { className: "h-8 w-48" }) })) : (_jsxs("div", { className: "px-5 py-4 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-foreground", children: t('admin.settings.registration') }), _jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: t('admin.settings.registrationDesc') })] }), _jsx("button", { "aria-label": t('admin.settings.registration'), onClick: () => updateSettingMutation.mutate(isEnabled ? 'false' : 'true'), disabled: updateSettingMutation.isPending, className: `relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isEnabled ? 'bg-primary' : 'bg-muted-foreground/20'}`, children: _jsx("span", { className: `pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}` }) })] }))] }), _jsx(Dialog, { open: createOpen, onOpenChange: setCreateOpen, children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('admin.users.add') }), _jsx(DialogDescription, { children: t('admin.users.addDesc') })] }), _jsxs("form", { onSubmit: (e) => {
                                e.preventDefault();
                                createMutation.mutate({
                                    email: formEmail,
                                    password: formPassword,
                                    is_superuser: formIsAdmin,
                                    preferences: { language: formLanguage, currency_display: formCurrency },
                                });
                            }, children: [_jsxs("div", { className: "space-y-4 py-2", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { className: "text-[13px]", children: t('admin.users.email') }), _jsx(Input, { type: "email", value: formEmail, onChange: (e) => setFormEmail(e.target.value), required: true, className: "h-10 rounded-lg", placeholder: "user@example.com" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { className: "text-[13px]", children: t('auth.password') }), _jsx(Input, { type: "password", value: formPassword, onChange: (e) => setFormPassword(e.target.value), required: true, minLength: 8, className: "h-10 rounded-lg" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { className: "text-[13px]", children: t('setup.language') }), _jsx("select", { value: formLanguage, onChange: (e) => setFormLanguage(e.target.value), className: "w-full h-10 rounded-lg border border-input bg-card px-3 text-sm", children: SUPPORTED_LANGS.map(({ code, label }) => (_jsx("option", { value: code, children: label }, code))) })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { className: "text-[13px]", children: t('setup.currency') }), _jsxs(Select, { value: formCurrency, onValueChange: setFormCurrency, children: [_jsx(SelectTrigger, { className: "h-10 rounded-lg w-full", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: (supportedCurrencies ?? []).map((c) => (_jsxs(SelectItem, { value: c.code, children: [c.flag, " ", c.code, " \u2014 ", c.name] }, c.code))) })] })] })] }), _jsxs("button", { type: "button", onClick: () => setFormIsAdmin(!formIsAdmin), className: `flex items-center gap-2 w-full px-3.5 py-2.5 rounded-lg border text-sm font-medium transition-all ${formIsAdmin ? 'bg-primary/8 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:border-border/80'}`, children: [formIsAdmin ? _jsx(Shield, { size: 15 }) : _jsx(ShieldOff, { size: 15 }), _jsx("span", { className: "flex-1 text-left", children: t('admin.users.adminRole') }), _jsx("span", { className: `text-xs ${formIsAdmin ? 'text-primary' : 'text-muted-foreground/60'}`, children: formIsAdmin ? t('admin.users.enabled') : t('admin.users.disabled') })] })] }), _jsxs(DialogFooter, { className: "mt-4", children: [_jsx(Button, { variant: "outline", type: "button", onClick: () => setCreateOpen(false), className: "rounded-lg", children: t('common.cancel') }), _jsx(Button, { type: "submit", disabled: createMutation.isPending, className: "rounded-lg", children: createMutation.isPending ? t('common.loading') : t('common.save') })] })] })] }) }), _jsx(Dialog, { open: !!editUser, onOpenChange: (open) => !open && setEditUser(null), children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('admin.users.edit') }) }), editUser && (_jsxs("form", { onSubmit: (e) => {
                                e.preventDefault();
                                const updates = { id: editUser.id };
                                if (editEmail !== editUser.email)
                                    updates.email = editEmail;
                                if (editIsActive !== editUser.is_active)
                                    updates.is_active = editIsActive;
                                if (editIsAdmin !== editUser.is_superuser)
                                    updates.is_superuser = editIsAdmin;
                                if (editPassword && editPassword.length >= 8)
                                    updates.password = editPassword;
                                updateMutation.mutate(updates);
                            }, children: [_jsxs("div", { className: "space-y-4 py-2", children: [_jsxs("div", { className: "flex items-center gap-3 pb-2", children: [_jsx(Avatar, { className: "h-10 w-10", children: _jsx(AvatarFallback, { className: editUser.is_superuser ? 'bg-primary/15 text-primary font-semibold' : 'bg-muted text-muted-foreground font-semibold', children: editUser.email.charAt(0).toUpperCase() }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium", children: editUser.email }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [editUser.is_superuser ? t('admin.users.admin') : t('admin.users.user'), isSelf(editUser) && ` — ${t('admin.users.you')}`] })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { className: "text-[13px]", children: t('admin.users.email') }), _jsx(Input, { type: "email", value: editEmail, onChange: (e) => setEditEmail(e.target.value), required: true, autoComplete: "off", className: "h-10 rounded-lg" })] }), localAuthEnabled && (showPasswordField ? (_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { className: "text-[13px]", children: t('admin.users.resetPassword') }), _jsx(Input, { type: "text", value: editPassword, onChange: (e) => setEditPassword(e.target.value), placeholder: t('admin.users.resetPasswordPlaceholder'), minLength: 8, maxLength: 72, autoComplete: "off", autoFocus: true, className: "h-10 rounded-lg" })] })) : (_jsx(Button, { type: "button", variant: "outline", className: "w-full rounded-lg", onClick: () => setShowPasswordField(true), children: t('admin.users.resetPassword') }))), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { type: "button", onClick: () => !isSelf(editUser) && setEditIsActive(!editIsActive), disabled: isSelf(editUser), className: `flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${isSelf(editUser) ? 'opacity-50 cursor-not-allowed' : ''} ${editIsActive ? 'bg-emerald-500/8 border-emerald-500/30 text-emerald-600' : 'border-border text-muted-foreground'}`, children: [_jsx("span", { className: `h-2 w-2 rounded-full ${editIsActive ? 'bg-emerald-500' : 'bg-muted-foreground/30'}` }), editIsActive ? t('admin.users.active') : t('admin.users.inactive')] }), _jsxs("button", { type: "button", onClick: () => !isSelf(editUser) && setEditIsAdmin(!editIsAdmin), disabled: isSelf(editUser), className: `flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${isSelf(editUser) ? 'opacity-50 cursor-not-allowed' : ''} ${editIsAdmin ? 'bg-primary/8 border-primary/30 text-primary' : 'border-border text-muted-foreground'}`, children: [editIsAdmin ? _jsx(Shield, { size: 14 }) : _jsx(ShieldOff, { size: 14 }), t('admin.users.admin')] })] })] }), _jsxs(DialogFooter, { className: "mt-4", children: [_jsx(Button, { variant: "outline", type: "button", onClick: () => setEditUser(null), className: "rounded-lg", children: t('common.cancel') }), _jsx(Button, { type: "submit", disabled: updateMutation.isPending, className: "rounded-lg", children: updateMutation.isPending ? t('common.loading') : t('common.save') })] })] }))] }) }), _jsx(Dialog, { open: !!deleteUser, onOpenChange: (open) => !open && setDeleteUser(null), children: _jsxs(DialogContent, { className: "sm:max-w-sm", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('admin.users.confirmDeleteTitle') }), _jsx(DialogDescription, { children: t('admin.users.confirmDeleteDesc', { email: deleteUser?.email }) })] }), _jsxs(DialogFooter, { className: "mt-2", children: [_jsx(Button, { variant: "outline", onClick: () => setDeleteUser(null), className: "rounded-lg", children: t('common.cancel') }), _jsx(Button, { variant: "destructive", disabled: deleteMutation.isPending, onClick: () => deleteUser && deleteMutation.mutate(deleteUser.id), className: "rounded-lg", children: deleteMutation.isPending ? t('common.loading') : t('common.delete') })] })] }) })] }));
}
