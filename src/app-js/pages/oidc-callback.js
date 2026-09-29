import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context.js';
import { Card, CardContent } from '../components/ui/card.js';
import { ShellLogo } from '../components/shell-logo.js';
export default function OIDCCallbackPage() {
    const navigate = useNavigate();
    const { loginWithToken } = useAuth();
    const accessToken = useMemo(() => {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        return params.get('access_token');
    }, []);
    useEffect(() => {
        if (!accessToken)
            return;
        loginWithToken(accessToken);
        window.history.replaceState(null, '', '/auth/oidc/callback');
        navigate('/', { replace: true });
    }, [accessToken, loginWithToken, navigate]);
    return (_jsx("div", { className: "flex flex-col items-center justify-center min-h-screen bg-background px-4", children: _jsx(Card, { className: "w-full max-w-[380px] shadow-sm", children: _jsxs(CardContent, { className: "flex flex-col items-center gap-4 px-8 py-8 text-center", children: [_jsx("div", { className: "w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center", children: _jsx(ShellLogo, { size: 22, className: "text-primary" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold tracking-tight", children: "Signing you in\u2026" }), _jsx("p", { className: "text-sm text-muted-foreground mt-1", children: accessToken ? 'Completing secure OIDC login.' : 'OIDC login did not return an access token.' })] })] }) }) }));
}
