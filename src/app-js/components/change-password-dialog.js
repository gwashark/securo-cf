import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '../contexts/auth-context.js';
import { auth } from '../lib/api.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from './ui/dialog.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
export function ChangePasswordDialog({ open, onClose }) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (newPassword.length < 8) {
            setError(t('auth.passwordTooShort'));
            return;
        }
        if (newPassword !== confirmPassword) {
            setError(t('setup.passwordMismatch'));
            return;
        }
        setLoading(true);
        try {
            // Verify current password by attempting login
            await auth.login(user.email, currentPassword);
            await auth.changePassword(newPassword);
            toast.success(t('auth.passwordChanged'));
            handleClose();
        }
        catch {
            setError(t('auth.currentPasswordWrong'));
        }
        finally {
            setLoading(false);
        }
    };
    const handleClose = () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setError('');
        onClose();
    };
    return (_jsx(Dialog, { open: open, onOpenChange: (v) => !v && handleClose(), children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('auth.changePassword') }) }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "current-password", children: t('auth.currentPassword') }), _jsx(Input, { id: "current-password", type: "password", value: currentPassword, onChange: (e) => setCurrentPassword(e.target.value), autoComplete: "current-password", required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "new-password", children: t('auth.newPassword') }), _jsx(Input, { id: "new-password", type: "password", value: newPassword, onChange: (e) => setNewPassword(e.target.value), autoComplete: "new-password", required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "confirm-password", children: t('setup.confirmPassword') }), _jsx(Input, { id: "confirm-password", type: "password", value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value), autoComplete: "new-password", required: true })] }), error && _jsx("p", { className: "text-sm text-destructive", children: error }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: handleClose, children: t('common.cancel') }), _jsx(Button, { type: "submit", disabled: loading, children: loading ? t('common.loading') : t('common.save') })] })] })] }) }));
}
