import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from 'react';
import { getAccountName, sumAccountBalances } from '../lib/account-utils.js';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDisplayLocale } from '../hooks/use-display-locale.js';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/auth-context.js';
import { useCollectionFilter } from '../contexts/collection-filter-context.js';
import { useWorkspace } from '../contexts/workspace-context.js';
import { CollectionSelector } from './collection-selector.js';
import { auth as authApi, admin as adminApi } from '../lib/api.js';
import { resolveSupportedLang } from '../lib/i18n.js';
import { OnboardingTour } from './onboarding-tour.js';
import { useTheme } from 'next-themes';
import { accounts as accountsApi } from '../lib/api.js';
import { Button } from './ui/button.js';
import { Avatar, AvatarFallback } from './ui/avatar.js';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, } from './ui/dropdown-menu.js';
import { cn } from '../lib/utils.js';
import { APP_VERSION } from '../lib/build-info.js';
import { ShellLogo } from './shell-logo.js';
import { UpdateAvailableBanner } from './update-available-banner.js';
import { UpdateAvailableDialog } from './update-available-dialog.js';
import { WorkspaceSwitcher } from './workspace-switcher.js';
import { navItems, visibleNavItems } from '../lib/nav-items.js';
import { Menu, ChevronLeft, ChevronRight, Eye, EyeOff, Sun, Moon, Languages, KeyRound, Check, HardDriveDownload, Shield, ShieldCheck, Fingerprint, } from 'lucide-react';
import { usePrivacyMode } from '../hooks/use-privacy-mode.js';
import { ChangePasswordDialog } from './change-password-dialog.js';
import { BackupDialog } from './backup-dialog.js';
import { TwoFactorSetup } from './two-factor-setup.js';
import { PasskeyManagementDialog } from './passkey-management-dialog.js';
import { CommandPalette } from './command-palette.js';
import { useCommandPaletteHotkey } from '../hooks/use-command-palette-hotkey.js';
import { GlobalChatPanel } from './global-chat-panel.js';
import { useFeatureFlags } from '../hooks/use-feature-flags.js';
import { Bot, Plus, Search, Sparkles } from 'lucide-react';
import { setThemeBasedOnSystem } from '../lib/theme-utils.js';
import { useLocalAuthEnabled } from '../hooks/use-local-auth.js';
import { formatCurrency } from '../lib/format.js';
const QuickAddTransaction = lazy(() => import('./quick-add-transaction.js'));
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'securo.sidebar.collapsed';
/** Placeholder rows shown while the workspace's module list is in flight. */
function NavSkeleton() {
    return (_jsx("div", { className: "flex flex-col gap-0.5", "aria-hidden": true, children: [3, 2, 7].map((count, section) => (_jsxs("div", { className: cn('flex flex-col gap-0.5', section > 0 && 'pt-3'), children: [_jsx("div", { className: "px-3 pt-1 pb-1", children: _jsx("div", { className: "h-2 w-16 rounded bg-sidebar-accent/60 animate-pulse" }) }), Array.from({ length: count }).map((_, row) => (_jsxs("div", { className: "flex items-center gap-3 px-3 py-2", children: [_jsx("div", { className: "h-4 w-4 rounded bg-sidebar-accent/60 animate-pulse" }), _jsx("div", { className: "h-3 flex-1 max-w-[7rem] rounded bg-sidebar-accent/40 animate-pulse" })] }, row)))] }, section))) }));
}
export function AppLayout() {
    const { t } = useTranslation();
    const { user, logout, updateUser } = useAuth();
    const { activeAccountIds } = useCollectionFilter();
    const userCurrency = user?.preferences?.currency_display ?? 'USD';
    const locale = useDisplayLocale();
    const { theme, setTheme, resolvedTheme } = useTheme();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [quickAddOpen, setQuickAddOpen] = useState(false);
    const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true');
    const [accountsExpanded, setAccountsExpanded] = useState(true);
    const [accountsShowAll, setAccountsShowAll] = useState(false);
    const { privacyMode, togglePrivacyMode, mask } = usePrivacyMode();
    const [changePasswordOpen, setChangePasswordOpen] = useState(false);
    const [twoFactorOpen, setTwoFactorOpen] = useState(false);
    const [passkeysOpen, setPasskeysOpen] = useState(false);
    const [backupOpen, setBackupOpen] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
    useCommandPaletteHotkey(setPaletteOpen);
    const { agentsEnabled } = useFeatureFlags();
    const { hasModule, isLoading: workspaceLoading, canWrite } = useWorkspace();
    // The chat is offered only to members who can write. Sending a message
    // reaches a tool set that persists — `propose_create_transaction` and its
    // siblings — so the backend refuses it for a read-only role. Showing the
    // panel anyway would put a raw `403: {"detail":"Read-only role"}` in front
    // of the user, which is what happened before this guard.
    //
    // This costs a viewer the ability to *ask* questions, which is a real use
    // case. Restoring it means making the agent's tools role-aware so a
    // read-only session only exposes the reading ones; then this becomes
    // `agentsEnabled` again.
    const chatAvailable = agentsEnabled && canWrite;
    const localAuthEnabled = useLocalAuthEnabled();
    // ⌘J / Ctrl+J toggles the global slide-over chat from anywhere.
    // Distinct from ⌘K (command palette) so users can have both open.
    // Gated on agentsEnabled so the hotkey is a no-op when the feature is
    // off — keeps ⌘J free for browsers/other tools.
    useEffect(() => {
        adminApi.defaultColors().then(({ light, dark }) => {
            setThemeBasedOnSystem(light, dark, resolvedTheme);
        }).catch(() => { });
        if (!chatAvailable)
            return;
        const handler = (e) => {
            const isMod = e.metaKey || e.ctrlKey;
            if (isMod && (e.key === 'j' || e.key === 'J')) {
                e.preventDefault();
                setChatOpen((prev) => !prev);
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [chatAvailable, resolvedTheme]);
    // The "Agents" management page used to live in the sidebar, but it's
    // a configuration surface (KB upload, providers, default selection),
    // not a daily destination. Moved to the user menu (Change password,
    // 2FA, Backups, AI agents).
    const finalNavItems = useMemo(() => visibleNavItems(navItems, hasModule), [hasModule]);
    const isMac = typeof navigator !== 'undefined' &&
        /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    const showTour = user &&
        !user.preferences?.onboarding_completed &&
        !localStorage.getItem('onboarding_completed');
    const handleTourComplete = useCallback(async () => {
        localStorage.setItem('onboarding_completed', 'true');
        try {
            const prefs = {
                ...(user?.preferences || {}),
                onboarding_completed: true,
            };
            const updated = await authApi.updateMe({ preferences: prefs });
            updateUser(updated);
        }
        catch {
            // localStorage fallback is already set
        }
    }, [user, updateUser]);
    const userInitial = user?.email?.charAt(0).toUpperCase() ?? '?';
    const resolvedThemeLocal = theme === 'system' ? undefined : theme;
    const isDark = resolvedThemeLocal
        ? resolvedThemeLocal === 'dark'
        : typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');
    const toggleDesktopSidebar = () => {
        setDesktopSidebarCollapsed((collapsed) => {
            const next = !collapsed;
            localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
            return next;
        });
    };
    const { data: accountsList } = useQuery({
        queryKey: ['accounts'],
        queryFn: () => accountsApi.list(),
    });
    const allAccounts = accountsList ?? [];
    // When a collection is active, the sidebar list + total reflect only its
    // accounts (issue #105). null = all accounts.
    const visibleAccounts = activeAccountIds
        ? allAccounts.filter((a) => activeAccountIds.includes(a.id))
        : allAccounts;
    const totalBalance = sumAccountBalances(visibleAccounts);
    const versionA11yLabel = t('app.versionAriaLabel', { version: APP_VERSION });
    return (_jsxs("div", { className: "min-h-screen bg-background", children: [_jsxs("header", { className: "sticky top-0 z-40 flex h-14 items-center gap-3 bg-sidebar border-b border-sidebar-border px-4 lg:hidden", children: [_jsx("button", { onClick: () => setSidebarOpen(!sidebarOpen), className: "text-sidebar-muted hover:text-sidebar-foreground transition-colors", "aria-label": t('app.toggleMenu'), children: _jsx(Menu, { size: 20 }) }), _jsxs(Link, { to: "/", className: "flex items-center gap-2 -mx-1 px-1 py-1 rounded-md hover:bg-sidebar-accent transition-colors", "aria-label": t('app.name'), title: t('nav.dashboard'), children: [_jsx(ShellLogo, { size: 22, className: "text-primary shrink-0" }), _jsx("span", { className: "font-bold text-sidebar-foreground", children: t('app.name') })] }), _jsxs("div", { className: "ml-auto flex items-center gap-2", children: [_jsx("button", { onClick: () => setPaletteOpen(true), className: "text-sidebar-muted hover:text-sidebar-foreground transition-colors p-1", title: t('cmdk.triggerAria'), "aria-label": t('cmdk.triggerAria'), children: _jsx(Search, { size: 18 }) }), _jsx("button", { onClick: togglePrivacyMode, className: "text-sidebar-muted hover:text-sidebar-foreground transition-colors p-1", title: privacyMode ? t('privacy.show') : t('privacy.hide'), children: privacyMode ? _jsx(EyeOff, { size: 18 }) : _jsx(Eye, { size: 18 }) }), _jsx("button", { onClick: toggleTheme, className: "text-sidebar-muted hover:text-sidebar-foreground transition-colors p-1", title: isDark ? t('settings.themeLight') : t('settings.themeDark'), "aria-label": isDark ? t('settings.themeLight') : t('settings.themeDark'), children: isDark ? _jsx(Sun, { size: 18 }) : _jsx(Moon, { size: 18 }) }), chatAvailable && (_jsx("button", { onClick: () => setChatOpen(true), className: "text-sidebar-muted hover:text-sidebar-foreground transition-colors p-1", title: `${t('agents.globalChat.title', 'Chat')} (${isMac ? '⌘J' : 'Ctrl+J'})`, "aria-label": t('agents.globalChat.openHint', 'Open chat (⌘J)'), children: _jsx(Bot, { size: 18 }) })), _jsx(UserMenu, { userInitial: userInitial, logout: logout, onChangePassword: () => setChangePasswordOpen(true), onTwoFactor: () => setTwoFactorOpen(true), onPasskeys: () => setPasskeysOpen(true), localAuthEnabled: localAuthEnabled, agentsEnabled: agentsEnabled, onBackup: () => setBackupOpen(true), dark: true, isAdmin: user?.is_superuser })] })] }), _jsxs("div", { className: "flex", children: [sidebarOpen && (_jsx("div", { className: "fixed inset-0 z-40 bg-black/50 lg:hidden", onClick: () => setSidebarOpen(false) })), _jsxs("aside", { "data-collapsed": desktopSidebarCollapsed, className: cn('group/sidebar fixed inset-y-0 left-0 z-50 w-60 bg-sidebar border-r border-sidebar-border flex flex-col transform transition-[transform,width] duration-300 ease-in-out motion-reduce:transition-none lg:translate-x-0 shrink-0', sidebarOpen ? 'translate-x-0' : '-translate-x-full', desktopSidebarCollapsed ? 'lg:w-16' : 'lg:w-60'), children: [_jsxs("div", { className: cn('flex h-16 min-h-16 items-center justify-between px-5 border-b border-sidebar-border shrink-0', desktopSidebarCollapsed && 'lg:h-auto lg:min-h-0 lg:flex-col lg:justify-center lg:gap-2 lg:px-0 lg:py-3'), children: [_jsxs(Link, { to: "/", className: "flex items-center gap-2.5 -mx-1 px-1 py-1 rounded-md hover:bg-sidebar-accent transition-colors", onClick: () => setSidebarOpen(false), "aria-label": t('app.name'), title: t('nav.dashboard'), children: [_jsx(ShellLogo, { size: 24, className: "text-primary shrink-0" }), _jsx("span", { className: cn('font-bold text-lg text-sidebar-foreground tracking-tight', desktopSidebarCollapsed && 'lg:hidden'), children: t('app.name') })] }), _jsxs("div", { className: cn('flex items-center gap-0.5', desktopSidebarCollapsed && 'lg:flex-col lg:gap-1'), children: [_jsx("button", { onClick: togglePrivacyMode, className: cn('text-sidebar-muted hover:text-sidebar-foreground transition-colors p-1 rounded-md hover:bg-sidebar-accent', desktopSidebarCollapsed && 'lg:flex lg:h-9 lg:w-9 lg:items-center lg:justify-center lg:p-0 lg:[&>svg]:h-[18px] lg:[&>svg]:w-[18px]'), title: privacyMode ? t('privacy.show') : t('privacy.hide'), "aria-label": privacyMode ? t('privacy.show') : t('privacy.hide'), children: privacyMode ? _jsx(EyeOff, { size: 16 }) : _jsx(Eye, { size: 16 }) }), chatAvailable && (_jsx("button", { onClick: () => setChatOpen(true), className: cn('text-sidebar-muted hover:text-sidebar-foreground transition-colors p-1 rounded-md hover:bg-sidebar-accent', desktopSidebarCollapsed && 'lg:flex lg:h-9 lg:w-9 lg:items-center lg:justify-center lg:p-0 lg:[&>svg]:h-[18px] lg:[&>svg]:w-[18px]'), title: `${t('agents.globalChat.title', 'Chat')} (${isMac ? '⌘J' : 'Ctrl+J'})`, "aria-label": t('agents.globalChat.openHint', 'Open chat (⌘J)'), children: _jsx(Bot, { size: 16 }) })), _jsx("button", { onClick: toggleTheme, className: cn('text-sidebar-muted hover:text-sidebar-foreground transition-colors p-1 rounded-md hover:bg-sidebar-accent', desktopSidebarCollapsed && 'lg:flex lg:h-9 lg:w-9 lg:items-center lg:justify-center lg:p-0 lg:[&>svg]:h-[18px] lg:[&>svg]:w-[18px]'), title: isDark ? t('settings.themeLight') : t('settings.themeDark'), "aria-label": isDark ? t('settings.themeLight') : t('settings.themeDark'), children: isDark ? _jsx(Sun, { size: 16 }) : _jsx(Moon, { size: 16 }) })] })] }), _jsx("button", { type: "button", onClick: toggleDesktopSidebar, className: "hidden lg:flex absolute top-1/2 -right-3 -translate-y-1/2 h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/sidebar:opacity-100", title: desktopSidebarCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar'), "aria-label": desktopSidebarCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar'), "aria-expanded": !desktopSidebarCollapsed, children: desktopSidebarCollapsed ? _jsx(ChevronRight, { size: 14 }) : _jsx(ChevronLeft, { size: 14 }) }), _jsx("div", { className: cn('px-3 pt-3', desktopSidebarCollapsed && 'lg:px-2'), children: _jsxs("button", { type: "button", onClick: () => setPaletteOpen(true), className: cn('group flex w-full items-center gap-2 rounded-lg border border-sidebar-border/80 bg-sidebar-accent/40 px-3 py-2', 'text-[12.5px] text-sidebar-muted transition-all', 'hover:bg-sidebar-accent hover:text-sidebar-foreground hover:border-sidebar-border', desktopSidebarCollapsed && 'lg:justify-center lg:px-0'), "aria-label": t('cmdk.triggerAria'), children: [_jsx(Search, { size: 13, className: "shrink-0" }), _jsx("span", { className: cn('flex-1 text-left', desktopSidebarCollapsed && 'lg:hidden'), children: t('cmdk.triggerLabel') }), _jsxs("kbd", { className: cn('hidden lg:inline-flex h-[17px] items-center rounded border border-sidebar-border bg-sidebar px-1 font-mono text-[9.5px] font-semibold text-sidebar-muted/80', desktopSidebarCollapsed && 'lg:hidden'), children: [isMac ? '⌘' : 'Ctrl', "\u00A0K"] })] }) }), _jsxs("div", { className: "flex-1 min-h-0 overflow-y-auto", children: [_jsxs("nav", { className: cn('flex flex-col gap-0.5 px-3 pt-1 pb-3', desktopSidebarCollapsed && 'lg:items-center lg:gap-1 lg:px-0 lg:pt-3'), "data-tour": "sidebar", children: [workspaceLoading && _jsx(NavSkeleton, {}), !workspaceLoading && finalNavItems.map((item, idx) => {
                                                if (item.type === 'separator') {
                                                    // The first separator sits right below the search bar
                                                    // — without trimming the top padding it leaves a wide
                                                    // gap that makes the section header feel disconnected
                                                    // from the search trigger.
                                                    const isFirstSep = idx === 0;
                                                    return (_jsx("div", { className: cn(isFirstSep ? 'pt-1 pb-1 px-3' : 'pt-3 pb-1 px-3', desktopSidebarCollapsed && 'lg:hidden'), children: _jsx("span", { className: "text-[10px] uppercase tracking-[0.12em] font-semibold text-sidebar-muted/50", children: t(item.labelKey) }) }, `sep-${idx}`));
                                                }
                                                const isActive = item.path === '/'
                                                    ? location.pathname === '/'
                                                    : location.pathname.startsWith(item.path);
                                                const Icon = item.icon;
                                                const showQuickAdd = item.key === 'transactions' && canWrite;
                                                const link = (_jsxs(Link, { to: item.path, "data-tour": `nav-${item.key}`, onClick: () => setSidebarOpen(false), title: t(`nav.${item.key}`), "aria-label": t(`nav.${item.key}`), className: cn('flex items-center gap-3 text-[13px] font-medium transition-all rounded-lg px-3 py-2', isActive
                                                        ? 'bg-primary/[0.08] text-primary border-l-[3px] border-primary pl-[9px]'
                                                        : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground', desktopSidebarCollapsed && 'lg:h-10 lg:w-10 lg:justify-center lg:border-l-0 lg:px-0 lg:pl-0'), children: [_jsx(Icon, { size: 17, className: cn('shrink-0', isActive ? 'text-primary' : 'text-sidebar-muted', desktopSidebarCollapsed && 'lg:h-5 lg:w-5') }), _jsx("span", { className: cn(desktopSidebarCollapsed && 'lg:hidden'), children: t(`nav.${item.key}`) })] }, item.key));
                                                if (!showQuickAdd)
                                                    return link;
                                                return (_jsxs("div", { className: "relative flex items-center", children: [_jsx("div", { className: "min-w-0 flex-1", children: link }), _jsx("button", { type: "button", onClick: () => {
                                                                setSidebarOpen(false);
                                                                setQuickAddOpen(true);
                                                            }, title: t('transactions.addManual'), "aria-label": t('transactions.addManual'), className: cn('absolute right-2 flex h-6 w-6 items-center justify-center rounded-md border border-sidebar-border bg-sidebar text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground', desktopSidebarCollapsed && 'lg:hidden'), children: _jsx(Plus, { size: 14 }) })] }, item.key));
                                            })] }), allAccounts.length > 0 && (_jsxs("div", { className: cn('px-3 pb-2 mt-2', desktopSidebarCollapsed && 'lg:hidden'), children: [_jsxs("button", { onClick: () => setAccountsExpanded(!accountsExpanded), className: "flex items-center justify-between w-full px-3 py-2 hover:text-sidebar-foreground transition-colors", children: [_jsx("span", { className: "text-[11px] uppercase tracking-[0.12em] font-semibold text-sidebar-muted", children: t('accounts.title') }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `tabular-nums font-medium text-xs ${totalBalance < 0 ? 'text-rose-400' : 'text-sidebar-muted'}`, children: mask(formatCurrency(totalBalance, userCurrency, locale)) }), _jsx(ChevronRight, { size: 12, className: cn('text-sidebar-muted transition-transform', accountsExpanded && 'rotate-90') })] })] }), accountsExpanded && (_jsxs("div", { className: "mt-1 space-y-0.5", children: [[...visibleAccounts].sort((a, b) => Math.abs(Number(b.current_balance)) - Math.abs(Number(a.current_balance))).slice(0, accountsShowAll ? visibleAccounts.length : 3).map((acc) => {
                                                        const balance = Number(acc.current_balance) || 0;
                                                        const typeKey = acc.type.replace(/_([a-z])/g, (_, c) => c.toUpperCase()).replace(/^./, c => c.toUpperCase());
                                                        return (_jsxs(Link, { to: `/accounts/${acc.id}`, onClick: () => setSidebarOpen(false), className: "flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all", children: [_jsxs("div", { className: "truncate min-w-0", children: [_jsx("span", { className: "block truncate font-medium", children: getAccountName(acc) }), _jsxs("span", { className: "block text-[10px] text-sidebar-muted/60", children: [t(`accounts.type${typeKey}`), acc.shared_balance_group && ` · ${t('accounts.sharedCreditBalance')}`] })] }), _jsx("div", { className: "text-right shrink-0 ml-2", children: _jsx("span", { className: `block tabular-nums font-medium text-xs ${balance < 0 ? 'text-rose-400' : 'text-sidebar-foreground'}`, children: mask(formatCurrency(balance, acc.currency, locale)) }) })] }, acc.id));
                                                    }), visibleAccounts.length > 3 && (_jsx("button", { onClick: () => setAccountsShowAll(!accountsShowAll), className: "w-full px-3 py-1.5 text-[11px] font-medium text-sidebar-muted/70 hover:text-sidebar-foreground transition-colors text-center", children: accountsShowAll
                                                            ? t('common.showLess', { defaultValue: 'Show less' })
                                                            : t('common.showMore', {
                                                                count: visibleAccounts.length - 3,
                                                                defaultValue: `+${visibleAccounts.length - 3} more`,
                                                            }) }))] }))] }))] }), _jsx("div", { className: cn(desktopSidebarCollapsed && 'lg:hidden'), children: _jsx(UpdateAvailableBanner, { onOpen: () => setUpdateDialogOpen(true) }) }), _jsx("div", { className: cn('px-3 pt-1', desktopSidebarCollapsed && 'lg:px-2'), children: _jsx(WorkspaceSwitcher, { onChangePassword: () => setChangePasswordOpen(true), onTwoFactor: () => setTwoFactorOpen(true), onPasskeys: () => setPasskeysOpen(true), localAuthEnabled: localAuthEnabled, onBackup: () => setBackupOpen(true), onUpdateAvailable: () => setUpdateDialogOpen(true), agentsEnabled: agentsEnabled, collapsed: desktopSidebarCollapsed }) }), _jsx("div", { className: cn('px-3 pb-3 pt-1', desktopSidebarCollapsed && 'lg:hidden'), children: _jsxs("div", { className: "text-[11px] leading-4 text-sidebar-muted/70 text-center", role: "note", children: [_jsx("span", { className: "sr-only", children: versionA11yLabel }), _jsx("span", { "aria-hidden": "true", className: "block break-all line-clamp-2", children: t('app.versionLabel', { version: APP_VERSION }) })] }) })] }), _jsx("main", { className: cn('flex-1 min-h-screen overflow-x-hidden transition-[margin] duration-300 ease-in-out motion-reduce:transition-none', desktopSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-60'), children: _jsxs("div", { className: "p-6 max-w-7xl mx-auto", children: [_jsx(CollectionSelector, { variant: "header" }), _jsx(Outlet, {})] }) })] }), showTour && _jsx(OnboardingTour, { onComplete: handleTourComplete }), localAuthEnabled && (_jsx(ChangePasswordDialog, { open: changePasswordOpen, onClose: () => setChangePasswordOpen(false) })), _jsx(TwoFactorSetup, { open: twoFactorOpen, onClose: () => setTwoFactorOpen(false), localAuthEnabled: localAuthEnabled }), _jsx(PasskeyManagementDialog, { open: passkeysOpen, onClose: () => setPasskeysOpen(false), localAuthEnabled: localAuthEnabled }), _jsx(BackupDialog, { open: backupOpen, onClose: () => setBackupOpen(false) }), quickAddOpen && (_jsx(Suspense, { fallback: null, children: _jsx(QuickAddTransaction, { open: quickAddOpen, onClose: () => setQuickAddOpen(false) }) })), _jsx(CommandPalette, { open: paletteOpen, onOpenChange: setPaletteOpen }), chatAvailable && _jsx(GlobalChatPanel, { open: chatOpen, onOpenChange: setChatOpen }), _jsx(UpdateAvailableDialog, { open: updateDialogOpen, onClose: () => setUpdateDialogOpen(false) })] }));
}
function UserMenu({ userInitial, logout, onChangePassword, onTwoFactor, onPasskeys, localAuthEnabled, onBackup, dark, isAdmin, agentsEnabled, }) {
    const { user } = useAuth();
    const { t, i18n } = useTranslation();
    const nav = useNavigate();
    const currentLang = resolveSupportedLang(i18n.resolvedLanguage ?? i18n.language);
    return (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", className: "relative h-8 w-8 rounded-full p-0", "aria-label": t('common.userMenu'), children: _jsx(Avatar, { className: "h-8 w-8", children: _jsx(AvatarFallback, { className: dark
                                ? 'bg-primary/20 text-primary text-xs font-semibold'
                                : 'bg-primary/10 text-primary text-xs font-semibold', children: userInitial }) }) }) }), _jsxs(DropdownMenuContent, { align: "end", children: [isAdmin && (_jsxs(_Fragment, { children: [_jsxs(DropdownMenuItem, { onClick: () => nav('/admin'), className: "flex items-center gap-2", children: [_jsx(Shield, { size: 14 }), t('nav.groupAdmin')] }), _jsx(DropdownMenuSeparator, {})] })), localAuthEnabled && (_jsxs(DropdownMenuItem, { onClick: onChangePassword, className: "flex items-center gap-2", children: [_jsx(KeyRound, { size: 14 }), t('auth.changePassword')] })), (localAuthEnabled || user?.is_2fa_enabled) && (_jsxs(DropdownMenuItem, { onClick: onTwoFactor, className: "flex items-center gap-2", children: [_jsx(ShieldCheck, { size: 14 }), t(localAuthEnabled ? 'auth.twoFactorTitle' : 'auth.disable2fa')] })), _jsxs(DropdownMenuItem, { onClick: onPasskeys, className: "flex items-center gap-2", children: [_jsx(Fingerprint, { size: 14 }), t('auth.passkeysTitle')] }), _jsxs(DropdownMenuItem, { onClick: onBackup, className: "flex items-center gap-2", children: [_jsx(HardDriveDownload, { size: 14 }), t('backup.button')] }), agentsEnabled && (_jsxs(DropdownMenuItem, { onClick: () => nav('/agents'), className: "flex items-center gap-2", children: [_jsx(Sparkles, { size: 14 }), t('nav.aiAgents')] })), _jsxs(DropdownMenuSub, { children: [_jsxs(DropdownMenuSubTrigger, { className: "flex items-center gap-2", children: [_jsx(Languages, { size: 14 }), _jsx("span", { className: "flex-1", children: t('setup.language') }), _jsx("span", { className: "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground", children: currentLang.split('-')[0] })] }), _jsx(DropdownMenuPortal, { children: _jsxs(DropdownMenuSubContent, { className: "w-40", children: [_jsx(DropdownMenuLabel, { className: "px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70", children: t('setup.language') }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('ru'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439" }), currentLang === 'ru' && (_jsx(Check, { size: 13, className: "text-primary" }))] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('de'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "Deutsch" }), currentLang === 'de' && (_jsx(Check, { size: 13, className: "text-primary" }))] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('uk'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "\u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430" }), currentLang === 'uk' && (_jsx(Check, { size: 13, className: "text-primary" }))] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('pt-BR'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "Portugu\u00EAs (BR)" }), currentLang === 'pt-BR' && (_jsx(Check, { size: 13, className: "text-primary" }))] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('pt-PT'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "Portugu\u00EAs (PT)" }), currentLang === 'pt-PT' && (_jsx(Check, { size: 13, className: "text-primary" }))] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('en'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "English" }), currentLang === 'en' && (_jsx(Check, { size: 13, className: "text-primary" }))] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('es'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "Espa\u00F1ol" }), currentLang === 'es' && (_jsx(Check, { size: 13, className: "text-primary" }))] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('hi'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "\u0939\u093F\u0928\u094D\u0926\u0940" }), currentLang === 'hi' && (_jsx(Check, { size: 13, className: "text-primary" }))] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('pl'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "Polski" }), currentLang === 'pl' && (_jsx(Check, { size: 13, className: "text-primary" }))] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('it'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "Italiano" }), currentLang === 'it' && (_jsx(Check, { size: 13, className: "text-primary" }))] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('fr'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "Fran\u00E7ais" }), currentLang === 'fr' && (_jsx(Check, { size: 13, className: "text-primary" }))] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('nl'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "Nederlands" }), currentLang === 'nl' && (_jsx(Check, { size: 13, className: "text-primary" }))] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('sk'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "Sloven\u010Dina" }), currentLang === 'sk' && (_jsx(Check, { size: 13, className: "text-primary" }))] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('el'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "\u0395\u03BB\u03BB\u03B7\u03BD\u03B9\u03BA\u03AC" }), currentLang === 'el' && (_jsx(Check, { size: 13, className: "text-primary" }))] }), _jsxs(DropdownMenuItem, { onClick: () => i18n.changeLanguage('ja'), className: "flex items-center gap-2", children: [_jsx("span", { className: "flex-1", children: "\u65E5\u672C\u8A9E" }), currentLang === 'ja' && (_jsx(Check, { size: 13, className: "text-primary" }))] })] }) })] }), _jsx(DropdownMenuSeparator, {}), _jsx(DropdownMenuItem, { onClick: logout, className: "text-rose-600 focus:text-rose-600", children: t('auth.logout') })] })] }));
}
