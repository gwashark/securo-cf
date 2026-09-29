import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import { users as usersApi } from '../lib/api.js';
import { useAuth } from '../contexts/auth-context.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
export function MemberForm({ name, onChangeName, email, onChangeEmail, linkedUserId, onChangeLinkedUserId, }) {
    const { t } = useTranslation();
    const { user } = useAuth();
    // Directory of all Securo users on the instance
    const { data: userDirectory } = useQuery({
        queryKey: ['users', 'directory'],
        queryFn: () => usersApi.directory(),
        staleTime: 60_000,
    });
    // Resolve a typed email to an existing Securo user
    const trimmedEmail = email.trim();
    const { data: lookupResult } = useQuery({
        queryKey: ['users', 'lookup', trimmedEmail.toLowerCase()],
        queryFn: () => usersApi.lookupByEmail(trimmedEmail),
        enabled: trimmedEmail.length >= 3 && trimmedEmail.includes('@'),
        staleTime: 60_000,
        retry: false,
    });
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('splitGroups.linkedUser') }), _jsxs("select", { className: "w-full border border-border rounded-md px-3 py-2 text-sm bg-card h-9 focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]", value: linkedUserId ?? '', onChange: (e) => {
                            const id = e.target.value || null;
                            onChangeLinkedUserId(id);
                            if (id) {
                                const picked = userDirectory?.find((u) => u.id === id);
                                if (picked) {
                                    onChangeEmail(picked.email);
                                    onChangeName(picked.email.split('@')[0]);
                                }
                            }
                        }, children: [_jsx("option", { value: "", children: t('splitGroups.linkedUserNone') }), (userDirectory ?? []).map((u) => (_jsxs("option", { value: u.id, children: [u.email, u.id === user?.id ? ` (${t('splitGroups.you')})` : ''] }, u.id)))] }), _jsx("p", { className: "text-xs text-muted-foreground", children: t('splitGroups.linkedUserHint') })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('splitGroups.memberName') }), _jsx(Input, { value: name, onChange: (e) => onChangeName(e.target.value), disabled: linkedUserId !== null })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('splitGroups.memberEmail') }), _jsx(Input, { type: "email", value: email, onChange: (e) => onChangeEmail(e.target.value), disabled: linkedUserId !== null }), linkedUserId !== null ? (_jsxs("p", { className: "text-xs text-emerald-600 inline-flex items-center gap-1", children: [_jsx(Link2, { size: 11 }), t('splitGroups.willLinkToUser', { email })] })) : lookupResult ? (_jsxs("p", { className: "text-xs text-emerald-600 inline-flex items-center gap-1", children: [_jsx(Link2, { size: 11 }), t('splitGroups.willLinkToUser', { email: lookupResult.email })] })) : (_jsx("p", { className: "text-xs text-muted-foreground", children: t('splitGroups.memberEmailHint') }))] })] }));
}
