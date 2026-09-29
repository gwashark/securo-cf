import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Fingerprint, Loader2, TriangleAlert, X } from 'lucide-react';
import { auth } from '../lib/api.js';
import { passkeyBlocker, passkeyFailure, startPasskeyRegistration } from '../lib/webauthn.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from './ui/dialog.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
const FAILURE_KEYS = {
    cancelled: 'auth.passkeyCancelled',
    duplicate: 'auth.passkeyDuplicate',
    domain: 'auth.passkeyDomainError',
    mismatch: 'auth.passkeyDomainMismatch',
    ip: 'auth.passkeyIpAddress',
    insecure: 'auth.passkeyInsecureContext',
    unsupported: 'auth.passkeyUnsupported',
    unknown: 'auth.passkeyRegisterError',
};
export function PasskeyManagementDialog({ open, onClose, localAuthEnabled = true }) {
    const { t } = useTranslation();
    const [passkeys, setPasskeys] = useState([]);
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [loadFailed, setLoadFailed] = useState(false);
    // The blocker only explains why registration is unavailable. With local auth
    // off there is no registration form to explain, so the warning would be noise
    // on top of the cleanup copy.
    const blocker = localAuthEnabled ? passkeyBlocker() : null;
    const loadPasskeys = useCallback(async () => {
        setLoading(true);
        setLoadFailed(false);
        try {
            setPasskeys(await auth.listPasskeys());
        }
        catch {
            setLoadFailed(true);
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        if (open)
            void loadPasskeys();
    }, [open, loadPasskeys]);
    const formatDate = (value) => {
        if (!value)
            return t('auth.passkeyNeverUsed');
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
    };
    const handleClose = () => {
        setName('');
        setConfirmDeleteId(null);
        onClose();
    };
    const handleRegister = async (event) => {
        event.preventDefault();
        if (!localAuthEnabled)
            return;
        const passkeyName = name.trim() || t('auth.defaultPasskeyName');
        setSaving(true);
        try {
            const options = await auth.registerPasskeyOptions(passkeyName);
            const credential = await startPasskeyRegistration(options.options);
            const created = await auth.verifyPasskeyRegistration(options.challenge_id, passkeyName, credential);
            setPasskeys((current) => [...current, created]);
            setName('');
            toast.success(t('auth.passkeyAdded'));
        }
        catch (err) {
            toast.error(t(FAILURE_KEYS[passkeyFailure(err)]));
        }
        finally {
            setSaving(false);
        }
    };
    const handleDelete = async (passkey) => {
        setDeletingId(passkey.id);
        try {
            await auth.deletePasskey(passkey.id);
            setPasskeys((current) => current.filter((item) => item.id !== passkey.id));
            setConfirmDeleteId(null);
            toast.success(t('auth.passkeyDeleted'));
        }
        catch {
            toast.error(t('auth.passkeyDeleteError'));
        }
        finally {
            setDeletingId(null);
        }
    };
    return (_jsx(Dialog, { open: open, onOpenChange: (v) => !v && handleClose(), children: _jsxs(DialogContent, { className: "sm:max-w-lg", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('auth.passkeysTitle') }) }), _jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: t(localAuthEnabled ? 'auth.passkeysDescription' : 'auth.passkeysCleanupDescription') }), blocker && (_jsxs("div", { className: "flex items-start gap-2.5 rounded-lg bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-300", children: [_jsx(TriangleAlert, { size: 16, className: "mt-0.5 shrink-0" }), _jsx("p", { children: t(FAILURE_KEYS[blocker]) })] })), localAuthEnabled && (_jsxs("form", { onSubmit: handleRegister, className: "space-y-3 rounded-lg border p-3", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "passkey-name", children: t('auth.passkeyName') }), _jsx(Input, { id: "passkey-name", value: name, onChange: (event) => setName(event.target.value), placeholder: t('auth.passkeyNamePlaceholder'), maxLength: 100, disabled: saving || !!blocker })] }), _jsxs(Button, { type: "submit", disabled: !!blocker || saving, className: "w-full", children: [saving && _jsx(Loader2, { size: 15, className: "animate-spin" }), saving ? t('auth.passkeyWaiting') : t('auth.addPasskey')] })] })), _jsx("div", { className: "space-y-2", children: loading ? (_jsx("p", { className: "text-sm text-muted-foreground", children: t('common.loading') })) : loadFailed ? (_jsxs("div", { className: "flex items-center justify-between gap-3 rounded-lg border border-destructive/30 p-3", children: [_jsx("p", { className: "text-sm text-destructive", children: t('auth.passkeyLoadError') }), _jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: () => void loadPasskeys(), children: t('common.retry') })] })) : passkeys.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center gap-2 rounded-lg border border-dashed px-3 py-6 text-center", children: [_jsx(Fingerprint, { size: 20, className: "text-muted-foreground" }), _jsx("p", { className: "text-sm text-muted-foreground", children: t('auth.noPasskeys') })] })) : (passkeys.map((passkey) => {
                                const isConfirming = confirmDeleteId === passkey.id;
                                const isDeleting = deletingId === passkey.id;
                                return (_jsxs("div", { className: "flex items-start gap-3 rounded-lg border p-3", children: [_jsx("div", { className: "mt-0.5 rounded-full bg-primary/10 p-2 text-primary", children: _jsx(Fingerprint, { size: 16 }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate text-sm font-medium", children: passkey.name }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [t('auth.passkeyCreated'), ": ", formatDate(passkey.created_at)] }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [t('auth.passkeyLastUsed'), ": ", formatDate(passkey.last_used_at)] })] }), isConfirming ? (_jsxs("div", { className: "flex shrink-0 items-center gap-1", children: [_jsx(Button, { type: "button", variant: "destructive", size: "sm", onClick: () => void handleDelete(passkey), disabled: isDeleting, children: isDeleting ? _jsx(Loader2, { size: 13, className: "animate-spin" }) : t('common.delete') }), _jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => setConfirmDeleteId(null), disabled: isDeleting, "aria-label": t('common.cancel'), children: _jsx(X, { size: 14 }) })] })) : (_jsx(Button, { type: "button", variant: "ghost", size: "sm", className: "shrink-0 text-muted-foreground hover:text-destructive", onClick: () => setConfirmDeleteId(passkey.id), "aria-label": t('auth.deletePasskey'), children: t('common.delete') }))] }, passkey.id));
                            })) })] }), _jsx(DialogFooter, { children: _jsx(Button, { type: "button", variant: "outline", onClick: handleClose, children: t('common.close') }) })] }) }));
}
