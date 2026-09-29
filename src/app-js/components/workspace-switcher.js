import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '../contexts/auth-context.js';
import { useWorkspace } from '../contexts/workspace-context.js';
import { workspaces as workspacesApi } from '../lib/api.js';
import { resolveSupportedLang } from '../lib/i18n.js';
import { cn } from '../lib/utils.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, } from './ui/dropdown-menu.js';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from './ui/dialog.js';
import { Check, ChevronsUpDown, Download, HardDriveDownload, KeyRound, Languages, LogOut, Plus, Settings, Shield, ShieldCheck, Sparkles, Fingerprint, } from 'lucide-react';
import { CategoryIcon } from './category-icon.js';
import { WORKSPACE_KINDS, WORKSPACE_KIND_ICON, WORKSPACE_KIND_LABEL_KEY, } from '../lib/workspace-kinds.js';
const ROLE_LABEL_KEY = {
    owner: 'workspace.roleOwner',
    editor: 'workspace.roleEditor',
    viewer: 'workspace.roleViewer',
    manager: 'workspace.roleManager',
};
// Fallback when a workspace hasn't set its own color yet.
const DEFAULT_COLOR = '#6366F1';
function workspaceIcon(w) {
    return w.icon || WORKSPACE_KIND_ICON[w.kind] || 'briefcase';
}
function workspaceColor(w) {
    return w.color || DEFAULT_COLOR;
}
/**
 * Unified account menu: workspace identity on the trigger, all
 * workspace + account actions in one dropdown. Replaces the previous
 * standalone workspace switcher + separate user dropdown.
 *
 * Dialogs (change password, 2FA, update available) stay owned by the
 * parent layout — they're shared with other surfaces and the menu
 * only needs to trigger them.
 */
export function WorkspaceSwitcher({ onChangePassword, onTwoFactor, onPasskeys, onBackup, onUpdateAvailable, agentsEnabled, localAuthEnabled, collapsed = false, }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { current, workspaces, switchWorkspace, refresh } = useWorkspace();
    const { user, logout } = useAuth();
    const [createOpen, setCreateOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newKind, setNewKind] = useState('personal');
    const currentLang = resolveSupportedLang(i18n.resolvedLanguage ?? i18n.language);
    const createMutation = useMutation({
        mutationFn: () => workspacesApi.create({
            name: newName.trim(),
            kind: newKind,
            self_membership: true,
            locale: currentLang,
        }),
        onSuccess: async (ws) => {
            toast.success(t('workspace.createSuccess', 'Workspace created'));
            await refresh();
            await switchWorkspace(ws.id);
            setCreateOpen(false);
            setNewName('');
            setNewKind('personal');
            navigate('/workspace/settings');
        },
        onError: (e) => {
            const detail = e?.response?.data?.detail ||
                (e instanceof Error ? e.message : 'Failed to create workspace');
            toast.error(detail);
        },
    });
    if (!current || !user)
        return null;
    const hasMultipleWorkspaces = workspaces.length > 1;
    const roleLabel = current.role && ROLE_LABEL_KEY[current.role]
        ? t(ROLE_LABEL_KEY[current.role])
        : null;
    return (_jsxs(_Fragment, { children: [_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs("button", { className: cn('flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm hover:bg-sidebar-accent transition-colors text-left', collapsed && 'lg:justify-center lg:px-2'), "aria-label": current.name, title: current.name, children: [_jsx(CategoryIcon, { icon: workspaceIcon(current), color: workspaceColor(current), size: "sm", className: "shrink-0" }), _jsxs("div", { className: cn('flex-1 min-w-0', collapsed && 'lg:hidden'), children: [_jsx("p", { className: "text-xs font-semibold truncate", children: current.name }), _jsxs("p", { className: "text-[10px] text-sidebar-muted/70 truncate", children: [user.email, roleLabel && (_jsxs("span", { className: "ml-1 uppercase tracking-wide", children: ["\u00B7 ", roleLabel] }))] })] }), _jsx(ChevronsUpDown, { size: 13, className: cn('text-sidebar-muted/60 shrink-0', collapsed && 'lg:hidden') })] }) }), _jsxs(DropdownMenuContent, { align: "start", className: "w-64", side: "top", children: [hasMultipleWorkspaces && (_jsxs(_Fragment, { children: [_jsx(DropdownMenuLabel, { className: "px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70", children: t('workspace.switcherTitle', 'Switch workspace') }), workspaces.map((w) => {
                                        const isActive = w.id === current.id;
                                        return (_jsxs(DropdownMenuItem, { onClick: () => void switchWorkspace(w.id), className: "flex items-center gap-2", children: [_jsx(CategoryIcon, { icon: workspaceIcon(w), color: workspaceColor(w), size: "sm", className: "shrink-0" }), _jsx("span", { className: "flex-1 truncate", children: w.name }), _jsx("span", { className: "text-[10px] uppercase tracking-wide text-muted-foreground", children: w.role && ROLE_LABEL_KEY[w.role] && t(ROLE_LABEL_KEY[w.role]) }), isActive && _jsx(Check, { size: 12, className: "text-primary ml-1" })] }, w.id));
                                    }), _jsx(DropdownMenuSeparator, {})] })), _jsxs(DropdownMenuItem, { onClick: () => navigate('/workspace/settings'), className: "flex items-center gap-2", children: [_jsx(Settings, { size: 14 }), _jsx("span", { className: "flex-1", children: t('workspace.settingsMenu', 'Workspace settings') })] }), _jsxs(DropdownMenuItem, { onClick: () => setCreateOpen(true), className: "flex items-center gap-2", children: [_jsx(Plus, { size: 14 }), _jsx("span", { className: "flex-1", children: t('workspace.create', 'New workspace') })] }), _jsx(DropdownMenuSeparator, {}), user.is_superuser && (_jsxs(DropdownMenuItem, { onClick: () => navigate('/admin'), className: "flex items-center gap-2", children: [_jsx(Shield, { size: 14 }), t('nav.groupAdmin')] })), localAuthEnabled && (_jsxs(DropdownMenuItem, { onClick: onChangePassword, className: "flex items-center gap-2", children: [_jsx(KeyRound, { size: 14 }), t('auth.changePassword')] })), (localAuthEnabled || user.is_2fa_enabled) && (_jsxs(DropdownMenuItem, { onClick: onTwoFactor, className: "flex items-center gap-2", children: [_jsx(ShieldCheck, { size: 14 }), t(localAuthEnabled ? 'auth.twoFactorTitle' : 'auth.disable2fa')] })), _jsxs(DropdownMenuItem, { onClick: onPasskeys, className: "flex items-center gap-2", children: [_jsx(Fingerprint, { size: 14 }), t('auth.passkeysTitle')] }), _jsxs(DropdownMenuItem, { onClick: onBackup, className: "flex items-center gap-2", children: [_jsx(HardDriveDownload, { size: 14 }), t('backup.button')] }), agentsEnabled && (_jsxs(DropdownMenuItem, { onClick: () => navigate('/agents'), className: "flex items-center gap-2", children: [_jsx(Sparkles, { size: 14 }), t('nav.aiAgents')] })), _jsxs(DropdownMenuItem, { onClick: onUpdateAvailable, className: "flex items-center gap-2", children: [_jsx(Download, { size: 14 }), t('update.menuItem')] }), _jsxs(DropdownMenuSub, { children: [_jsxs(DropdownMenuSubTrigger, { className: "flex items-center gap-2", children: [_jsx(Languages, { size: 14 }), _jsx("span", { className: "flex-1", children: t('setup.language') }), _jsx("span", { className: "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground", children: currentLang.split('-')[0] })] }), _jsx(DropdownMenuPortal, { children: _jsxs(DropdownMenuSubContent, { className: "w-40", children: [_jsx(DropdownMenuLabel, { className: "px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70", children: t('setup.language') }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('ru'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439" }), currentLang === 'ru' && _jsx(Check, { size: 13, className: "text-primary" })] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('de'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "Deutsch" }), currentLang === 'de' && _jsx(Check, { size: 13, className: "text-primary" })] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('uk'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "\u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430" }), currentLang === 'uk' && _jsx(Check, { size: 13, className: "text-primary" })] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('pt-BR'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "Portugu\u00EAs (BR)" }), currentLang === 'pt-BR' && _jsx(Check, { size: 13, className: "text-primary" })] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('pt-PT'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "Portugu\u00EAs (PT)" }), currentLang === 'pt-PT' && _jsx(Check, { size: 13, className: "text-primary" })] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('en'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "English" }), currentLang === 'en' && _jsx(Check, { size: 13, className: "text-primary" })] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('es'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "Espa\u00F1ol" }), currentLang === 'es' && _jsx(Check, { size: 13, className: "text-primary" })] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('hi'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "\u0939\u093F\u0928\u094D\u0926\u0940" }), currentLang === 'hi' && _jsx(Check, { size: 13, className: "text-primary" })] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('pl'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "Polski" }), currentLang === 'pl' && _jsx(Check, { size: 13, className: "text-primary" })] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('it'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "Italiano" }), currentLang === 'it' && _jsx(Check, { size: 13, className: "text-primary" })] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('fr'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "Fran\u00E7ais" }), currentLang === 'fr' && _jsx(Check, { size: 13, className: "text-primary" })] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('nl'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "Nederlands" }), currentLang === 'nl' && _jsx(Check, { size: 13, className: "text-primary" })] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('sk'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "Sloven\u010Dina" }), currentLang === 'sk' && _jsx(Check, { size: 13, className: "text-primary" })] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('el'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "\u0395\u03BB\u03BB\u03B7\u03BD\u03B9\u03BA\u03AC" }), currentLang === 'el' && _jsx(Check, { size: 13, className: "text-primary" })] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('ja'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "\u65E5\u672C\u8A9E" }), currentLang === 'ja' && _jsx(Check, { size: 13, className: "text-primary" })] })] }) })] }), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { onClick: logout, className: "flex items-center gap-2 text-rose-600 focus:text-rose-600", children: [_jsx(LogOut, { size: 14 }), t('auth.logout')] })] })] }), _jsx(Dialog, { open: createOpen, onOpenChange: setCreateOpen, children: _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('workspace.createTitle', 'New workspace') }), _jsx(DialogDescription, { children: t('workspace.createDescription', 'A workspace holds its own accounts, categories, budgets, and goals. You can invite people into it from the workspace settings page.') })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "ws-create-name", className: "text-[13px]", children: t('common.name', 'Name') }), _jsx(Input, { id: "ws-create-name", value: newName, onChange: (e) => setNewName(e.target.value), placeholder: t('workspace.createPlaceholder', 'e.g. Side project, Family'), className: "h-10 rounded-lg", autoFocus: true, maxLength: 100 })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { className: "text-[13px]", children: t('workspace.kind', 'Type') }), _jsx("div", { className: "grid grid-cols-2 gap-2", children: WORKSPACE_KINDS.map((kind) => {
                                                const isSelected = kind === newKind;
                                                return (_jsxs("button", { type: "button", onClick: () => setNewKind(kind), "aria-pressed": isSelected, className: `flex items-center gap-2.5 rounded-lg border p-3 text-left transition-colors ${isSelected
                                                        ? 'border-primary bg-primary/5'
                                                        : 'border-input hover:bg-muted/40'}`, children: [_jsx(CategoryIcon, { icon: WORKSPACE_KIND_ICON[kind], color: isSelected ? DEFAULT_COLOR : '#94A3B8', size: "sm", className: "shrink-0" }), _jsx("span", { className: "text-[13px] font-medium leading-tight", children: t(WORKSPACE_KIND_LABEL_KEY[kind]) })] }, kind));
                                            }) }), _jsx("p", { className: "text-[11px] text-muted-foreground leading-relaxed", children: t('workspace.kindHint', "Pick what this workspace tracks. This can't be changed later.") })] })] }), _jsxs(DialogFooter, { className: "mt-2", children: [_jsx(Button, { variant: "outline", onClick: () => setCreateOpen(false), className: "rounded-lg", children: t('common.cancel') }), _jsx(Button, { onClick: () => createMutation.mutate(), disabled: createMutation.isPending || !newName.trim(), className: "rounded-lg", children: createMutation.isPending ? t('common.loading') : t('common.create', 'Create') })] })] }) })] }));
}
