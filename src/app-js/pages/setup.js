import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { setup, auth as authApi } from '../lib/api.js';
import { resolveSupportedLang, SUPPORTED_LANGS } from '../lib/i18n.js';
import { useAuth } from '../contexts/auth-context.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Card, CardContent, CardFooter } from '../components/ui/card.js';
import { CurrencySelect } from '../components/currency-select.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '../components/ui/select.js';
import { AuthBrandPanel } from '../components/auth-brand-panel.js';
import { cn } from '../lib/utils.js';
import { Sun, Moon, Globe } from 'lucide-react';
import { ShellLogo } from '../components/shell-logo.js';
export default function SetupPage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { loginWithToken, token } = useAuth();
    const { theme, setTheme } = useTheme();
    const currentLang = resolveSupportedLang(i18n.resolvedLanguage ?? i18n.language);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [currency, setCurrency] = useState('USD');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [checking, setChecking] = useState(true);
    useEffect(() => {
        if (token) {
            navigate('/', { replace: true });
            return;
        }
        Promise.all([
            setup.status(),
            authApi.oidcConfig().catch(() => null),
        ]).then(([{ has_users }, authConfig]) => {
            if (has_users || authConfig?.local_auth_enabled === false) {
                navigate('/login', { replace: true });
            }
            else {
                setChecking(false);
            }
        }).catch(() => {
            setChecking(false);
        });
    }, [navigate, token]);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) {
            setError(t('setup.passwordMismatch'));
            return;
        }
        setIsLoading(true);
        try {
            const { access_token } = await setup.createAdmin(email, password, currency, name, currentLang);
            localStorage.removeItem('onboarding_completed');
            loginWithToken(access_token);
            navigate('/');
        }
        catch {
            setError(t('setup.error'));
        }
        finally {
            setIsLoading(false);
        }
    };
    if (checking) {
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen", children: _jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-primary" }) }));
    }
    return (_jsxs("div", { className: "min-h-screen lg:grid lg:grid-cols-2", children: [_jsx(AuthBrandPanel, {}), _jsx("div", { className: "flex min-h-screen items-center justify-center bg-background px-4 py-10", children: _jsx(Card, { className: "w-full max-w-[400px] border-border/60 shadow-sm", children: _jsxs("form", { onSubmit: handleSubmit, children: [_jsxs("div", { className: "flex flex-col items-center pt-8 pb-2 px-8", children: [_jsx("div", { className: "w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 lg:hidden", children: _jsx(ShellLogo, { size: 22, className: "text-primary" }) }), _jsx("h1", { className: "text-xl font-semibold tracking-tight", children: t('setup.title') }), _jsx("p", { className: "text-sm text-muted-foreground mt-1", children: t('setup.description') })] }), _jsxs(CardContent, { className: "space-y-4 px-8 pt-4", children: [error && (_jsx("div", { className: "p-3 text-sm text-destructive bg-destructive/10 rounded-lg", children: error })), _jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsxs("div", { className: "space-y-1.5 min-w-0 flex-1", children: [_jsxs(Label, { className: "text-sm flex items-center gap-1.5", children: [_jsx(Globe, { size: 14 }), t('setup.language')] }), _jsxs(Select, { value: currentLang, onValueChange: (lng) => i18n.changeLanguage(lng), children: [_jsx(SelectTrigger, { className: "w-full", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: SUPPORTED_LANGS.map(({ code, label }) => (_jsx(SelectItem, { value: code, children: label }, code))) })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { className: "text-sm", children: t('setup.theme') }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { type: "button", onClick: () => setTheme('light'), title: t('settings.themeLight'), className: cn('p-1.5 rounded transition-colors', theme === 'light'
                                                                    ? 'bg-primary/15 text-primary'
                                                                    : 'text-muted-foreground hover:text-foreground'), children: _jsx(Sun, { size: 14 }) }), _jsx("button", { type: "button", onClick: () => setTheme('dark'), title: t('settings.themeDark'), className: cn('p-1.5 rounded transition-colors', theme === 'dark'
                                                                    ? 'bg-primary/15 text-primary'
                                                                    : 'text-muted-foreground hover:text-foreground'), children: _jsx(Moon, { size: 14 }) })] })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "name", className: "text-sm", children: t('setup.name') }), _jsx(Input, { id: "name", type: "text", value: name, onChange: (e) => setName(e.target.value), placeholder: t('setup.namePlaceholder') })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "email", className: "text-sm", children: t('auth.email') }), _jsx(Input, { id: "email", type: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: "you@example.com", required: true })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "password", className: "text-sm", children: t('auth.password') }), _jsx(Input, { id: "password", type: "password", value: password, onChange: (e) => setPassword(e.target.value), required: true, minLength: 8 })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "confirmPassword", className: "text-sm", children: t('setup.confirmPassword') }), _jsx(Input, { id: "confirmPassword", type: "password", value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value), required: true, minLength: 8 })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "currency", className: "text-sm", children: t('setup.currency') }), _jsx(CurrencySelect, { id: "currency", value: currency, onChange: setCurrency })] })] }), _jsx(CardFooter, { className: "px-8 pb-8 pt-2", children: _jsx(Button, { type: "submit", className: "w-full", disabled: isLoading, children: isLoading ? t('setup.creating') : t('setup.createAdmin') }) })] }) }) })] }));
}
