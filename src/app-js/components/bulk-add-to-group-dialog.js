import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { groups as groupsApi } from '../lib/api.js';
import { useAuth } from '../contexts/auth-context.js';
import { Button } from './ui/button.js';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, } from './ui/dialog.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { GroupForm } from './group-form.js';
import { MemberForm } from './member-form.js';
export function BulkAddToGroupDialog({ open, onClose, selectedCount, onSubmit, isPending, }) {
    return (_jsx(Dialog, { open: open, onOpenChange: (v) => { if (!v)
            onClose(); }, children: _jsx(DialogContent, { className: "sm:max-w-md", children: _jsx(BulkAddToGroupForm, { selectedCount: selectedCount, onCancel: onClose, onSubmit: onSubmit, isPending: isPending }) }) }));
}
function BulkAddToGroupForm({ selectedCount, onCancel, onSubmit, isPending, }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const userCurrency = user?.preferences?.currency_display ?? 'USD';
    // Track group creation state and fields
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupKind, setNewGroupKind] = useState('social');
    const [newGroupCurrency, setNewGroupCurrency] = useState(userCurrency);
    const [newGroupNotes, setNewGroupNotes] = useState('');
    // Track member creation state and fields
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [newMemberLinkedUserId, setNewMemberLinkedUserId] = useState(null);
    // Track only the user's explicit group choice — the effective `groupId`
    // is derived below so we don't need an effect to "auto-pick" the first
    // group when data arrives.
    const [explicitGroupId, setExplicitGroupId] = useState(null);
    const [shareType, setShareType] = useState('equal');
    // Per-member selection state, keyed by member id. Members not present in
    // the map use defaults (selected, empty percent) so we don't need an
    // effect to seed the rows when the group query resolves.
    const [selectionByMember, setSelectionByMember] = useState({});
    const { data: groups } = useQuery({
        queryKey: ['groups'],
        queryFn: () => groupsApi.list(false),
    });
    const ownedGroups = useMemo(() => (groups ?? []).filter((g) => g.is_owner && !g.is_archived), [groups]);
    const createGroupMutation = useMutation({
        mutationFn: (payload) => groupsApi.create(payload),
        onSuccess: (newGroup) => {
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            setExplicitGroupId(newGroup.id);
            setIsCreatingGroup(false);
            setNewGroupName('');
            setNewGroupNotes('');
            toast.success(t('splitGroups.created'));
        },
        onError: () => toast.error(t('common.error')),
    });
    const handleCreateGroup = () => {
        if (!newGroupName.trim())
            return;
        createGroupMutation.mutate({
            name: newGroupName.trim(),
            kind: newGroupKind,
            default_currency: newGroupCurrency,
            notes: newGroupNotes.trim() || null,
        });
    };
    const showCreateGroupForm = isCreatingGroup;
    const showCreateMemberForm = isAddingMember;
    const groupId = explicitGroupId ?? ownedGroups[0]?.id ?? '';
    const { data: group } = useQuery({
        queryKey: ['groups', groupId],
        queryFn: () => groupsApi.get(groupId),
        enabled: !!groupId && !showCreateGroupForm && !showCreateMemberForm,
    });
    const createMemberMutation = useMutation({
        mutationFn: (payload) => groupsApi.members.create(groupId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
            setIsAddingMember(false);
            setNewMemberName('');
            setNewMemberEmail('');
            setNewMemberLinkedUserId(null);
            toast.success(t('splitGroups.memberAdded'));
        },
        onError: () => toast.error(t('common.error')),
    });
    const handleCreateMember = () => {
        if (!newMemberName.trim())
            return;
        createMemberMutation.mutate({
            name: newMemberName.trim(),
            email: newMemberEmail.trim() || null,
            linked_user_id: newMemberLinkedUserId,
        });
    };
    const rows = useMemo(() => (group?.members ?? []).map((m) => ({
        member_id: m.id,
        selected: selectionByMember[m.id]?.selected ?? true,
        percent: selectionByMember[m.id]?.percent ?? '',
    })), [group, selectionByMember]);
    const updateRow = (memberId, patch) => {
        setSelectionByMember((prev) => ({
            ...prev,
            [memberId]: {
                selected: prev[memberId]?.selected ?? true,
                percent: prev[memberId]?.percent ?? '',
                ...patch,
            },
        }));
    };
    const selectedRows = rows.filter((r) => r.selected);
    const percentSum = useMemo(() => {
        if (shareType !== 'percent')
            return null;
        return selectedRows.reduce((s, r) => s + (parseFloat(r.percent) || 0), 0);
    }, [shareType, selectedRows]);
    const isValid = useMemo(() => {
        if (!groupId)
            return false;
        if (selectedRows.length === 0)
            return false;
        if (shareType === 'equal')
            return true;
        return Math.abs((percentSum ?? 0) - 100) < 0.005;
    }, [groupId, selectedRows, shareType, percentSum]);
    const handleSubmit = () => {
        if (!isValid)
            return;
        onSubmit({
            groupId,
            share_type: shareType,
            member_splits: selectedRows.map((r) => {
                if (shareType === 'percent') {
                    return {
                        group_member_id: r.member_id,
                        share_pct: parseFloat(r.percent) || 0,
                    };
                }
                return { group_member_id: r.member_id };
            }),
        });
    };
    return (_jsxs(_Fragment, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: showCreateGroupForm
                        ? t('splitGroups.add')
                        : showCreateMemberForm
                            ? t('splitGroups.addMember')
                            : t('transactions.bulkAddToGroupTitle', { count: selectedCount }) }) }), showCreateGroupForm ? (_jsx("div", { className: "space-y-4 py-2", children: _jsx(GroupForm, { name: newGroupName, onChangeName: setNewGroupName, kind: newGroupKind, onChangeKind: setNewGroupKind, defaultCurrency: newGroupCurrency, onChangeDefaultCurrency: setNewGroupCurrency, notes: newGroupNotes, onChangeNotes: setNewGroupNotes }) })) : showCreateMemberForm ? (_jsx("div", { className: "space-y-4 py-2", children: _jsx(MemberForm, { name: newMemberName, onChangeName: setNewMemberName, email: newMemberEmail, onChangeEmail: setNewMemberEmail, linkedUserId: newMemberLinkedUserId, onChangeLinkedUserId: setNewMemberLinkedUserId }) })) : ownedGroups.length === 0 ? (_jsxs("div", { className: "space-y-2 py-4", children: [_jsx("p", { className: "text-sm text-muted-foreground font-semibold", children: t('splitGroups.splitNoGroups') }), _jsxs("p", { className: "text-sm text-muted-foreground", children: [t('splitGroups.splitNoGroupsLinkPrefix'), _jsx("button", { type: "button", onClick: () => {
                                    setIsCreatingGroup(true);
                                    setNewGroupName('');
                                    setNewGroupCurrency(userCurrency);
                                    setNewGroupNotes('');
                                }, className: "text-primary hover:underline font-semibold", children: t('splitGroups.splitNoGroupsLinkSuffix') }), "."] })] })) : (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Label, { className: "text-xs", children: t('splitGroups.group') }), _jsxs("button", { type: "button", onClick: () => {
                                                    setIsCreatingGroup(true);
                                                    setNewGroupName('');
                                                    setNewGroupCurrency(userCurrency);
                                                    setNewGroupNotes('');
                                                }, className: "text-xs text-primary hover:underline font-medium", children: ["+ ", t('splitGroups.add')] })] }), _jsx("select", { className: "w-full border border-border rounded-md px-2 py-1.5 text-sm bg-card", value: groupId, onChange: (e) => setExplicitGroupId(e.target.value), children: ownedGroups.map((g) => (_jsx("option", { value: g.id, children: g.name }, g.id))) })] }), _jsxs("div", { className: "space-y-1", children: [_jsx(Label, { className: "text-xs", children: t('splitGroups.shareType') }), _jsxs("select", { className: "w-full border border-border rounded-md px-2 py-1.5 text-sm bg-card", value: shareType, onChange: (e) => setShareType(e.target.value), children: [_jsx("option", { value: "equal", children: t('splitGroups.shareEqual') }), _jsx("option", { value: "percent", children: t('splitGroups.sharePercent') })] })] })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: t('transactions.bulkAddToGroupExactHint') }), _jsxs("div", { className: "flex items-center justify-between border-t border-border pt-3", children: [_jsx(Label, { className: "text-xs", children: t('splitGroups.members') }), _jsxs("button", { type: "button", onClick: () => {
                                    setIsAddingMember(true);
                                    setNewMemberName('');
                                    setNewMemberEmail('');
                                    setNewMemberLinkedUserId(null);
                                }, className: "text-xs text-primary hover:underline font-medium", children: ["+ ", t('splitGroups.addMember')] })] }), group && (_jsx("div", { className: "space-y-2 max-h-64 overflow-y-auto pr-1", children: group.members.length === 0 ? (_jsxs("div", { className: "py-4 text-center", children: [_jsx("p", { className: "text-sm text-muted-foreground mb-3", children: t('splitGroups.splitNoMembers') }), _jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: () => {
                                        setIsAddingMember(true);
                                        setNewMemberName('');
                                        setNewMemberEmail('');
                                        setNewMemberLinkedUserId(null);
                                    }, children: ["+ ", t('splitGroups.addMember')] })] })) : (group.members.map((m) => {
                            const row = rows.find((r) => r.member_id === m.id);
                            if (!row)
                                return null;
                            return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: row.selected, onChange: (e) => updateRow(m.id, { selected: e.target.checked }), className: "h-4 w-4 rounded border-border accent-primary" }), _jsxs("span", { className: "text-sm flex-1 min-w-0 truncate", children: [m.name, m.is_self && (_jsxs("span", { className: "ml-1.5 text-xs text-primary", children: ["(", t('splitGroups.you'), ")"] }))] }), shareType === 'percent' && row.selected && (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Input, { type: "number", step: "0.01", className: "w-20 h-8 text-sm", value: row.percent, onChange: (e) => updateRow(m.id, { percent: e.target.value }) }), _jsx("span", { className: "text-xs text-muted-foreground", children: "%" })] }))] }, m.id));
                        })) })), shareType === 'percent' && percentSum !== null && selectedRows.length > 0 && (_jsx("div", { className: "text-xs", children: _jsx("span", { className: Math.abs(percentSum - 100) < 0.005
                                ? 'text-emerald-600'
                                : 'text-amber-600', children: t('splitGroups.percentSum', { total: percentSum.toFixed(2) }) }) })), shareType === 'equal' && selectedRows.length > 0 && (_jsx("p", { className: "text-xs text-muted-foreground", children: t('splitGroups.equalHint') }))] })), _jsx(DialogFooter, { children: showCreateGroupForm ? (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "ghost", onClick: () => setIsCreatingGroup(false), disabled: createGroupMutation.isPending, children: t('common.cancel', 'Cancel') }), _jsx(Button, { onClick: handleCreateGroup, disabled: !newGroupName.trim() || createGroupMutation.isPending, children: createGroupMutation.isPending ? t('common.saving') : t('splitGroups.add') })] })) : showCreateMemberForm ? (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "ghost", onClick: () => setIsAddingMember(false), disabled: createMemberMutation.isPending, children: t('common.cancel', 'Cancel') }), _jsx(Button, { onClick: handleCreateMember, disabled: !newMemberName.trim() || createMemberMutation.isPending, children: createMemberMutation.isPending ? t('common.saving') : t('common.save') })] })) : (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "ghost", onClick: onCancel, disabled: isPending, children: t('common.cancel', 'Cancel') }), _jsx(Button, { onClick: handleSubmit, disabled: !isValid || isPending || ownedGroups.length === 0, children: t('transactions.bulkAddToGroupSubmit') })] })) })] }));
}
