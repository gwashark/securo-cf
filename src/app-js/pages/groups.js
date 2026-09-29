import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { groups as groupsApi } from '../lib/api.js';
import { useAuth } from '../contexts/auth-context.js';
import { useWorkspace } from '../contexts/workspace-context.js';
import { Button } from '../components/ui/button.js';
import { DeleteConfirmationDialog } from '../components/delete-confirmation-dialog.js';
import { Skeleton } from '../components/ui/skeleton.js';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, } from '../components/ui/dialog.js';
import { GroupForm } from '../components/group-form.js';
import { PageHeader } from '../components/page-header.js';
import { Archive, ChevronRight, Plus, Trash2, Users } from 'lucide-react';
export default function GroupsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { canWrite } = useWorkspace();
    const userCurrency = user?.preferences?.currency_display ?? 'USD';
    const [statusFilter, setStatusFilter] = useState('active');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [deletingGroup, setDeletingGroup] = useState(null);
    const includeArchived = statusFilter !== 'active';
    const [name, setName] = useState('');
    const [kind, setKind] = useState('social');
    const [defaultCurrency, setDefaultCurrency] = useState(userCurrency);
    const [notes, setNotes] = useState('');
    const { data: list, isLoading } = useQuery({
        queryKey: ['groups', { includeArchived }],
        queryFn: () => groupsApi.list(includeArchived),
    });
    const createMutation = useMutation({
        mutationFn: (payload) => groupsApi.create(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            setDialogOpen(false);
            toast.success(t('splitGroups.created'));
        },
        onError: () => toast.error(t('common.error')),
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, payload }) => groupsApi.update(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            setDialogOpen(false);
            setEditing(null);
            toast.success(t('splitGroups.updated'));
        },
        onError: () => toast.error(t('common.error')),
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => groupsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            setDialogOpen(false);
            setEditing(null);
            setDeletingGroup(null);
            toast.success(t('splitGroups.deleted'));
        },
        onError: (err) => {
            const detail = err && typeof err === 'object' && 'response' in err
                ? err.response?.data?.detail
                : undefined;
            toast.error(detail ?? t('common.error'));
        },
    });
    const openCreate = () => {
        setEditing(null);
        setName('');
        setKind('social');
        setDefaultCurrency(userCurrency);
        setNotes('');
        setDialogOpen(true);
    };
    const openEdit = (group) => {
        setEditing(group);
        setName(group.name);
        setKind(group.kind);
        setDefaultCurrency(group.default_currency);
        setNotes(group.notes ?? '');
        setDialogOpen(true);
    };
    // Dismissing the confirmation (cancel, Esc, X, overlay) puts the user back in
    // the edit dialog they opened it from, instead of dropping them on the list.
    const returnToEditDialog = () => {
        setDeletingGroup(null);
        setDialogOpen(true);
    };
    const handleSave = () => {
        const payload = {
            name: name.trim(),
            kind,
            default_currency: defaultCurrency,
            notes: notes.trim() || null,
        };
        if (editing) {
            updateMutation.mutate({ id: editing.id, payload });
        }
        else {
            createMutation.mutate(payload);
        }
    };
    const visibleGroups = (list ?? []).filter((g) => statusFilter === 'active'
        ? !g.is_archived
        : statusFilter === 'archived'
            ? g.is_archived
            : true);
    return (_jsxs("div", { children: [_jsx(PageHeader, { section: t('splitGroups.section'), title: t('splitGroups.title'), action: canWrite ? (_jsx("div", { className: "flex w-full flex-wrap items-center gap-2 sm:w-auto", children: _jsxs(Button, { size: "sm", className: "h-8 gap-1.5", onClick: openCreate, children: [_jsx(Plus, { size: 13 }), _jsx("span", { children: t('splitGroups.add') })] }) })) : undefined }), _jsx("div", { className: "flex items-center gap-2 mb-4", children: ['active', 'archived', 'all'].map((s) => (_jsx("button", { onClick: () => setStatusFilter(s), className: `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'}`, children: t(`splitGroups.filter.${s}`) }, s))) }), _jsx("div", { className: "bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-4", children: isLoading ? (_jsx("div", { className: "p-6 space-y-3", children: Array.from({ length: 3 }).map((_, i) => (_jsx(Skeleton, { className: "h-14 w-full" }, i))) })) : visibleGroups.length === 0 ? (_jsxs("div", { className: "text-center py-16 text-muted-foreground", children: [_jsx(Users, { size: 32, className: "mx-auto mb-2 opacity-50" }), _jsx("p", { children: t('splitGroups.empty') }), _jsx("p", { className: "text-xs mt-1", children: t('splitGroups.emptyHint') })] })) : (_jsx("ul", { className: "divide-y divide-border", children: visibleGroups.map((group) => (_jsxs("li", { className: "flex items-center gap-3 px-4 py-3.5 hover:bg-muted cursor-pointer transition-colors", onClick: () => navigate(`/groups/${group.id}`), children: [_jsx("div", { className: "h-10 w-10 rounded-full flex items-center justify-center shrink-0", style: { backgroundColor: `${group.color}22`, color: group.color }, "aria-hidden": true, children: _jsx(Users, { size: 18 }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: "text-sm font-semibold text-foreground truncate", children: group.name }), _jsx("span", { className: "text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full", children: t(`splitGroups.kind.${group.kind}`) }), group.is_archived && (_jsxs("span", { className: "text-xs bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1", children: [_jsx(Archive, { size: 10 }), t('splitGroups.archived')] })), !group.is_owner && (_jsx("span", { className: "text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full", children: t('splitGroups.sharedWithYou') }))] }), _jsxs("p", { className: "text-xs text-muted-foreground mt-0.5", children: [t('splitGroups.memberCount', { count: group.members.length }), " \u00B7 ", group.default_currency] })] }), group.is_owner && canWrite && (_jsx(Button, { variant: "ghost", size: "sm", onClick: (e) => {
                                    e.stopPropagation();
                                    openEdit(group);
                                }, children: t('common.edit') })), _jsx(ChevronRight, { size: 16, className: "text-muted-foreground shrink-0" })] }, group.id))) })) }), _jsx(Dialog, { open: dialogOpen, onOpenChange: setDialogOpen, children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: editing ? t('splitGroups.edit') : t('splitGroups.add') }) }), _jsxs("div", { className: "space-y-4", children: [_jsx(GroupForm, { name: name, onChangeName: setName, kind: kind, onChangeKind: setKind, defaultCurrency: defaultCurrency, onChangeDefaultCurrency: setDefaultCurrency, notes: notes, onChangeNotes: setNotes }), editing && (_jsxs("label", { className: "text-sm text-muted-foreground inline-flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: editing.is_archived, onChange: (e) => updateMutation.mutate({
                                                id: editing.id,
                                                payload: { is_archived: e.target.checked },
                                            }), className: "h-4 w-4 rounded border-border accent-primary" }), t('splitGroups.archived')] }))] }), _jsxs(DialogFooter, { className: editing ? 'flex justify-between sm:justify-between' : '', children: [editing && (_jsxs(Button, { variant: "destructive", onClick: () => {
                                        setDialogOpen(false);
                                        setDeletingGroup(editing);
                                    }, disabled: deleteMutation.isPending, children: [_jsx(Trash2, { size: 14, className: "mr-1" }), t('common.delete')] })), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "outline", onClick: () => setDialogOpen(false), children: t('common.cancel') }), _jsx(Button, { onClick: handleSave, disabled: !name.trim() || createMutation.isPending || updateMutation.isPending, children: t('common.save') })] })] })] }) }), _jsx(DeleteConfirmationDialog, { open: !!deletingGroup, title: t('splitGroups.confirmDeleteTitle'), description: t('splitGroups.confirmDeleteDescription', { name: deletingGroup?.name }), isPending: deleteMutation.isPending, onClose: returnToEditDialog, onConfirm: () => deletingGroup && deleteMutation.mutate(deletingGroup.id) })] }));
}
