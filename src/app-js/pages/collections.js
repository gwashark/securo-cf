import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { collections as collectionsApi, accounts as accountsApi, assetGroups as assetGroupsApi } from '../lib/api.js';
import { getAccountName, sortAccountsByDisplayName } from '../lib/account-utils.js';
import { PageHeader } from '../components/page-header.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Skeleton } from '../components/ui/skeleton.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, } from '../components/ui/dialog.js';
import { FolderOpen, Plus, Pencil, Trash2 } from 'lucide-react';
const SWATCHES = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#64748B'];
export default function CollectionsPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const { data: collections, isLoading } = useQuery({
        queryKey: ['collections'],
        queryFn: collectionsApi.list,
    });
    const { data: accounts } = useQuery({
        queryKey: ['accounts'],
        queryFn: () => accountsApi.list(),
    });
    const { data: wallets } = useQuery({
        queryKey: ['asset-groups'],
        queryFn: assetGroupsApi.list,
    });
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['collections'] });
    const createMutation = useMutation({
        mutationFn: collectionsApi.create,
        onSuccess: () => { invalidate(); setDialogOpen(false); toast.success(t('collections.created')); },
        onError: () => toast.error(t('common.error')),
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, ...payload }) => collectionsApi.update(id, payload),
        onSuccess: () => { invalidate(); setDialogOpen(false); setEditing(null); toast.success(t('collections.updated')); },
        onError: () => toast.error(t('common.error')),
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => collectionsApi.delete(id),
        onSuccess: () => { invalidate(); setDeleting(null); toast.success(t('collections.deleted')); },
        onError: () => toast.error(t('common.error')),
    });
    const accountName = useMemo(() => {
        const map = new Map();
        (accounts ?? []).forEach((a) => map.set(a.id, getAccountName(a)));
        return map;
    }, [accounts]);
    const list = collections ?? [];
    return (_jsxs("div", { children: [_jsx(PageHeader, { section: t('nav.groupSetup'), title: t('collections.title'), action: _jsxs(Button, { onClick: () => { setEditing(null); setDialogOpen(true); }, children: [_jsx(Plus, { size: 16, className: "mr-1.5" }), t('collections.add')] }) }), _jsx("p", { className: "text-sm text-muted-foreground mb-5 max-w-2xl", children: t('collections.subtitle') }), _jsx("div", { className: "rounded-xl border border-border/60 bg-card overflow-hidden", children: isLoading ? (_jsx("div", { className: "p-4 space-y-3", children: [...Array(3)].map((_, i) => _jsx(Skeleton, { className: "h-14 w-full rounded-lg" }, i)) })) : list.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center py-16 text-muted-foreground", children: [_jsx(FolderOpen, { size: 32, className: "mb-3 opacity-40" }), _jsx("p", { className: "text-sm", children: t('collections.empty') })] })) : (_jsx("div", { className: "divide-y divide-border/40", children: list.map((c) => (_jsxs("div", { className: "flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors", children: [_jsx("span", { className: "h-8 w-8 shrink-0 rounded-lg", style: { backgroundColor: `${c.color}22` }, children: _jsx("span", { className: "flex h-full w-full items-center justify-center", children: _jsx(FolderOpen, { size: 16, style: { color: c.color } }) }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-foreground truncate", children: c.name }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [t('collections.accountCount', { count: c.account_count }), c.wallet_count > 0 && ` · ${t('collections.walletCount', { count: c.wallet_count })}`] })] }), _jsxs("div", { className: "flex items-center gap-1 shrink-0", children: [_jsx(Button, { variant: "ghost", size: "icon", onClick: () => { setEditing(c); setDialogOpen(true); }, "aria-label": t('common.edit'), children: _jsx(Pencil, { size: 15 }) }), _jsx(Button, { variant: "ghost", size: "icon", onClick: () => setDeleting(c), "aria-label": t('common.delete'), className: "text-muted-foreground/60 hover:text-destructive", children: _jsx(Trash2, { size: 15 }) })] })] }, c.id))) })) }), _jsx(CollectionDialog, { open: dialogOpen, onClose: () => { setDialogOpen(false); setEditing(null); }, collection: editing, accounts: sortAccountsByDisplayName(accounts ?? []).map((a) => ({ id: a.id, label: accountName.get(a.id) ?? a.name, currency: a.currency })), wallets: (wallets ?? []).map((w) => ({ id: w.id, label: w.name })), loading: createMutation.isPending || updateMutation.isPending, onSave: (payload) => {
                    if (editing)
                        updateMutation.mutate({ id: editing.id, ...payload });
                    else
                        createMutation.mutate(payload);
                } }), _jsx(Dialog, { open: !!deleting, onOpenChange: (o) => !o && setDeleting(null), children: _jsxs(DialogContent, { className: "sm:max-w-sm", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('collections.confirmDeleteTitle') }), _jsx(DialogDescription, { children: t('collections.confirmDeleteDesc', { name: deleting?.name }) })] }), _jsxs(DialogFooter, { className: "mt-2", children: [_jsx(Button, { variant: "outline", onClick: () => setDeleting(null), children: t('common.cancel') }), _jsx(Button, { variant: "destructive", disabled: deleteMutation.isPending, onClick: () => deleting && deleteMutation.mutate(deleting.id), children: deleteMutation.isPending ? t('common.loading') : t('common.delete') })] })] }) })] }));
}
function CollectionDialog({ open, onClose, collection, accounts, wallets, loading, onSave, }) {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [color, setColor] = useState(SWATCHES[0]);
    const [selected, setSelected] = useState(new Set());
    const [selectedWallets, setSelectedWallets] = useState(new Set());
    const [formSource, setFormSource] = useState(null);
    if (!formSource || formSource.collection !== collection || formSource.open !== open) {
        setFormSource({ collection, open });
        setName(collection?.name ?? '');
        setColor(collection?.color ?? SWATCHES[0]);
        setSelected(new Set(collection?.account_ids ?? []));
        setSelectedWallets(new Set(collection?.wallet_ids ?? []));
    }
    const toggleIn = (setter) => (id) => setter((prev) => {
        const next = new Set(prev);
        if (next.has(id))
            next.delete(id);
        else
            next.add(id);
        return next;
    });
    const toggle = toggleIn(setSelected);
    const toggleWallet = toggleIn(setSelectedWallets);
    return (_jsx(Dialog, { open: open, onOpenChange: (o) => !o && onClose(), children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: collection ? t('collections.edit') : t('collections.add') }) }), _jsxs("form", { onSubmit: (e) => {
                        e.preventDefault();
                        if (!name.trim())
                            return;
                        onSave({ name: name.trim(), color, account_ids: [...selected], wallet_ids: [...selectedWallets] });
                    }, className: "space-y-4", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: t('collections.name') }), _jsx(Input, { value: name, onChange: (e) => setName(e.target.value), required: true, autoFocus: true, placeholder: t('collections.namePlaceholder') })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: t('collections.color') }), _jsx("div", { className: "flex flex-wrap gap-2", children: SWATCHES.map((s) => (_jsx("button", { type: "button", onClick: () => setColor(s), className: `h-7 w-7 rounded-full transition-transform ${color === s ? 'ring-2 ring-offset-2 ring-offset-background scale-110' : ''}`, style: { backgroundColor: s, boxShadow: color === s ? `0 0 0 2px ${s}` : undefined }, "aria-label": s }, s))) })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: t('collections.accounts') }), _jsx("div", { className: "max-h-56 overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/40", children: accounts.length === 0 ? (_jsx("p", { className: "px-3 py-3 text-xs text-muted-foreground", children: t('collections.noAccounts') })) : (accounts.map((a) => (_jsxs("label", { className: "flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40", children: [_jsx("input", { type: "checkbox", checked: selected.has(a.id), onChange: () => toggle(a.id), className: "h-4 w-4 rounded border-border accent-primary" }), _jsx("span", { className: "flex-1 truncate", children: a.label }), _jsx("span", { className: "text-[10.5px] uppercase tracking-wide text-muted-foreground/70", children: a.currency })] }, a.id)))) }), _jsx("p", { className: "text-xs text-muted-foreground", children: t('collections.accountsHint', { count: selected.size }) })] }), wallets.length > 0 && (_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: t('collections.wallets') }), _jsx("div", { className: "max-h-44 overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/40", children: wallets.map((w) => (_jsxs("label", { className: "flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40", children: [_jsx("input", { type: "checkbox", checked: selectedWallets.has(w.id), onChange: () => toggleWallet(w.id), className: "h-4 w-4 rounded border-border accent-primary" }), _jsx("span", { className: "flex-1 truncate", children: w.label })] }, w.id))) }), _jsx("p", { className: "text-xs text-muted-foreground", children: t('collections.walletsHint', { count: selectedWallets.size }) })] })), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: onClose, children: t('common.cancel') }), _jsx(Button, { type: "submit", disabled: loading || !name.trim(), children: loading ? t('common.loading') : t('common.save') })] })] })] }) }));
}
