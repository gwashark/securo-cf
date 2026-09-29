import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDateLocale } from '../hooks/use-display-locale.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { auth as authApi, currencies as currenciesApi, fiscal as fiscalApi, workspaces as workspacesApi } from '../lib/api.js';
import { useTimezones } from '../hooks/use-timezone.js';
import { TimezoneSelect } from '../components/timezone-select.js';
import { useAuth } from '../contexts/auth-context.js';
import { useWorkspace } from '../contexts/workspace-context.js';
import { useLocalAuthEnabled } from '../hooks/use-local-auth.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Avatar, AvatarFallback } from '../components/ui/avatar.js';
import { Badge } from '../components/ui/badge.js';
import { Skeleton } from '../components/ui/skeleton.js';
import { IconPicker } from '../components/icon-picker.js';
import { CategoryIcon } from '../components/category-icon.js';
import { Popover, PopoverContent, PopoverTrigger, } from '../components/ui/popover.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '../components/ui/select.js';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '../components/ui/dialog.js';
import { AlertTriangle, Archive, Plus, Save, Trash2, Users } from 'lucide-react';
import { WORKSPACE_KIND_LABEL_KEY } from '../lib/workspace-kinds.js';
import { SUPPORTED_LANGS } from '../lib/i18n.js';
import { countryFlag } from '../lib/country-flag.js';
import { countryName } from '../lib/country-name.js';
function labelForRole(role, t) {
    return {
        owner: t('workspace.roleOwner'),
        editor: t('workspace.roleEditor'),
        viewer: t('workspace.roleViewer'),
        manager: t('workspace.roleManager'),
    }[role];
}
function hintForRole(role, t) {
    return {
        owner: t('workspace.roleOwnerHint'),
        editor: t('workspace.roleEditorHint'),
        viewer: t('workspace.roleViewerHint'),
        manager: t('workspace.roleManagerHint'),
    }[role];
}
function formatDate(iso, locale) {
    try {
        return new Date(iso).toLocaleDateString(locale, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    }
    catch {
        return iso.slice(0, 10);
    }
}
const DEFAULT_WORKSPACE_COLOR = '#6366F1';
const DEFAULT_WORKSPACE_ICON = 'briefcase';
export default function WorkspaceSettingsPage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const localeForFormat = useDateLocale();
    const { current, canManage, workspaces: allWorkspaces, refresh, switchWorkspace } = useWorkspace();
    const { user: currentUser, updateUser } = useAuth();
    const queryClient = useQueryClient();
    const [editName, setEditName] = useState('');
    const [editCurrency, setEditCurrency] = useState('');
    const [editLocale, setEditLocale] = useState('');
    const [editJurisdiction, setEditJurisdiction] = useState('');
    const [editTimezone, setEditTimezone] = useState('');
    const [editIcon, setEditIcon] = useState(DEFAULT_WORKSPACE_ICON);
    const [editColor, setEditColor] = useState(DEFAULT_WORKSPACE_COLOR);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [invitePassword, setInvitePassword] = useState('');
    const [inviteRole, setInviteRole] = useState('editor');
    const [removeTarget, setRemoveTarget] = useState(null);
    const [archiveOpen, setArchiveOpen] = useState(false);
    const formKey = JSON.stringify([current?.id, current?.name, current?.default_currency, current?.locale, current?.tax_jurisdiction, current?.timezone, current?.icon, current?.color]);
    const [previousFormKey, setPreviousFormKey] = useState(null);
    if (formKey !== previousFormKey) {
        setPreviousFormKey(formKey);
        if (current) {
            setEditName(current.name);
            setEditCurrency(current.default_currency);
            setEditLocale(current.locale ?? '');
            setEditJurisdiction(current.tax_jurisdiction ?? '');
            setEditTimezone(current.timezone ?? '');
            setEditIcon(current.icon ?? DEFAULT_WORKSPACE_ICON);
            setEditColor(current.color ?? DEFAULT_WORKSPACE_COLOR);
        }
    }
    // Which jurisdictions ship a pack. An empty choice is valid, not missing:
    // with none set, documents are stored as free text with no mask.
    const { data: jurisdictions } = useQuery({
        queryKey: ['fiscal-jurisdictions'],
        queryFn: fiscalApi.jurisdictions,
        staleTime: Infinity,
    });
    const membersQuery = useQuery({
        queryKey: ['workspace-members', current?.id],
        queryFn: () => (current ? workspacesApi.listMembers(current.id) : Promise.resolve([])),
        enabled: !!current,
    });
    const { data: supportedCurrencies } = useQuery({
        queryKey: ['currencies'],
        queryFn: currenciesApi.list,
        staleTime: Infinity,
    });
    // Every workspace can keep its own calendar; the default is what the
    // application runs on when a workspace has none.
    const { data: timezoneOptions } = useTimezones();
    const localAuthEnabled = useLocalAuthEnabled();
    // The server lists codes; the user reads names. Sorted by the name actually
    // shown, in the reader's own collation.
    const sortedJurisdictions = useMemo(() => [...(jurisdictions ?? [])].sort((a, b) => countryName(a, i18n.language).localeCompare(countryName(b, i18n.language), i18n.language)), [jurisdictions, i18n.language]);
    const statsQuery = useQuery({
        queryKey: ['workspace-stats', current?.id],
        queryFn: () => (current ? workspacesApi.stats(current.id) : Promise.resolve({ members: 0, accounts: 0, transactions: 0 })),
        enabled: !!current,
    });
    const updateMutation = useMutation({
        mutationFn: () => {
            if (!current)
                throw new Error('No workspace');
            return workspacesApi.update(current.id, {
                name: editName,
                default_currency: editCurrency,
                locale: editLocale || null,
                tax_jurisdiction: editJurisdiction || null,
                timezone: editTimezone || null,
                icon: editIcon,
                color: editColor,
            });
        },
        onSuccess: () => {
            toast.success(t('workspace.saveSuccess'));
            void refresh();
            // Changing the workspace currency also updates the acting user's
            // display currency server-side; refresh the cached user so the
            // whole app re-renders in the new currency, then drop currency-
            // dependent queries.
            void authApi.me().then(updateUser).catch(() => { });
            void queryClient.invalidateQueries();
        },
        onError: (e) => {
            const detail = e?.response?.data?.detail ||
                (e instanceof Error ? e.message : t('workspace.saveError'));
            toast.error(detail);
        },
    });
    const archiveMutation = useMutation({
        mutationFn: () => {
            if (!current)
                throw new Error('No workspace');
            return workspacesApi.archive(current.id);
        },
        onSuccess: async () => {
            toast.success(t('workspace.archiveSuccess', 'Workspace arquivado'));
            setArchiveOpen(false);
            await refresh();
            // Switch into another accessible workspace, then redirect home.
            const remaining = allWorkspaces.filter((w) => w.id !== current?.id);
            if (remaining.length > 0) {
                await switchWorkspace(remaining[0].id);
            }
            navigate('/');
        },
        onError: (e) => {
            const detail = e?.response?.data?.detail ||
                (e instanceof Error ? e.message : 'Failed');
            toast.error(detail);
        },
    });
    const inviteMutation = useMutation({
        mutationFn: () => {
            if (!current)
                throw new Error('No workspace');
            return workspacesApi.invite(current.id, {
                email: inviteEmail.trim(),
                role: inviteRole,
                password: localAuthEnabled ? (invitePassword || undefined) : undefined,
            });
        },
        onSuccess: () => {
            toast.success(t('workspace.addSuccess'));
            setInviteOpen(false);
            setInviteEmail('');
            setInvitePassword('');
            setInviteRole('editor');
            queryClient.invalidateQueries({ queryKey: ['workspace-members', current?.id] });
            queryClient.invalidateQueries({ queryKey: ['workspace-stats', current?.id] });
        },
        onError: (e) => {
            const detail = e?.response?.data?.detail ||
                (e instanceof Error ? e.message : 'Failed');
            toast.error(detail);
        },
    });
    const removeMutation = useMutation({
        mutationFn: (member) => {
            if (!current)
                throw new Error('No workspace');
            return workspacesApi.removeMember(current.id, member.user_id);
        },
        onSuccess: () => {
            toast.success(t('workspace.removeSuccess'));
            setRemoveTarget(null);
            queryClient.invalidateQueries({ queryKey: ['workspace-members', current?.id] });
            queryClient.invalidateQueries({ queryKey: ['workspace-stats', current?.id] });
        },
        onError: (e) => {
            const detail = e?.response?.data?.detail ||
                (e instanceof Error ? e.message : 'Failed');
            toast.error(detail);
        },
    });
    const roleChangeMutation = useMutation({
        mutationFn: ({ member, role }) => {
            if (!current)
                throw new Error('No workspace');
            return workspacesApi.changeRole(current.id, member.user_id, role);
        },
        onSuccess: () => {
            toast.success(t('workspace.roleUpdated'));
            queryClient.invalidateQueries({ queryKey: ['workspace-members', current?.id] });
        },
        onError: (e) => {
            const detail = e?.response?.data?.detail ||
                (e instanceof Error ? e.message : 'Failed');
            toast.error(detail);
        },
    });
    if (!current) {
        return (_jsxs("div", { className: "container max-w-5xl py-8 space-y-4", children: [_jsx(Skeleton, { className: "h-24 w-full" }), _jsx(Skeleton, { className: "h-64 w-full" })] }));
    }
    const members = membersQuery.data ?? [];
    const stats = statsQuery.data ?? { members: 1, accounts: 0, transactions: 0 };
    const isManaged = !!current.managed_by_user_id;
    const isManagerSelf = isManaged && current.managed_by_user_id === currentUser?.id;
    const kindLabelKey = WORKSPACE_KIND_LABEL_KEY[current.kind];
    return (_jsxs("div", { className: "container max-w-5xl py-8 space-y-6", children: [_jsxs("section", { className: "rounded-xl border bg-card overflow-hidden", children: [_jsxs("div", { className: "p-6 flex items-center gap-5 border-b", children: [_jsx(CategoryIcon, { icon: current.icon ?? DEFAULT_WORKSPACE_ICON, color: current.color ?? DEFAULT_WORKSPACE_COLOR, size: "lg", className: "shrink-0" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("h1", { className: "text-xl font-semibold truncate", children: current.name }), kindLabelKey && (_jsx(Badge, { variant: "outline", className: "text-[11px]", children: t(kindLabelKey) })), current.role && (_jsx(Badge, { variant: "secondary", className: "text-[11px]", children: labelForRole(current.role, t) })), isManaged && (_jsx(Badge, { variant: "outline", className: "text-[11px]", children: isManagerSelf
                                                    ? t('workspace.youManageThis')
                                                    : t('workspace.externallyManaged') }))] }), _jsx("p", { className: "text-sm text-muted-foreground mt-1", children: t('workspace.settingsDescription') })] })] }), _jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 divide-x divide-border", children: [_jsx(StatTile, { label: t('workspace.members'), value: String(stats.members) }), _jsx(StatTile, { label: t('workspace.statAccounts', 'Contas'), value: String(stats.accounts) }), _jsx(StatTile, { label: t('workspace.statTransactions', 'Transações'), value: String(stats.transactions) }), _jsx(StatTile, { label: t('workspace.statCreatedAt', 'Criado em'), value: formatDate(current.created_at, localeForFormat) })] })] }), _jsxs("section", { className: "space-y-4 rounded-xl border bg-card p-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-base font-semibold", children: t('workspace.details') }), canManage && (_jsxs(Button, { onClick: () => updateMutation.mutate(), disabled: updateMutation.isPending, className: "rounded-lg", size: "sm", children: [_jsx(Save, { className: "mr-2 h-4 w-4" }), updateMutation.isPending ? t('common.loading') : t('common.save')] }))] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-end gap-2", children: [canManage ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { className: "text-[13px]", children: t('workspace.icon', 'Icon') }), _jsxs(Popover, { children: [_jsx(PopoverTrigger, { asChild: true, children: _jsx("button", { type: "button", className: "h-10 w-10 rounded-lg border border-input flex items-center justify-center hover:bg-muted/40 transition-colors shrink-0", title: t('workspace.icon', 'Icon'), children: _jsx(CategoryIcon, { icon: editIcon, color: editColor, size: "sm" }) }) }), _jsx(PopoverContent, { className: "w-80 p-3", align: "start", children: _jsx(IconPicker, { value: editIcon, color: editColor, onChange: setEditIcon }) })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "ws-color", className: "text-[13px]", children: t('groups.color', 'Color') }), _jsx("input", { id: "ws-color", type: "color", value: editColor, onChange: (e) => setEditColor(e.target.value), className: "h-10 w-10 p-1 rounded-lg cursor-pointer border border-input bg-card shrink-0", title: t('groups.color', 'Color') })] })] })) : (_jsx("div", { className: "h-10 w-10 rounded-lg flex items-center justify-center shrink-0", children: _jsx(CategoryIcon, { icon: editIcon, color: editColor, size: "sm" }) })), _jsxs("div", { className: "space-y-1.5 flex-1", children: [_jsx(Label, { htmlFor: "ws-name", className: "text-[13px]", children: t('workspace.name') }), _jsx(Input, { id: "ws-name", value: editName, onChange: (e) => setEditName(e.target.value), disabled: !canManage, maxLength: 100, className: "h-10 rounded-lg w-full" })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "ws-currency", className: "text-[13px]", children: t('workspace.defaultCurrency') }), _jsxs(Select, { value: editCurrency, onValueChange: setEditCurrency, disabled: !canManage, children: [_jsx(SelectTrigger, { id: "ws-currency", className: "h-10 rounded-lg w-full", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: (supportedCurrencies ?? [{ code: editCurrency, symbol: editCurrency, name: editCurrency, flag: '' }]).map((c) => (_jsxs(SelectItem, { value: c.code, children: [_jsx("span", { className: "mr-2", children: c.flag }), c.name] }, c.code))) })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "ws-locale", className: "text-[13px]", children: t('workspace.locale') }), _jsxs(Select, { value: editLocale || '__none__', onValueChange: (v) => setEditLocale(v === '__none__' ? '' : v), disabled: !canManage, children: [_jsx(SelectTrigger, { id: "ws-locale", className: "h-10 rounded-lg w-full", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "__none__", children: "\u2014" }), SUPPORTED_LANGS.map(({ code, label }) => (_jsx(SelectItem, { value: code, children: label }, code)))] })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "ws-jurisdiction", className: "text-[13px]", children: t('workspace.taxJurisdiction', 'Tax jurisdiction') }), _jsxs(Select, { value: editJurisdiction || '__none__', onValueChange: (v) => setEditJurisdiction(v === '__none__' ? '' : v), disabled: !canManage, children: [_jsx(SelectTrigger, { id: "ws-jurisdiction", className: "h-10 rounded-lg w-full", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "__none__", children: "\u2014" }), sortedJurisdictions.map((code) => (_jsxs(SelectItem, { value: code, children: [_jsx("span", { className: "mr-2", children: countryFlag(code) }), countryName(code, i18n.language)] }, code)))] })] }), _jsx("p", { className: "text-[11px] text-muted-foreground leading-relaxed", children: t('workspace.taxJurisdictionHint', 'Decides which fiscal documents this workspace is offered. Separate from the interface language.') })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "ws-timezone", className: "text-[13px]", children: t('workspace.timezone') }), _jsx(TimezoneSelect, { id: "ws-timezone", className: "h-10 rounded-lg w-full", value: editTimezone, onChange: setEditTimezone, options: timezoneOptions?.available ?? (editTimezone ? [editTimezone] : []), emptyOption: t('workspace.timezoneDefault', { zone: timezoneOptions?.default ?? 'UTC' }), disabled: !canManage }), _jsx("p", { className: "text-[11px] text-muted-foreground leading-relaxed", children: t('workspace.timezoneHint') })] })] })] })] }), _jsxs("section", { className: "space-y-4 rounded-xl border bg-card p-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Users, { className: "h-4 w-4 text-muted-foreground" }), _jsx("h2", { className: "text-base font-semibold", children: t('workspace.members') }), _jsx(Badge, { variant: "outline", className: "text-[11px]", children: members.length })] }), canManage && (_jsxs(Button, { onClick: () => setInviteOpen(true), size: "sm", className: "rounded-lg", children: [_jsx(Plus, { className: "mr-2 h-4 w-4" }), t('workspace.addMember')] }))] }), membersQuery.isLoading ? (_jsx(Skeleton, { className: "h-16 w-full" })) : members.length === 0 ? (_jsxs("p", { className: "text-sm text-muted-foreground", children: [t('workspace.noMembers'), " ", canManage && t('workspace.noMembersHint')] })) : (_jsx("ul", { className: "divide-y rounded-lg border", children: members.map((m) => {
                            const isMe = m.user_id === currentUser?.id;
                            return (_jsxs("li", { className: "py-3 px-4 flex items-center gap-3 hover:bg-muted/30 transition-colors", children: [_jsx(Avatar, { className: "h-9 w-9", children: _jsx(AvatarFallback, { className: "bg-primary/15 text-primary text-xs font-semibold", children: (m.display_name || m.email).slice(0, 2).toUpperCase() }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("p", { className: "text-sm font-medium truncate", children: [m.display_name || m.email, isMe && (_jsxs("span", { className: "ml-2 text-xs text-muted-foreground", children: ["(", t('workspace.you'), ")"] }))] }), m.display_name && (_jsx("p", { className: "text-xs text-muted-foreground truncate", children: m.email }))] }), canManage && !isMe ? (_jsx("select", { value: m.role, onChange: (e) => roleChangeMutation.mutate({
                                            member: m,
                                            role: e.target.value,
                                        }), className: "h-9 w-32 rounded-lg border border-input bg-card px-2 text-sm", children: ['owner', 'editor', 'viewer'].map((r) => (_jsx("option", { value: r, children: labelForRole(r, t) }, r))) })) : (_jsx(Badge, { variant: "secondary", className: "text-[11px]", children: labelForRole(m.role, t) })), canManage && !isMe && (_jsx(Button, { variant: "ghost", size: "icon", onClick: () => setRemoveTarget(m), title: t('workspace.remove'), className: "rounded-lg", children: _jsx(Trash2, { className: "h-4 w-4 text-destructive" }) }))] }, m.id));
                        }) }))] }), canManage && (_jsxs("section", { className: "space-y-4 rounded-xl border bg-card p-6", children: [_jsx("div", { className: "flex items-center justify-between", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(AlertTriangle, { className: "h-4 w-4 text-muted-foreground" }), _jsx("h2", { className: "text-base font-semibold", children: t('workspace.dangerZone', 'Zona de perigo') })] }) }), _jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium", children: t('workspace.archiveAction', 'Arquivar workspace') }), _jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: t('workspace.archiveHint', 'O workspace fica oculto da lista e do switcher. Os dados continuam preservados.') })] }), _jsxs(Button, { variant: "outline", size: "sm", className: "rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive", onClick: () => setArchiveOpen(true), children: [_jsx(Archive, { className: "mr-2 h-4 w-4" }), t('workspace.archive', 'Arquivar')] })] })] })), _jsx(Dialog, { open: inviteOpen, onOpenChange: setInviteOpen, children: _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('workspace.addMemberTitle') }), _jsx(DialogDescription, { children: t(localAuthEnabled
                                        ? 'workspace.addMemberDescription'
                                        : 'workspace.addMemberDescriptionExistingOnly') })] }), _jsxs("div", { className: "space-y-4 py-1", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "invite-email", className: "text-[13px]", children: t('admin.users.email', 'Email') }), _jsx(Input, { id: "invite-email", type: "email", value: inviteEmail, onChange: (e) => setInviteEmail(e.target.value), autoFocus: true, className: "h-10 rounded-lg", placeholder: "user@example.com" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "invite-role", className: "text-[13px]", children: t('workspace.role') }), _jsx("select", { id: "invite-role", value: inviteRole, onChange: (e) => setInviteRole(e.target.value), className: "w-full h-10 rounded-lg border border-input bg-card px-3 text-sm", children: ['owner', 'editor', 'viewer'].map((r) => (_jsxs("option", { value: r, children: [labelForRole(r, t), " \u2014 ", hintForRole(r, t)] }, r))) })] }), localAuthEnabled && (_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "invite-password", className: "text-[13px]", children: t('workspace.passwordForNewUsers') }), _jsx(Input, { id: "invite-password", type: "password", value: invitePassword, onChange: (e) => setInvitePassword(e.target.value), className: "h-10 rounded-lg", placeholder: "" }), _jsx("p", { className: "text-[11px] text-muted-foreground leading-relaxed", children: t('workspace.passwordHint') })] }))] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setInviteOpen(false), className: "rounded-lg", children: t('common.cancel') }), _jsx(Button, { onClick: () => inviteMutation.mutate(), disabled: inviteMutation.isPending || !inviteEmail.trim(), className: "rounded-lg", children: inviteMutation.isPending ? t('common.loading') : t('common.save') })] })] }) }), _jsx(Dialog, { open: !!removeTarget, onOpenChange: (open) => !open && setRemoveTarget(null), children: _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('workspace.removeConfirmTitle') }), _jsx(DialogDescription, { children: t('workspace.removeConfirmDescription', { email: removeTarget?.email }) })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setRemoveTarget(null), className: "rounded-lg", children: t('common.cancel') }), _jsx(Button, { variant: "destructive", onClick: () => removeTarget && removeMutation.mutate(removeTarget), disabled: removeMutation.isPending, className: "rounded-lg", children: removeMutation.isPending ? t('common.loading') : t('workspace.remove') })] })] }) }), _jsx(Dialog, { open: archiveOpen, onOpenChange: setArchiveOpen, children: _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('workspace.archiveConfirmTitle', 'Arquivar workspace?') }), _jsx(DialogDescription, { children: t('workspace.archiveConfirmDescription', 'O workspace "{{name}}" será removido da sua lista. Os dados ficam preservados e um admin pode restaurar mais tarde.', { name: current.name }) })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setArchiveOpen(false), className: "rounded-lg", children: t('common.cancel') }), _jsxs(Button, { variant: "destructive", onClick: () => archiveMutation.mutate(), disabled: archiveMutation.isPending, className: "rounded-lg", children: [_jsx(Archive, { className: "mr-2 h-4 w-4" }), archiveMutation.isPending ? t('common.loading') : t('workspace.archive', 'Arquivar')] })] })] }) })] }));
}
function StatTile({ label, value }) {
    return (_jsxs("div", { className: "px-6 py-4", children: [_jsx("p", { className: "text-[11px] uppercase tracking-wider text-muted-foreground", children: label }), _jsx("p", { className: "text-lg font-semibold mt-1", children: value })] }));
}
