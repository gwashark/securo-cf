import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDisplayLocale } from '../hooks/use-display-locale.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { toast } from 'sonner';
import { groups as groupsApi } from '../lib/api.js';
import { formatCurrency } from '../lib/format.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { Button } from './ui/button.js';
import { GroupForm } from './group-form.js';
import { MemberForm } from './member-form.js';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog.js';
function buildRows(group, current) {
    if (!group)
        return [];
    // Pydantic serializes Decimal as a string, so values arriving from
    // the API may be either number or string. Coerce both shapes.
    const toNum = (v) => {
        if (v == null)
            return null;
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? n : null;
    };
    const byMember = new Map();
    for (const split of current?.splits ?? []) {
        byMember.set(split.group_member_id, {
            amount: toNum(split.share_amount),
            pct: toNum(split.share_pct),
        });
    }
    return group.members.map((m) => {
        const existing = byMember.get(m.id);
        return {
            member_id: m.id,
            selected: !!existing,
            amount: existing?.amount != null ? existing.amount.toFixed(2) : '',
            percent: existing?.pct != null ? existing.pct.toString() : '',
        };
    });
}
export function TransactionSplitsSection({ amount, currency, value, onChange, onValidityChange, }) {
    const { t } = useTranslation();
    const locale = useDisplayLocale();
    const [enabled, setEnabled] = useState(value !== null);
    const [groupId, setGroupId] = useState('');
    const [shareType, setShareType] = useState(value?.share_type ?? 'equal');
    const [rows, setRows] = useState([]);
    // Snapshot of the initial value so row hydration survives the
    // first push-state-up cycle (which zeros the parent before the
    // group has finished loading).
    const seedRef = useRef(value);
    // Once rows have been hydrated for the seeded value, stop applying
    // it — further edits are user-driven.
    const hydratedRef = useRef(false);
    const queryClient = useQueryClient();
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupKind, setNewGroupKind] = useState('social');
    const [newGroupCurrency, setNewGroupCurrency] = useState(currency);
    const [newGroupNotes, setNewGroupNotes] = useState('');
    // Sync newGroupCurrency default value if currency prop changes.
    useEffect(() => {
        setNewGroupCurrency(currency);
    }, [currency]);
    const createGroupMutation = useMutation({
        mutationFn: (payload) => groupsApi.create(payload),
        onSuccess: (newGroup) => {
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            setGroupId(newGroup.id);
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
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [newMemberLinkedUserId, setNewMemberLinkedUserId] = useState(null);
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
    // Reset creation state if splits are disabled
    useEffect(() => {
        if (!enabled) {
            setIsCreatingGroup(false);
            setIsAddingMember(false);
        }
    }, [enabled]);
    const { data: groups } = useQuery({
        queryKey: ['groups'],
        queryFn: () => groupsApi.list(false),
    });
    const { data: group } = useQuery({
        queryKey: ['groups', groupId],
        queryFn: () => groupsApi.get(groupId),
        enabled: !!groupId && !isCreatingGroup && !isAddingMember,
    });
    // Auto-pick the group when splits are enabled. If the parent seeded a
    // value (edit flow), look up which group the existing split members
    // belong to so the dialog opens on the right one. Otherwise fall back
    // to the first group.
    useEffect(() => {
        if (!enabled || groupId || !groups || groups.length === 0)
            return;
        const seededIds = new Set((seedRef.current?.splits ?? []).map((s) => s.group_member_id));
        if (seededIds.size > 0) {
            const match = groups.find((g) => g.members.some((m) => seededIds.has(m.id)));
            if (match) {
                setGroupId(match.id);
                return;
            }
        }
        setGroupId(groups[0].id);
    }, [enabled, groupId, groups]);
    const lastGroupIdRef = useRef(null);
    // Rebuild rows when the group changes or when members are added.
    // Use the seed snapshot only on the first hydration so the parent's
    // value doesn't get zeroed by the push-state-up effect.
    useEffect(() => {
        if (!group)
            return;
        const groupChanged = lastGroupIdRef.current !== group.id;
        lastGroupIdRef.current = group.id;
        setRows((prevRows) => {
            // If first hydration or switched groups, rebuild completely
            if (!hydratedRef.current || groupChanged) {
                const source = hydratedRef.current ? null : seedRef.current;
                return buildRows(group, source);
            }
            // Otherwise, merge new group members into existing rows state to preserve user selections
            const prevMap = new Map(prevRows.map((r) => [r.member_id, r]));
            return group.members.map((m) => {
                const existing = prevMap.get(m.id);
                if (existing)
                    return existing;
                return {
                    member_id: m.id,
                    selected: false,
                    amount: '',
                    percent: '',
                };
            });
        });
        hydratedRef.current = true;
    }, [group]);
    // Push state up whenever it changes meaningfully.
    useEffect(() => {
        if (!enabled) {
            onChange(null);
            return;
        }
        const selected = rows.filter((r) => r.selected);
        if (selected.length === 0) {
            onChange(null);
            return;
        }
        const splits = selected.map((r) => {
            if (shareType === 'exact') {
                return {
                    group_member_id: r.member_id,
                    share_amount: r.amount ? parseFloat(r.amount) : 0,
                };
            }
            if (shareType === 'percent') {
                return {
                    group_member_id: r.member_id,
                    share_pct: r.percent ? parseFloat(r.percent) : 0,
                };
            }
            return { group_member_id: r.member_id };
        });
        onChange({ share_type: shareType, splits });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, shareType, rows]);
    // Validation summary
    const total = useMemo(() => {
        if (!enabled)
            return null;
        const selected = rows.filter((r) => r.selected);
        if (selected.length === 0)
            return null;
        if (shareType === 'equal') {
            return amount;
        }
        if (shareType === 'exact') {
            return selected.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
        }
        return selected.reduce((sum, r) => sum + (parseFloat(r.percent) || 0), 0);
    }, [enabled, shareType, rows, amount]);
    // True when the splits payload is acceptable for the backend. Equal mode
    // always materializes correctly; exact must sum to the parent amount;
    // percent must sum to exactly 100. Reported up so the parent dialog can
    // gate its save button instead of relying on a 400 round-trip.
    const isValid = useMemo(() => {
        if (!enabled)
            return true;
        const selected = rows.filter((r) => r.selected);
        if (selected.length === 0)
            return false;
        if (shareType === 'equal')
            return true;
        if (shareType === 'exact') {
            const sum = selected.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
            return Math.abs(sum - Math.abs(amount)) < 0.005;
        }
        const pctSum = selected.reduce((s, r) => s + (parseFloat(r.percent) || 0), 0);
        return Math.abs(pctSum - 100) < 0.005;
    }, [enabled, shareType, rows, amount]);
    useEffect(() => {
        onValidityChange?.(isValid);
    }, [isValid, onValidityChange]);
    const updateRow = (memberId, patch) => {
        setRows((prev) => prev.map((r) => (r.member_id === memberId ? { ...r, ...patch } : r)));
    };
    return (_jsxs("div", { className: "space-y-3 pt-2 border-t border-border", children: [_jsxs("label", { className: "text-sm font-medium inline-flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: enabled, onChange: (e) => setEnabled(e.target.checked), className: "h-4 w-4 rounded border-border accent-primary" }), _jsx(Users, { size: 14 }), t('splitGroups.splitTransaction')] }), enabled && (_jsx("div", { className: "space-y-3 pl-6", children: !groups || groups.length === 0 ? (_jsxs("div", { className: "space-y-2 py-2", children: [_jsx("p", { className: "text-xs text-muted-foreground font-semibold", children: t('splitGroups.splitNoGroups') }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [t('splitGroups.splitNoGroupsLinkPrefix'), _jsx("button", { type: "button", onClick: () => {
                                        setIsCreatingGroup(true);
                                        setNewGroupName('');
                                        setNewGroupKind('social');
                                        setNewGroupCurrency(currency);
                                        setNewGroupNotes('');
                                    }, className: "text-primary hover:underline font-semibold", children: t('splitGroups.splitNoGroupsLinkSuffix') }), "."] })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Label, { className: "text-xs", children: t('splitGroups.group') }), _jsxs("button", { type: "button", onClick: () => {
                                                        setIsCreatingGroup(true);
                                                        setNewGroupName('');
                                                        setNewGroupKind('social');
                                                        setNewGroupCurrency(currency);
                                                        setNewGroupNotes('');
                                                    }, className: "text-xs text-primary hover:underline font-medium", children: ["+ ", t('splitGroups.add')] })] }), _jsx("select", { className: "w-full border border-border rounded-md px-2 py-1.5 text-sm bg-card", value: groupId, onChange: (e) => setGroupId(e.target.value), children: groups.map((g) => (_jsx("option", { value: g.id, children: g.name }, g.id))) })] }), _jsxs("div", { className: "space-y-1", children: [_jsx(Label, { className: "text-xs", children: t('splitGroups.shareType') }), _jsxs("select", { className: "w-full border border-border rounded-md px-2 py-1.5 text-sm bg-card", value: shareType, onChange: (e) => setShareType(e.target.value), children: [_jsx("option", { value: "equal", children: t('splitGroups.shareEqual') }), _jsx("option", { value: "exact", children: t('splitGroups.shareExact') }), _jsx("option", { value: "percent", children: t('splitGroups.sharePercent') })] })] })] }), group && (_jsxs("div", { className: "space-y-2", children: [group.members.length > 0 && (_jsxs("div", { className: "flex items-center justify-between border-t border-border pt-2 mt-2", children: [_jsx(Label, { className: "text-xs", children: t('splitGroups.members') }), _jsxs("button", { type: "button", onClick: () => {
                                                setIsAddingMember(true);
                                                setNewMemberName('');
                                                setNewMemberEmail('');
                                                setNewMemberLinkedUserId(null);
                                            }, className: "text-xs text-primary hover:underline font-medium", children: ["+ ", t('splitGroups.addMember')] })] })), group.members.length === 0 ? (_jsxs("div", { className: "py-2 text-center", children: [_jsx("p", { className: "text-xs text-muted-foreground mb-2", children: t('splitGroups.splitNoMembers') }), _jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: () => {
                                                setIsAddingMember(true);
                                                setNewMemberName('');
                                                setNewMemberEmail('');
                                                setNewMemberLinkedUserId(null);
                                            }, children: ["+ ", t('splitGroups.addMember')] })] })) : ((() => {
                                    const selectedCount = rows.filter((r) => r.selected).length;
                                    const absAmount = Math.abs(amount);
                                    return group.members.map((m) => {
                                        const row = rows.find((r) => r.member_id === m.id);
                                        if (!row)
                                            return null;
                                        const computed = !row.selected
                                            ? null
                                            : shareType === 'equal'
                                                ? selectedCount > 0
                                                    ? absAmount / selectedCount
                                                    : null
                                                : shareType === 'percent'
                                                    ? (parseFloat(row.percent) || 0) * absAmount / 100
                                                    : null;
                                        return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("label", { className: "flex items-center gap-2 flex-1 min-w-0 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: row.selected, onChange: (e) => updateRow(m.id, { selected: e.target.checked }), className: "h-4 w-4 rounded border-border accent-primary" }), _jsxs("span", { className: "text-sm flex-1 min-w-0 truncate", children: [m.name, m.is_self && (_jsxs("span", { className: "ml-1.5 text-xs text-primary", children: ["(", t('splitGroups.you'), ")"] }))] })] }), computed !== null && (_jsx("span", { className: "text-xs text-muted-foreground tabular-nums", children: formatCurrency(computed, currency, locale) })), shareType === 'exact' && row.selected && (_jsx(Input, { type: "number", step: "0.01", className: "w-24 h-8 text-sm", value: row.amount, onChange: (e) => updateRow(m.id, { amount: e.target.value }) })), shareType === 'percent' && row.selected && (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Input, { type: "number", step: "0.01", className: "w-20 h-8 text-sm", value: row.percent, onChange: (e) => updateRow(m.id, { percent: e.target.value }) }), _jsx("span", { className: "text-xs text-muted-foreground", children: "%" })] }))] }, m.id));
                                    });
                                })())] })), total !== null && (_jsx("div", { className: "text-xs text-muted-foreground", children: shareType === 'percent' ? (_jsx("span", { className: total === 100 ? 'text-emerald-600' : 'text-amber-600', children: t('splitGroups.percentSum', { total: total.toFixed(2) }) })) : shareType === 'exact' ? (_jsx("span", { className: Math.abs(total - Math.abs(amount)) < 0.005
                                    ? 'text-emerald-600'
                                    : 'text-amber-600', children: t('splitGroups.amountSum', {
                                    total: total.toFixed(2),
                                    target: Math.abs(amount).toFixed(2),
                                    currency,
                                }) })) : (_jsx("span", { children: t('splitGroups.equalHint') })) }))] })) })), _jsx(Dialog, { open: isCreatingGroup, onOpenChange: setIsCreatingGroup, children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('splitGroups.add') }) }), _jsx("div", { className: "space-y-4 py-2", children: _jsx(GroupForm, { name: newGroupName, onChangeName: setNewGroupName, kind: newGroupKind, onChangeKind: setNewGroupKind, defaultCurrency: newGroupCurrency, onChangeDefaultCurrency: setNewGroupCurrency, notes: newGroupNotes, onChangeNotes: setNewGroupNotes }) }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => setIsCreatingGroup(false), disabled: createGroupMutation.isPending, children: t('common.cancel', 'Cancel') }), _jsx(Button, { type: "button", onClick: handleCreateGroup, disabled: !newGroupName.trim() || createGroupMutation.isPending, children: createGroupMutation.isPending ? t('common.saving') : t('splitGroups.add') })] })] }) }), _jsx(Dialog, { open: isAddingMember, onOpenChange: setIsAddingMember, children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('splitGroups.addMember') }) }), _jsx("div", { className: "space-y-4 py-2", children: _jsx(MemberForm, { name: newMemberName, onChangeName: setNewMemberName, email: newMemberEmail, onChangeEmail: setNewMemberEmail, linkedUserId: newMemberLinkedUserId, onChangeLinkedUserId: setNewMemberLinkedUserId }) }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => setIsAddingMember(false), disabled: createMemberMutation.isPending, children: t('common.cancel', 'Cancel') }), _jsx(Button, { type: "button", onClick: handleCreateMember, disabled: !newMemberName.trim() || createMemberMutation.isPending, children: createMemberMutation.isPending ? t('common.saving') : t('common.save') })] })] }) })] }));
}
