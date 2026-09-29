import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/auth-context.js';
import { auth } from '../lib/api.js';
import { isServerUnreachable } from '../lib/auth-errors.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from './ui/dialog.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
export function TwoFactorSetup({ open, onClose, localAuthEnabled = true }) {
    const { t } = useTranslation();
    const { user, updateUser } = useAuth();
    const is2faEnabled = user?.is_2fa_enabled ?? false;
    // Enable flow
    const [secret, setSecret] = useState('');
    const [otpauthUri, setOtpauthUri] = useState('');
    const [setupCode, setSetupCode] = useState('');
    const [setupLoading, setSetupLoading] = useState(false);
    const [setupStep, setSetupStep] = useState('idle');
    const [error, setError] = useState('');
    // Disable flow
    const [disablePassword, setDisablePassword] = useState('');
    const [disableCode, setDisableCode] = useState('');
    const [disableLoading, setDisableLoading] = useState(false);
    const handleSetup = async () => {
        if (!localAuthEnabled)
            return;
        setSetupLoading(true);
        setError('');
        try {
            const data = await auth.setup2fa();
            setSecret(data.secret);
            setOtpauthUri(data.otpauth_uri);
            setSetupStep('qr');
        }
        catch {
            setError(t('common.error'));
        }
        finally {
            setSetupLoading(false);
        }
    };
    const handleEnable = async (e) => {
        e.preventDefault();
        if (!localAuthEnabled)
            return;
        setSetupLoading(true);
        setError('');
        try {
            await auth.enable2fa(setupCode);
            toast.success(t('auth.twoFactorEnabled'));
            if (user)
                updateUser({ ...user, is_2fa_enabled: true });
            handleClose();
        }
        catch {
            setError(t('auth.invalid2faCode'));
        }
        finally {
            setSetupLoading(false);
        }
    };
    const handleDisable = async (e) => {
        e.preventDefault();
        setDisableLoading(true);
        setError('');
        try {
            await auth.disable2fa(disablePassword, disableCode);
            toast.success(t('auth.twoFactorDisabled'));
            if (user)
                updateUser({ ...user, is_2fa_enabled: false });
            handleClose();
        }
        catch (err) {
            const detail = err.response?.data?.detail;
            if (isServerUnreachable(err))
                setError(t('auth.serverError'));
            else if (detail === 'Invalid password')
                setError(t('auth.currentPasswordWrong'));
            else if (detail === 'Invalid 2FA code')
                setError(t('auth.invalid2faCode'));
            else
                setError(t('common.error'));
        }
        finally {
            setDisableLoading(false);
        }
    };
    const handleClose = () => {
        setSecret('');
        setOtpauthUri('');
        setSetupCode('');
        setSetupStep('idle');
        setError('');
        setDisablePassword('');
        setDisableCode('');
        onClose();
    };
    if (is2faEnabled) {
        // Disable flow
        return (_jsx(Dialog, { open: open, onOpenChange: (v) => !v && handleClose(), children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('auth.disable2fa') }) }), _jsxs("form", { onSubmit: handleDisable, className: "space-y-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: t('auth.disable2faDescription') }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "disable-password", children: t('auth.password') }), _jsx(Input, { id: "disable-password", type: "password", autoComplete: "current-password", value: disablePassword, onChange: (e) => setDisablePassword(e.target.value), required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "disable-code", children: t('auth.twoFactor') }), _jsx(Input, { id: "disable-code", type: "text", inputMode: "numeric", autoComplete: "one-time-code", value: disableCode, onChange: (e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6)), placeholder: "000000", className: "text-center text-lg tracking-[0.3em] font-mono", maxLength: 6, required: true })] }), error && (_jsx("p", { role: "alert", className: "text-sm text-destructive", children: error })), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: handleClose, children: t('common.cancel') }), _jsx(Button, { type: "submit", variant: "destructive", disabled: disableLoading || disableCode.length !== 6, children: disableLoading ? t('common.loading') : t('auth.disable2fa') })] })] })] }) }));
    }
    // Enrollment is a local-credential feature: with local auth off the backend
    // refuses /2fa/setup, so the dialog exists only to let an already-enrolled
    // user disable 2FA.
    if (!localAuthEnabled)
        return null;
    // Enable flow
    return (_jsx(Dialog, { open: open, onOpenChange: (v) => !v && handleClose(), children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('auth.setup2fa') }) }), setupStep === 'idle' ? (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: t('auth.setup2faDescription') }), error && _jsx("p", { className: "text-sm text-destructive", children: error }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: handleClose, children: t('common.cancel') }), _jsx(Button, { onClick: handleSetup, disabled: setupLoading, children: setupLoading ? t('common.loading') : t('auth.enable2fa') })] })] })) : (_jsxs("form", { onSubmit: handleEnable, className: "space-y-4", children: [_jsxs("div", { className: "flex flex-col items-center gap-4", children: [_jsx("div", { className: "bg-white p-3 rounded-lg", children: _jsx(QRCodeSVG, { value: otpauthUri, size: 180 }) }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-xs text-muted-foreground mb-1", children: t('auth.manualEntry') }), _jsx("code", { className: "text-xs bg-muted px-2 py-1 rounded select-all", children: secret })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "setup-code", children: t('auth.twoFactor') }), _jsx(Input, { id: "setup-code", type: "text", inputMode: "numeric", value: setupCode, onChange: (e) => setSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6)), placeholder: "000000", className: "text-center text-lg tracking-[0.3em] font-mono", maxLength: 6, required: true, autoFocus: true })] }), error && _jsx("p", { className: "text-sm text-destructive", children: error }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: handleClose, children: t('common.cancel') }), _jsx(Button, { type: "submit", disabled: setupLoading || setupCode.length !== 6, children: setupLoading ? t('common.loading') : t('auth.verify') })] })] }))] }) }));
}
