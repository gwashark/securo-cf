import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState, useCallback, useSyncExternalStore } from 'react';
import { Command } from 'cmdk';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDisplayLocale } from '../hooks/use-display-locale.js';
import { useWorkspace } from '../contexts/workspace-context.js';
import { useQuery } from '@tanstack/react-query';
import { Search, CornerDownLeft, LayoutDashboard, ArrowLeftRight, Building2, Upload, SlidersHorizontal, Tag, PiggyBank, Target, Repeat, Landmark, Users, BarChart3, Plus, Receipt, CircleDollarSign, Wallet, Flame, FileSpreadsheet, History, ArrowUpRight, Zap, Compass, } from 'lucide-react';
import { search as searchApi } from '../lib/api.js';
import { cn, normalizeText } from '../lib/utils.js';
const NAV_ITEMS = [
    { id: 'nav-dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, path: '/', keywords: ['home', 'inicio', 'início'] },
    { id: 'nav-transactions', labelKey: 'nav.transactions', icon: ArrowLeftRight, path: '/transactions', keywords: ['tx', 'transacoes', 'transações'], module: 'transactions' },
    { id: 'nav-invoices', labelKey: 'nav.invoices', icon: Receipt, path: '/invoices', keywords: ['cobrancas', 'cobranças', 'faturas', 'clientes', 'recebimentos'], module: 'invoices' },
    { id: 'nav-accounts', labelKey: 'nav.accounts', icon: Building2, path: '/accounts', keywords: ['contas'], module: 'accounts' },
    { id: 'nav-import', labelKey: 'nav.import', icon: Upload, path: '/import', keywords: ['csv', 'ofx', 'importar'], module: 'import' },
    { id: 'nav-reports', labelKey: 'nav.reports', icon: BarChart3, path: '/reports', keywords: ['relatorios', 'relatórios', 'charts'], module: 'reports' },
    { id: 'nav-assets', labelKey: 'nav.assets', icon: Landmark, path: '/assets', keywords: ['patrimonio', 'patrimônio'], module: 'assets' },
    { id: 'nav-budgets', labelKey: 'nav.budgets', icon: PiggyBank, path: '/budgets', keywords: ['orcamentos', 'orçamentos'], module: 'budgets' },
    { id: 'nav-goals', labelKey: 'nav.goals', icon: Target, path: '/goals', keywords: ['metas'], module: 'goals' },
    { id: 'nav-recurring', labelKey: 'nav.recurring', icon: Repeat, path: '/recurring', keywords: ['recorrentes'], module: 'recurring' },
    { id: 'nav-categories', labelKey: 'nav.categories', icon: Tag, path: '/categories', keywords: ['categorias'], module: 'categories' },
    { id: 'nav-payees', labelKey: 'nav.payees', icon: Users, path: '/payees', keywords: ['beneficiarios', 'beneficiários'], module: 'payees' },
    { id: 'nav-rules', labelKey: 'nav.rules', icon: SlidersHorizontal, path: '/rules', keywords: ['regras'], module: 'rules' },
];
const QUICK_ACTIONS = [
    {
        id: 'action-new-transaction',
        labelKey: 'cmdk.actions.newTransaction',
        icon: Plus,
        onSelect: (nav) => nav('/transactions?new=1'),
        keywords: ['new', 'add', 'create', 'nova', 'adicionar'],
    },
    {
        id: 'action-import',
        labelKey: 'cmdk.actions.importFile',
        icon: FileSpreadsheet,
        onSelect: (nav) => nav('/import'),
        keywords: ['upload', 'csv', 'ofx', 'qif'],
    },
    {
        id: 'action-new-budget',
        labelKey: 'cmdk.actions.newBudget',
        icon: PiggyBank,
        onSelect: (nav) => nav('/budgets?new=1'),
        keywords: ['budget', 'orcamento'],
    },
    {
        id: 'action-new-goal',
        labelKey: 'cmdk.actions.newGoal',
        icon: Target,
        onSelect: (nav) => nav('/goals?new=1'),
        keywords: ['goal', 'meta', 'target'],
    },
    {
        id: 'action-reports',
        labelKey: 'cmdk.actions.openReports',
        icon: BarChart3,
        onSelect: (nav) => nav('/reports'),
    },
];
// ---------------------------------------------------------------------------
// Entity type → icon + accent color
// ---------------------------------------------------------------------------
const ENTITY_META = {
    transaction: {
        icon: Receipt,
        tintClass: 'text-indigo-500 dark:text-indigo-300',
        bgClass: 'bg-indigo-500/10',
        labelKey: 'cmdk.groups.transactions',
        pathFor: (hit) => {
            const params = new URLSearchParams();
            if (hit.label)
                params.set('q', hit.label);
            params.set('highlight', hit.id);
            return `/transactions?${params.toString()}`;
        },
    },
    account: {
        icon: Wallet,
        tintClass: 'text-emerald-500 dark:text-emerald-300',
        bgClass: 'bg-emerald-500/10',
        labelKey: 'cmdk.groups.accounts',
        pathFor: (hit) => `/accounts/${hit.id}`,
    },
    payee: {
        icon: Users,
        tintClass: 'text-sky-500 dark:text-sky-300',
        bgClass: 'bg-sky-500/10',
        labelKey: 'cmdk.groups.payees',
        pathFor: (hit) => `/transactions?payee_id=${hit.id}`,
    },
    category: {
        icon: Tag,
        tintClass: 'text-fuchsia-500 dark:text-fuchsia-300',
        bgClass: 'bg-fuchsia-500/10',
        labelKey: 'cmdk.groups.categories',
        pathFor: (hit) => `/transactions?category_id=${hit.id}`,
    },
    goal: {
        icon: Target,
        tintClass: 'text-amber-500 dark:text-amber-300',
        bgClass: 'bg-amber-500/10',
        labelKey: 'cmdk.groups.goals',
        pathFor: () => '/goals',
    },
    asset: {
        icon: Landmark,
        tintClass: 'text-rose-500 dark:text-rose-300',
        bgClass: 'bg-rose-500/10',
        labelKey: 'cmdk.groups.assets',
        pathFor: () => '/assets',
    },
};
const RECENT_KEY = 'securo.cmdk.recent';
const RECENT_MAX = 5;
function loadRecents() {
    try {
        const raw = localStorage.getItem(RECENT_KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return parsed.slice(0, RECENT_MAX);
    }
    catch {
        return [];
    }
}
const recentListeners = new Set();
let recentSnapshot = loadRecents();
function subscribeRecents(listener) {
    recentListeners.add(listener);
    return () => {
        recentListeners.delete(listener);
    };
}
function getRecentSnapshot() {
    return recentSnapshot;
}
function saveRecent(item) {
    const existing = recentSnapshot.filter((r) => r.id !== item.id);
    const next = [item, ...existing].slice(0, RECENT_MAX);
    recentSnapshot = next;
    try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    }
    catch {
        // ignore
    }
    recentListeners.forEach((l) => l());
}
// ---------------------------------------------------------------------------
// Amount formatting helper
// ---------------------------------------------------------------------------
function formatHitAmount(amount, currency, locale) {
    if (amount === null || amount === undefined)
        return null;
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency ?? 'USD',
            maximumFractionDigits: 2,
        }).format(amount);
    }
    catch {
        return `${amount}`;
    }
}
function formatHitDate(iso, locale) {
    if (!iso)
        return null;
    try {
        const d = new Date(iso);
        return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(d);
    }
    catch {
        return iso;
    }
}
function matchesQuery(query, haystacks) {
    const q = normalizeText(query.trim());
    if (!q)
        return true;
    return haystacks.some((h) => (h ? normalizeText(h).includes(q) : false));
}
export function CommandPalette({ open, onOpenChange }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { hasModule } = useWorkspace();
    const [query, setQuery] = useState('');
    const [debounced, setDebounced] = useState('');
    const recents = useSyncExternalStore(subscribeRecents, getRecentSnapshot, getRecentSnapshot);
    const inputRef = useRef(null);
    const locale = useDisplayLocale();
    // Focus the input whenever the palette opens. The cmdk Command is re-keyed
    // on `open` so results and selection reset automatically. We reset our own
    // query/debounced state in the close handler instead of here to avoid
    // calling setState inside an effect.
    useEffect(() => {
        if (open) {
            const id = setTimeout(() => inputRef.current?.focus(), 10);
            return () => clearTimeout(id);
        }
    }, [open]);
    const handleOpenChange = useCallback((next) => {
        if (!next) {
            setQuery('');
            setDebounced('');
        }
        onOpenChange(next);
    }, [onOpenChange]);
    // Debounce query → debounced (150ms)
    useEffect(() => {
        const id = setTimeout(() => setDebounced(query), 150);
        return () => clearTimeout(id);
    }, [query]);
    const { data: searchResults = [], isFetching } = useQuery({
        queryKey: ['search', debounced],
        queryFn: () => searchApi.query(debounced, 5),
        enabled: open && debounced.trim().length > 0,
        staleTime: 30_000,
    });
    // Group hits by entity type
    const grouped = useMemo(() => {
        const groups = new Map();
        for (const hit of searchResults) {
            const arr = groups.get(hit.type) ?? [];
            arr.push(hit);
            groups.set(hit.type, arr);
        }
        return groups;
    }, [searchResults]);
    // Client-side filtered nav + quick actions so typing "regras" or "nova"
    // narrows the in-app items alongside the backend entity search.
    const filteredNavItems = useMemo(() => {
        // Same question the sidebar asks, so the palette can't offer a
        // destination the workspace doesn't show.
        const available = NAV_ITEMS.filter((n) => !n.module || hasModule(n.module));
        if (debounced.trim().length === 0)
            return available;
        return available.filter((n) => matchesQuery(debounced, [t(n.labelKey), n.path, ...(n.keywords ?? [])]));
    }, [debounced, t, hasModule]);
    const filteredQuickActions = useMemo(() => {
        if (debounced.trim().length === 0)
            return QUICK_ACTIONS;
        return QUICK_ACTIONS.filter((a) => matchesQuery(debounced, [t(a.labelKey), ...(a.keywords ?? [])]));
    }, [debounced, t]);
    const runAndClose = useCallback((item) => {
        saveRecent({
            id: item.id,
            label: item.label,
            path: item.path,
            icon: item.iconName,
            sublabel: item.sublabel,
        });
        handleOpenChange(false);
        // Slight delay so dialog closes before navigation animation
        setTimeout(() => navigate(item.path), 0);
    }, [navigate, handleOpenChange]);
    const showEmptyHome = debounced.trim().length === 0;
    const hasAnyResults = searchResults.length > 0;
    const hasAnyLocalMatch = filteredNavItems.length > 0 || filteredQuickActions.length > 0;
    const showEmptyState = !showEmptyHome && !hasAnyResults && !hasAnyLocalMatch;
    return (_jsx(DialogPrimitive.Root, { open: open, onOpenChange: handleOpenChange, children: _jsxs(DialogPrimitive.Portal, { children: [_jsx(DialogPrimitive.Overlay, { className: cn('fixed inset-0 z-50 backdrop-blur-[3px] bg-background/40', 'data-[state=open]:animate-in data-[state=closed]:animate-out', 'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0') }), _jsxs(DialogPrimitive.Content, { className: cn('fixed left-1/2 top-[22%] z-50 w-[92vw] max-w-[640px] -translate-x-1/2', 'data-[state=open]:animate-in data-[state=closed]:animate-out', 'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0', 'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95', 'data-[state=open]:slide-in-from-top-4 data-[state=closed]:slide-out-to-top-4', 'duration-150 outline-none'), children: [_jsx(DialogPrimitive.Title, { className: "sr-only", children: t('cmdk.title') }), _jsx(DialogPrimitive.Description, { className: "sr-only", children: t('cmdk.description') }), _jsxs(Command, { shouldFilter: false, className: cn('relative overflow-hidden rounded-2xl border border-border/80 bg-card', 'shadow-[0_30px_80px_-20px_rgba(15,23,42,0.35)] dark:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]', 'ring-1 ring-black/[0.02] dark:ring-white/[0.04]'), children: [_jsx("div", { "aria-hidden": true, className: "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" }), _jsxs("div", { className: "flex items-center gap-3 border-b border-border/60 px-4 py-3.5", children: [_jsx(Search, { size: 17, className: "shrink-0 text-muted-foreground" }), _jsx(Command.Input, { ref: inputRef, value: query, onValueChange: setQuery, placeholder: t('cmdk.placeholder'), className: cn('flex-1 bg-transparent text-[14.5px] text-foreground outline-none', 'placeholder:text-muted-foreground/70', 'caret-primary') }), isFetching && debounced && (_jsx("div", { className: "h-3 w-3 shrink-0 animate-spin rounded-full border border-muted-foreground/30 border-t-primary" })), _jsx("kbd", { className: "hidden sm:inline-flex h-5 items-center rounded border border-border/80 bg-muted/60 px-1.5 font-mono text-[10px] font-medium text-muted-foreground", children: "ESC" })] }), _jsx(Command.List, { className: cn('max-h-[min(480px,60vh)] overflow-y-auto overscroll-contain px-2 py-2', 'scrollbar-thin'), children: showEmptyHome ? (_jsxs(_Fragment, { children: [recents.length > 0 && (_jsx(Group, { icon: _jsx(History, { size: 11 }), labelKey: "cmdk.groups.recent", children: recents.map((r) => (_jsxs(Command.Item, { value: `recent ${r.label}`, onSelect: () => runAndClose({
                                                        id: r.id,
                                                        label: r.label,
                                                        path: r.path,
                                                        iconName: r.icon,
                                                        sublabel: r.sublabel,
                                                    }), className: itemClasses(), children: [_jsx(ItemIcon, { tintClass: "text-muted-foreground", bgClass: "bg-muted/60", children: _jsx(Compass, { size: 14 }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "truncate text-[13.5px] text-foreground", children: r.label }), r.sublabel && (_jsx("div", { className: "truncate text-[11.5px] text-muted-foreground", children: r.sublabel }))] }), _jsx(ArrowUpRight, { size: 13, className: "text-muted-foreground/50 group-data-[selected=true]:text-primary" })] }, `recent-${r.id}`))) })), filteredQuickActions.length > 0 && (_jsx(Group, { icon: _jsx(Zap, { size: 11 }), labelKey: "cmdk.groups.quickActions", children: filteredQuickActions.map((a) => {
                                                    const Icon = a.icon;
                                                    return (_jsxs(Command.Item, { value: `action ${t(a.labelKey)} ${(a.keywords ?? []).join(' ')}`, onSelect: () => {
                                                            if (a.onSelect) {
                                                                handleOpenChange(false);
                                                                setTimeout(() => a.onSelect(navigate), 0);
                                                            }
                                                        }, className: itemClasses(), children: [_jsx(ItemIcon, { tintClass: "text-primary", bgClass: "bg-primary/10", children: _jsx(Icon, { size: 14 }) }), _jsx("div", { className: "min-w-0 flex-1", children: _jsx("div", { className: "truncate text-[13.5px] text-foreground", children: t(a.labelKey) }) }), _jsx(CornerDownLeft, { size: 12, className: "text-muted-foreground/40 group-data-[selected=true]:text-primary" })] }, a.id));
                                                }) })), filteredNavItems.length > 0 && (_jsx(Group, { icon: _jsx(Compass, { size: 11 }), labelKey: "cmdk.groups.navigation", children: filteredNavItems.map((n) => {
                                                    const Icon = n.icon;
                                                    return (_jsxs(Command.Item, { value: `nav ${t(n.labelKey)} ${(n.keywords ?? []).join(' ')}`, onSelect: () => runAndClose({
                                                            id: n.id,
                                                            label: t(n.labelKey),
                                                            path: n.path,
                                                            iconName: 'compass',
                                                        }), className: itemClasses(), children: [_jsx(ItemIcon, { tintClass: "text-muted-foreground", bgClass: "bg-muted/60", children: _jsx(Icon, { size: 14 }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "truncate text-[13.5px] text-foreground", children: t(n.labelKey) }), _jsx("div", { className: "truncate text-[11px] text-muted-foreground/80", children: n.path })] })] }, n.id));
                                                }) }))] })) : (_jsxs(_Fragment, { children: [showEmptyState && !isFetching && (_jsxs(Command.Empty, { className: "px-3 py-10 text-center", children: [_jsx("div", { className: "mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/60", children: _jsx(Flame, { size: 15, className: "text-muted-foreground" }) }), _jsx("p", { className: "text-[13px] font-medium text-foreground", children: t('cmdk.empty.title', { query: debounced }) }), _jsx("p", { className: "mt-1 text-[12px] text-muted-foreground", children: t('cmdk.empty.hint') })] })), ['transaction', 'account', 'payee', 'category', 'goal', 'asset'].map((type) => {
                                                const items = grouped.get(type) ?? [];
                                                if (items.length === 0)
                                                    return null;
                                                const meta = ENTITY_META[type];
                                                const GroupIcon = meta.icon;
                                                return (_jsx(Group, { icon: _jsx(GroupIcon, { size: 11 }), labelKey: meta.labelKey, children: items.map((hit) => {
                                                        const amount = formatHitAmount(hit.amount, hit.currency, locale);
                                                        const dateLabel = formatHitDate(hit.date, locale);
                                                        const isPositive = (hit.amount ?? 0) > 0 && hit.type === 'transaction' && (hit.meta?.tx_type === 'credit' || hit.amount > 0);
                                                        const isNegative = hit.type === 'transaction' && hit.amount !== null && (hit.meta?.tx_type === 'debit' || hit.amount < 0);
                                                        return (_jsxs(Command.Item, { value: `${hit.type} ${hit.label} ${hit.subtitle ?? ''}`, onSelect: () => runAndClose({
                                                                id: `${hit.type}-${hit.id}`,
                                                                label: hit.label,
                                                                path: meta.pathFor(hit),
                                                                iconName: hit.type,
                                                                sublabel: hit.subtitle,
                                                            }), className: itemClasses(), children: [_jsx(ItemIcon, { tintClass: meta.tintClass, bgClass: meta.bgClass, style: hit.color ? { backgroundColor: `${hit.color}1A`, color: hit.color } : undefined, children: _jsx(GroupIcon, { size: 14 }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "truncate text-[13.5px] text-foreground", children: hit.label }), hit.subtitle && (_jsxs("div", { className: "truncate text-[11.5px] text-muted-foreground/90", children: [hit.subtitle, dateLabel && _jsx("span", { className: "mx-1.5 text-muted-foreground/40", children: "\u2022" }), dateLabel] }))] }), amount && (_jsx("div", { className: cn('shrink-0 tabular-nums text-[12.5px] font-medium', isNegative && 'text-rose-500 dark:text-rose-400', isPositive && 'text-emerald-500 dark:text-emerald-400', !isNegative && !isPositive && 'text-muted-foreground'), children: amount }))] }, `${hit.type}-${hit.id}`));
                                                    }) }, type));
                                            }), filteredQuickActions.length > 0 && (_jsx(Group, { icon: _jsx(Zap, { size: 11 }), labelKey: "cmdk.groups.quickActions", children: filteredQuickActions.map((a) => {
                                                    const Icon = a.icon;
                                                    return (_jsxs(Command.Item, { value: `action ${t(a.labelKey)} ${(a.keywords ?? []).join(' ')}`, onSelect: () => {
                                                            if (a.onSelect) {
                                                                handleOpenChange(false);
                                                                setTimeout(() => a.onSelect(navigate), 0);
                                                            }
                                                        }, className: itemClasses(), children: [_jsx(ItemIcon, { tintClass: "text-primary", bgClass: "bg-primary/10", children: _jsx(Icon, { size: 14 }) }), _jsx("div", { className: "min-w-0 flex-1", children: _jsx("div", { className: "truncate text-[13.5px] text-foreground", children: t(a.labelKey) }) }), _jsx(CornerDownLeft, { size: 12, className: "text-muted-foreground/40 group-data-[selected=true]:text-primary" })] }, a.id));
                                                }) })), filteredNavItems.length > 0 && (_jsx(Group, { icon: _jsx(Compass, { size: 11 }), labelKey: "cmdk.groups.navigation", children: filteredNavItems.map((n) => {
                                                    const Icon = n.icon;
                                                    return (_jsxs(Command.Item, { value: `nav ${t(n.labelKey)} ${(n.keywords ?? []).join(' ')}`, onSelect: () => runAndClose({
                                                            id: n.id,
                                                            label: t(n.labelKey),
                                                            path: n.path,
                                                            iconName: 'compass',
                                                        }), className: itemClasses(), children: [_jsx(ItemIcon, { tintClass: "text-muted-foreground", bgClass: "bg-muted/60", children: _jsx(Icon, { size: 14 }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "truncate text-[13.5px] text-foreground", children: t(n.labelKey) }), _jsx("div", { className: "truncate text-[11px] text-muted-foreground/80", children: n.path })] })] }, n.id));
                                                }) }))] })) }), _jsxs("div", { className: "flex items-center justify-between gap-4 border-t border-border/60 bg-muted/30 px-4 py-2", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-[10.5px] text-muted-foreground", children: [_jsx(CircleDollarSign, { size: 11, className: "text-primary" }), _jsx("span", { className: "font-semibold tracking-tight text-foreground/90", children: "Securo" }), _jsx("span", { className: "text-muted-foreground/50", children: "/" }), _jsx("span", { children: t('cmdk.footer.tagline') })] }), _jsxs("div", { className: "flex items-center gap-3 text-[10px] text-muted-foreground", children: [_jsxs(KbdHint, { children: [_jsx(Kbd, { children: "\u2191" }), _jsx(Kbd, { children: "\u2193" }), _jsx("span", { children: t('cmdk.footer.navigate') })] }), _jsxs(KbdHint, { children: [_jsx(Kbd, { children: _jsx(CornerDownLeft, { size: 9 }) }), _jsx("span", { children: t('cmdk.footer.open') })] }), _jsxs(KbdHint, { children: [_jsx(Kbd, { children: "esc" }), _jsx("span", { children: t('cmdk.footer.close') })] })] })] })] }, open ? 'open' : 'closed')] })] }) }));
}
// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------
function Group({ icon, labelKey, children, }) {
    const { t } = useTranslation();
    return (_jsx(Command.Group, { heading: _jsxs("div", { className: "flex items-center gap-1.5 px-3 pt-3 pb-1.5", children: [_jsx("span", { className: "text-muted-foreground/60", children: icon }), _jsx("span", { className: "text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70", children: t(labelKey) })] }), className: "mb-1", children: children }));
}
function itemClasses() {
    return cn('group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm', 'transition-colors', 'data-[selected=true]:bg-primary/[0.08] data-[selected=true]:text-foreground', 'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50', 'hover:bg-muted/40');
}
function ItemIcon({ tintClass, bgClass, style, children, }) {
    return (_jsx("div", { className: cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', bgClass, tintClass), style: style, children: children }));
}
function KbdHint({ children }) {
    return _jsx("div", { className: "flex items-center gap-1", children: children });
}
function Kbd({ children }) {
    return (_jsx("kbd", { className: cn('inline-flex h-[17px] min-w-[17px] items-center justify-center rounded border border-border/80', 'bg-background px-1 font-mono text-[9.5px] font-medium text-muted-foreground/90', 'shadow-[0_1px_0_rgba(0,0,0,0.05)]'), children: children }));
}
