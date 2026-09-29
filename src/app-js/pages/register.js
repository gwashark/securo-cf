import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { useAuth } from '../contexts/auth-context.js';
import { admin as adminApi, auth as authApi } from '../lib/api.js';
import { resolveSupportedLang } from '../lib/i18n.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Card, CardContent, CardFooter } from '../components/ui/card.js';
import { CurrencySelect } from '../components/currency-select.js';
import { ShellLogo } from '../components/shell-logo.js';
import { setThemeBasedOnSystem } from '../lib/theme-utils.js';
import { isServerUnreachable } from '../lib/auth-errors.js';
export default function RegisterPage() {
    const { t, i18n } = useTranslation();
    const { register } = useAuth();
    const navigate = useNavigate();
    const { resolvedTheme } = useTheme();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [currency, setCurrency] = useState('USD');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [checking, setChecking] = useState(true);
    useEffect(() => {
        let active = true;
        Promise.all([
            adminApi.registrationStatus(),
            authApi.oidcConfig().catch(() => null),
        ]).then(([registration, authConfig]) => {
            if (!active)
                return;
            if (!registration.enabled || authConfig?.local_auth_enabled === false) {
                navigate('/login', { replace: true });
                return;
            }
            setChecking(false);
        }).catch(() => {
            if (active)
                setChecking(false);
        });
        adminApi.defaultColors().then(({ light, dark }) => {
            setThemeBasedOnSystem(light, dark, resolvedTheme);
        }).catch(() => { });
        return () => {
            active = false;
        };
    }, [navigate, resolvedTheme]);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) {
            setError(t('auth.passwordMismatch'));
            return;
        }
        if (password.length < 8) {
            setError(t('auth.passwordTooShort'));
            return;
        }
        setIsLoading(true);
        try {
            const lang = resolveSupportedLang(i18n.resolvedLanguage ?? i18n.language);
            await register(email, password, {
                currency_display: currency,
                language: lang,
            });
            navigate('/');
        }
        catch (err) {
            const axiosErr = err;
            if (isServerUnreachable(err)) {
                setError(t('auth.serverError'));
            }
            else if (axiosErr?.response?.status === 429) {
                setError(t('auth.tooManyAttempts'));
            }
            else {
                setError(t('auth.registrationError'));
            }
        }
        finally {
            setIsLoading(false);
        }
    };
    if (checking) {
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen", children: _jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-primary" }) }));
    }
    return (_jsx("div", { className: "flex flex-col items-center justify-center min-h-screen bg-background px-4", children: _jsx(Card, { className: "w-full max-w-[400px] shadow-sm", children: _jsxs("form", { onSubmit: handleSubmit, children: [_jsxs("div", { className: "flex flex-col items-center pt-8 pb-2 px-8", children: [_jsx("div", { className: "w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4", children: _jsx(ShellLogo, { size: 22, className: "text-primary" }) }), _jsx("h1", { className: "text-xl font-semibold tracking-tight", children: t('auth.register') }), _jsx("p", { className: "text-sm text-muted-foreground mt-1", children: t('auth.registerDescription') })] }), _jsxs(CardContent, { className: "space-y-4 px-8 pt-4", children: [error && (_jsx("div", { className: "p-3 text-sm text-destructive bg-destructive/10 rounded-lg", children: error })), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "email", className: "text-sm", children: t('auth.email') }), _jsx(Input, { id: "email", type: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: "you@example.com", required: true })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "password", className: "text-sm", children: t('auth.password') }), _jsx(Input, { id: "password", type: "password", value: password, onChange: (e) => setPassword(e.target.value), required: true, minLength: 8 })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "confirmPassword", className: "text-sm", children: t('auth.confirmPassword') }), _jsx(Input, { id: "confirmPassword", type: "password", value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value), required: true })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "currency", className: "text-sm", children: t('auth.currency') }), _jsx(CurrencySelect, { id: "currency", value: currency, onChange: setCurrency })] })] }), _jsxs(CardFooter, { className: "flex flex-col gap-4 px-8 pb-8 pt-2", children: [_jsx(Button, { type: "submit", className: "w-full", disabled: isLoading, children: isLoading ? t('common.loading') : t('auth.register') }), _jsxs("p", { className: "text-sm text-muted-foreground", children: [t('auth.hasAccount'), ' ', _jsx(Link, { to: "/login", className: "text-primary font-medium hover:underline", children: t('auth.login') })] })] })] }) }) }));
}
