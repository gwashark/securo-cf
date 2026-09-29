import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from './ui/dropdown-menu.js';
import { useCollectionFilter } from '../contexts/collection-filter-context.js';
import { Check, ChevronsUpDown, Layers, Settings2, X } from 'lucide-react';
/**
 * Global "active collection" selector (issue #105). Filters the app to the
 * accounts (and wallets) of the chosen collection.
 *
 * Two placements:
 *  - `sidebar`  legacy spot in the left nav.
 *  - `header`   a sticky bar at the top of the content area, so the active
 *               filter is visible right above the data it scopes (and reads
 *               as a peer of the workspace switcher rather than a list filter).
 *
 * Hidden entirely until the user has at least one collection, so it never
 * clutters the UI for people who don't use the feature.
 */
export function CollectionSelector({ variant = 'sidebar' }) {
    const { t } = useTranslation();
    const nav = useNavigate();
    const { collections, activeCollection, setActiveCollectionId } = useCollectionFilter();
    if (collections.length === 0)
        return null;
    const menu = (_jsxs(DropdownMenuContent, { align: variant === 'header' ? 'start' : 'start', className: "w-60", children: [_jsxs(DropdownMenuItem, { onClick: () => setActiveCollectionId(null), className: "flex items-center gap-2", children: [_jsx(Layers, { size: 14, className: "text-muted-foreground" }), _jsx("span", { className: "flex-1", children: t('collections.allAccounts') }), !activeCollection && _jsx(Check, { size: 14, className: "text-primary" })] }), _jsx(DropdownMenuSeparator, {}), collections.map((c) => (_jsxs(DropdownMenuItem, { onClick: () => setActiveCollectionId(c.id), className: "flex items-center gap-2", children: [_jsx("span", { className: "h-2.5 w-2.5 shrink-0 rounded-full", style: { backgroundColor: c.color } }), _jsx("span", { className: "flex-1 truncate", children: c.name }), _jsxs("span", { className: "text-[10.5px] tabular-nums text-muted-foreground/70", children: [c.account_count > 0 && `${c.account_count}a`, c.account_count > 0 && c.wallet_count > 0 && ' · ', c.wallet_count > 0 && `${c.wallet_count}w`] }), activeCollection?.id === c.id && _jsx(Check, { size: 14, className: "text-primary" })] }, c.id))), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { onClick: () => nav('/collections'), className: "flex items-center gap-2 text-muted-foreground", children: [_jsx(Settings2, { size: 14 }), t('collections.manage')] })] }));
    // ── Sidebar placement (legacy) ──────────────────────────────────────────
    if (variant === 'sidebar') {
        return (_jsx("div", { className: "px-3 pt-2", children: _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs("button", { className: "flex items-center gap-2 w-full rounded-lg border border-sidebar-border/60 bg-sidebar-accent/30 px-2.5 py-1.5 text-left hover:bg-sidebar-accent/50 transition-colors", children: [activeCollection ? (_jsx("span", { className: "h-2.5 w-2.5 shrink-0 rounded-full", style: { backgroundColor: activeCollection.color } })) : (_jsx(Layers, { size: 13, className: "shrink-0 text-sidebar-muted" })), _jsx("span", { className: "flex-1 min-w-0 truncate text-xs font-medium text-sidebar-foreground", children: activeCollection?.name ?? t('collections.allAccounts') }), _jsx(ChevronsUpDown, { size: 13, className: "shrink-0 text-sidebar-muted" })] }) }), menu] }) }));
    }
    // ── Header placement (sticky content-area bar) ──────────────────────────
    // When a collection is active the trigger is tinted with the collection
    // color and gains a one-click clear, so the filtered state is impossible to
    // miss. Idle ("All accounts") it stays quiet.
    return (_jsx("div", { className: "sticky top-0 z-30 -mx-6 mb-6 border-b border-border/60 bg-background/80 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/65 lg:-mx-6", children: _jsxs("div", { className: "flex h-12 max-w-7xl items-center gap-2", children: [_jsx("span", { className: "text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground/70", children: t('collections.viewing') }), _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs("button", { className: "group inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-[13px] transition-colors hover:bg-muted/50", style: activeCollection
                                    ? { borderColor: `${activeCollection.color}55`, backgroundColor: `${activeCollection.color}14` }
                                    : undefined, children: [activeCollection ? (_jsx("span", { className: "h-2.5 w-2.5 shrink-0 rounded-full", style: { backgroundColor: activeCollection.color } })) : (_jsx(Layers, { size: 14, className: "shrink-0 text-muted-foreground" })), _jsx("span", { className: activeCollection
                                            ? 'font-medium text-foreground'
                                            : 'text-muted-foreground group-hover:text-foreground', children: activeCollection?.name ?? t('collections.allAccounts') }), _jsx(ChevronsUpDown, { size: 13, className: "shrink-0 text-muted-foreground/70" })] }) }), menu] }), activeCollection && (_jsxs("button", { onClick: () => setActiveCollectionId(null), className: "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", "aria-label": t('collections.clearFilter'), children: [_jsx(X, { size: 13 }), t('collections.clearFilter')] }))] }) }));
}
