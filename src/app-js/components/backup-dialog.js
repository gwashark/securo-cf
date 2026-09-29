import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { backup as backupApi } from '../lib/api.js';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, } from './ui/dialog.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
const MIN_PASSWORD_LENGTH = 8;
/**
 * Asks for an optional password before downloading the workspace archive.
 *
 * Empty means the plain zip Securo has always produced. A password produces an
 * AES-256 zip, which any standard archiver can open, so the backup stays usable
 * even without Securo. Nothing about the password is sent anywhere else or
 * stored: lose it and the archive is gone, which the dialog says out loud.
 */
export function BackupDialog({ open, onClose }) {
    const { t } = useTranslation();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState('');
    const handleClose = () => {
        setPassword('');
        setConfirmPassword('');
        setError('');
        onClose();
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (password && password.length < MIN_PASSWORD_LENGTH) {
            setError(t('backup.passwordTooShort', { min: MIN_PASSWORD_LENGTH }));
            return;
        }
        if (password !== confirmPassword) {
            setError(t('setup.passwordMismatch'));
            return;
        }
        setDownloading(true);
        try {
            await backupApi.download(password || undefined);
            toast.success(password ? t('backup.successEncrypted') : t('backup.success'));
            handleClose();
        }
        catch {
            toast.error(t('backup.error'));
        }
        finally {
            setDownloading(false);
        }
    };
    return (_jsx(Dialog, { open: open, onOpenChange: (v) => !v && handleClose(), children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('backup.dialogTitle') }), _jsx(DialogDescription, { children: t('backup.dialogDescription') })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "backup-password", children: t('backup.passwordLabel') }), _jsx(Input, { id: "backup-password", type: "password", value: password, onChange: (e) => setPassword(e.target.value), autoComplete: "new-password", placeholder: t('backup.passwordPlaceholder') })] }), password && (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "backup-password-confirm", children: t('setup.confirmPassword') }), _jsx(Input, { id: "backup-password-confirm", type: "password", value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value), autoComplete: "new-password" })] })), password && (_jsxs("p", { className: "flex items-start gap-2 rounded-md bg-muted p-3 text-xs text-muted-foreground", children: [_jsx(ShieldCheck, { size: 14, className: "mt-0.5 shrink-0" }), t('backup.encryptionNote')] })), error && _jsx("p", { className: "text-sm text-destructive", children: error }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: handleClose, children: t('common.cancel') }), _jsx(Button, { type: "submit", disabled: downloading, children: downloading ? t('backup.downloading') : t('backup.button') })] })] })] }) }));
}
