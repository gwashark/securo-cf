import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/auth-context.js';
import { setup, auth as authApi, admin as adminApi } from '../lib/api.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Card, CardContent, CardFooter } from '../components/ui/card.js';
import { ShellLogo } from '../components/shell-logo.js';
import { isServerUnreachable } from '../lib/auth-errors.js';
import { resolveLocalAuthEnabled } from '../lib/auth-config-utils.js';
import { useTheme } from 'next-themes';
import { setThemeBasedOnSystem } from '../lib/theme-utils.js';
import { isConditionalPasskeySupported, isPasskeySupported, passkeyFailure, startConditionalPasskeyAuthentication, startPasskeyAuthentication, } from '../lib/webauthn.js';
const PASSKEY_LOGIN_FAILURE_KEYS = {
    cancelled: 'auth.passkeyCancelled',
    domain: 'auth.passkeyDomainError',
    mismatch: 'auth.passkeyDomainMismatch',
    ip: 'auth.passkeyIpAddress',
    insecure: 'auth.passkeyInsecureContext',
    unsupported: 'auth.passkeyUnsupported',
    duplicate: 'auth.passkeyLoginError',
    unknown: 'auth.passkeyLoginError',
};
export default function LoginPage() {
    const { t } = useTranslation();
    const { login, verify2fa, loginWithToken, token } = useAuth();
    const navigate = useNavigate();
    const { resolvedTheme } = useTheme();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
    const [passkeySupported] = useState(isPasskeySupported);
    const [registrationEnabled, setRegistrationEnabled] = useState(true);
    const [oidcConfig, setOidcConfig] = useState(null);
    const [oidcConfigFailed, setOidcConfigFailed] = useState(false);
    // 2FA state
    const [requires2fa, setRequires2fa] = useState(false);
    const [tempToken, setTempToken] = useState('');
    const [totpCode, setTotpCode] = useState('');
    const [available2faMethods, setAvailable2faMethods] = useState(['totp']);
    const [selected2faMethod, setSelected2faMethod] = useState('totp');
    const conditionalPasskeyAbortRef = useRef(null);
    const localAuthEnabled = resolveLocalAuthEnabled(oidcConfig, oidcConfigFailed);
    const oidcEnabled = oidcConfig?.enabled === true;
    const authConfigLoading = oidcConfig === null && !oidcConfigFailed;
    const noAuthMethodConfigured = oidcConfig !== null && !localAuthEnabled && !oidcEnabled;
    const showPasskeyLogin = localAuthEnabled && passkeySupported;
    const showAuthDivider = localAuthEnabled && (showPasskeyLogin || oidcEnabled);
    useEffect(() => {
        if (token) {
            navigate('/', { replace: true });
            return;
        }
        adminApi.registrationStatus().then(({ enabled }) => {
            setRegistrationEnabled(enabled);
        }).catch(() => { });
        authApi.oidcConfig()
            .then((config) => {
            setOidcConfig(config);
            setOidcConfigFailed(false);
        })
            .catch(() => setOidcConfigFailed(true));
        adminApi.defaultColors().then(({ light, dark }) => {
            setThemeBasedOnSystem(light, dark, resolvedTheme);
        }).catch(() => { });
    }, [navigate, token, resolvedTheme]);
    useEffect(() => {
        if (token || (oidcConfig === null && !oidcConfigFailed))
            return;
        let active = true;
        setup.status().then(({ has_users }) => {
            if (active &&
                !has_users &&
                resolveLocalAuthEnabled(oidcConfig, oidcConfigFailed)) {
                navigate('/setup', { replace: true });
            }
        }).catch(() => { });
        return () => {
            active = false;
        };
    }, [navigate, oidcConfig, oidcConfigFailed, token]);
    useEffect(() => {
        if (token ||
            requires2fa ||
            authConfigLoading ||
            !localAuthEnabled ||
            !passkeySupported ||
            isLoading ||
            isPasskeyLoading)
            return;
        const abortController = new AbortController();
        conditionalPasskeyAbortRef.current?.abort();
        conditionalPasskeyAbortRef.current = abortController;
        const authenticateConditionally = async () => {
            if (!await isConditionalPasskeySupported() || abortController.signal.aborted)
                return;
            try {
                // An account-less request lets the browser discover eligible passkeys
                // and offer them alongside saved usernames in the email field.
                const options = await authApi.passkeyAuthenticationOptions();
                if (abortController.signal.aborted)
                    return;
                const credential = await startConditionalPasskeyAuthentication(options.options, abortController.signal);
                // A challenge is one-shot server-side: verifying one the user already
                // walked away from burns it and answers a ceremony nobody is watching.
                if (abortController.signal.aborted)
                    return;
                const result = await authApi.verifyPasskeyAuthentication(options.challenge_id, credential);
                if (abortController.signal.aborted)
                    return;
                loginWithToken(result.access_token);
                navigate('/');
            }
            catch {
                // Conditional UI is an enhancement. Unsupported providers, dismissal,
                // expiry, and cancellation leave the normal login methods untouched.
            }
        };
        void authenticateConditionally();
        return () => {
            abortController.abort();
            if (conditionalPasskeyAbortRef.current === abortController) {
                conditionalPasskeyAbortRef.current = null;
            }
        };
    }, [
        authConfigLoading,
        isLoading,
        isPasskeyLoading,
        localAuthEnabled,
        loginWithToken,
        navigate,
        passkeySupported,
        requires2fa,
        token,
    ]);
    const handleSubmit = async (e) => {
        e.preventDefault();
        conditionalPasskeyAbortRef.current?.abort();
        setError('');
        setIsLoading(true);
        try {
            const result = await login(email, password);
            if (result.requires_2fa) {
                const methods = result.available_methods?.length ? result.available_methods : ['totp'];
                setRequires2fa(true);
                setTempToken(result.temp_token ?? '');
                setAvailable2faMethods(methods);
                setSelected2faMethod(methods.includes('passkey') ? 'passkey' : methods[0]);
            }
            else {
                navigate('/');
            }
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
                setError(t('auth.invalidCredentials'));
            }
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleOIDCLogin = () => {
        conditionalPasskeyAbortRef.current?.abort();
        window.location.href = '/api/auth/oidc/login';
    };
    const handlePasskeyLogin = async () => {
        conditionalPasskeyAbortRef.current?.abort();
        setError('');
        setIsPasskeyLoading(true);
        try {
            const trimmedEmail = email.trim();
            const options = await authApi.passkeyAuthenticationOptions(trimmedEmail || undefined);
            const credential = await startPasskeyAuthentication(options.options);
            const result = await authApi.verifyPasskeyAuthentication(options.challenge_id, credential);
            loginWithToken(result.access_token);
            navigate('/');
        }
        catch (err) {
            const axiosErr = err;
            if (axiosErr?.response?.status === 429) {
                setError(t('auth.tooManyAttempts'));
            }
            else {
                setError(t(PASSKEY_LOGIN_FAILURE_KEYS[passkeyFailure(err)]));
            }
        }
        finally {
            setIsPasskeyLoading(false);
        }
    };
    const handleVerify2fa = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await verify2fa(tempToken, totpCode);
            navigate('/');
        }
        catch (err) {
            const axiosErr = err;
            if (isServerUnreachable(err)) {
                setError(t('auth.serverError'));
            }
            else if (axiosErr?.response?.status === 401) {
                setError(t('auth.invalidCredentials'));
                // Token expired, go back to login
                resetSecondFactor();
            }
            else {
                setError(t('auth.invalid2faCode'));
            }
        }
        finally {
            setIsLoading(false);
        }
    };
    function resetSecondFactor() {
        setRequires2fa(false);
        setTempToken('');
        setTotpCode('');
        setAvailable2faMethods(['totp']);
        setSelected2faMethod('totp');
        setError('');
    }
    const handlePasskeySecondFactor = async () => {
        setError('');
        setIsPasskeyLoading(true);
        try {
            const options = await authApi.passkeySecondFactorOptions(tempToken);
            const credential = await startPasskeyAuthentication(options.options);
            const result = await authApi.verifyPasskeySecondFactor(tempToken, options.challenge_id, credential);
            loginWithToken(result.access_token);
            navigate('/');
        }
        catch (err) {
            const axiosErr = err;
            const domErr = err;
            if (domErr?.name === 'NotAllowedError') {
                setError(t('auth.passkeyCancelled'));
            }
            else if (axiosErr?.response?.status === 401) {
                setError(t('auth.invalidCredentials'));
                resetSecondFactor();
            }
            else if (axiosErr?.response?.status === 429) {
                setError(t('auth.tooManyAttempts'));
            }
            else {
                setError(t('auth.passkeyLoginError'));
            }
        }
        finally {
            setIsPasskeyLoading(false);
        }
    };
    if (requires2fa) {
        return (_jsx("div", { className: "flex flex-col items-center justify-center min-h-screen bg-background px-4", children: _jsx(Card, { className: "w-full max-w-[380px] shadow-sm", children: _jsxs("form", { onSubmit: handleVerify2fa, children: [_jsxs("div", { className: "flex flex-col items-center pt-8 pb-2 px-8", children: [_jsx("div", { className: "w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4", children: _jsx(ShellLogo, { size: 22, className: "text-primary" }) }), _jsx("h1", { className: "text-xl font-semibold tracking-tight", children: selected2faMethod === 'passkey' ? t('auth.passkeySecondFactorTitle') : t('auth.twoFactorTitle') }), _jsx("p", { className: "text-sm text-muted-foreground mt-1 text-center", children: selected2faMethod === 'passkey'
                                        ? t('auth.passkeySecondFactorDescription')
                                        : t('auth.twoFactorDescription') })] }), _jsxs(CardContent, { className: "space-y-4 px-8 pt-4", children: [error && (_jsx("div", { className: "p-3 text-sm text-destructive bg-destructive/10 rounded-lg", children: error })), available2faMethods.length > 1 && (_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [available2faMethods.includes('passkey') && (_jsx(Button, { type: "button", variant: selected2faMethod === 'passkey' ? 'default' : 'outline', onClick: () => setSelected2faMethod('passkey'), children: t('auth.passkeyMethod') })), available2faMethods.includes('totp') && (_jsx(Button, { type: "button", variant: selected2faMethod === 'totp' ? 'default' : 'outline', onClick: () => setSelected2faMethod('totp'), children: t('auth.totpMethod') }))] })), selected2faMethod === 'totp' && (_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "totp-code", className: "text-sm", children: t('auth.twoFactor') }), _jsx(Input, { id: "totp-code", type: "text", inputMode: "numeric", autoComplete: "one-time-code", value: totpCode, onChange: (e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6)), placeholder: "000000", className: "text-center text-lg tracking-[0.3em] font-mono", maxLength: 6, required: true, autoFocus: true })] })), selected2faMethod === 'passkey' && (_jsx("p", { className: "text-sm text-muted-foreground text-center", children: t('auth.passkeySecondFactorPrompt') }))] }), _jsxs(CardFooter, { className: "flex flex-col gap-4 px-8 pb-8 pt-2", children: [selected2faMethod === 'totp' ? (_jsx(Button, { type: "submit", className: "w-full", disabled: isLoading || totpCode.length !== 6, children: isLoading ? t('common.loading') : t('auth.verify') })) : (_jsx(Button, { type: "button", className: "w-full", onClick: handlePasskeySecondFactor, disabled: isLoading || isPasskeyLoading || !passkeySupported, children: isPasskeyLoading ? t('common.loading') : t('auth.usePasskeySecondFactor') })), _jsx("button", { type: "button", onClick: resetSecondFactor, className: "text-sm text-muted-foreground hover:text-foreground", children: t('auth.login') })] })] }) }) }));
    }
    return (_jsx("div", { className: "flex flex-col items-center justify-center min-h-screen bg-background px-4", children: _jsx(Card, { className: "w-full max-w-[380px] shadow-sm", children: _jsxs("form", { onSubmit: handleSubmit, children: [_jsxs("div", { className: "flex flex-col items-center pt-8 pb-2 px-8", children: [_jsx("div", { className: "w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4", children: _jsx(ShellLogo, { size: 22, className: "text-primary" }) }), _jsx("h1", { className: "text-xl font-semibold tracking-tight", children: t('auth.login') }), _jsx("p", { className: "text-sm text-muted-foreground mt-1", children: t('auth.loginDescription') })] }), authConfigLoading && (_jsx(CardContent, { className: "px-8 py-6 text-center text-sm text-muted-foreground", role: "status", children: t('common.loading') })), oidcConfigFailed && (_jsx(CardContent, { className: "px-8 py-4", children: _jsx("div", { role: "alert", className: "p-3 text-sm text-muted-foreground bg-muted rounded-lg", children: t('auth.authConfigUnavailable') }) })), noAuthMethodConfigured && (_jsx(CardContent, { className: "px-8 py-4", children: _jsx("div", { role: "alert", className: "p-3 text-sm text-destructive bg-destructive/10 rounded-lg", children: t('auth.noAuthMethodConfigured') }) })), localAuthEnabled && (_jsxs(CardContent, { className: "space-y-4 px-8 pt-4", children: [error && (_jsx("div", { id: "login-error", role: "alert", className: "p-3 text-sm text-destructive bg-destructive/10 rounded-lg", children: error })), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "email", className: "text-sm", children: t('auth.email') }), _jsx(Input, { id: "email", type: "email", value: email, onChange: (e) => {
                                            setEmail(e.target.value);
                                            setError('');
                                        }, placeholder: "you@example.com", autoComplete: "username webauthn", "aria-describedby": error ? 'login-error' : undefined, required: true })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "password", className: "text-sm", children: t('auth.password') }), _jsx(Input, { id: "password", type: "password", value: password, onChange: (e) => setPassword(e.target.value), autoComplete: "current-password", required: true })] })] })), !authConfigLoading && !noAuthMethodConfigured && (_jsxs(CardFooter, { className: `flex flex-col gap-4 px-8 pb-8 ${localAuthEnabled ? 'pt-2' : 'pt-6'}`, children: [localAuthEnabled && (_jsx(Button, { type: "submit", className: "w-full", disabled: isLoading || isPasskeyLoading, children: isLoading ? t('common.loading') : t('auth.login') })), showAuthDivider && (_jsxs("div", { className: "flex items-center gap-3 w-full", children: [_jsx("div", { className: "h-px flex-1 bg-border" }), _jsx("span", { className: "text-xs text-muted-foreground", children: t('auth.or') }), _jsx("div", { className: "h-px flex-1 bg-border" })] })), showPasskeyLogin && (_jsx(Button, { type: "button", variant: "outline", className: "w-full", onClick: handlePasskeyLogin, disabled: isLoading || isPasskeyLoading, children: isPasskeyLoading ? t('common.loading') : t('auth.loginWithPasskey') })), oidcEnabled && (_jsx(Button, { type: "button", variant: localAuthEnabled ? 'outline' : 'default', className: "w-full", onClick: handleOIDCLogin, children: t('auth.loginWithProvider', { provider: oidcConfig?.provider_name ?? 'OIDC' }) })), localAuthEnabled && registrationEnabled && (_jsxs("p", { className: "text-sm text-muted-foreground", children: [t('auth.noAccount'), ' ', _jsx(Link, { to: "/register", className: "text-primary font-medium hover:underline", children: t('auth.register') })] }))] }))] }) }) }));
}
