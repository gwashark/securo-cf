import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import axios from 'axios';
import { connections } from '../lib/api.js';
import { invalidateFinancialQueries } from '../lib/invalidate-queries.js';
import { Button } from '../components/ui/button.js';
import { Building2, ExternalLink } from 'lucide-react';
export default function OAuthCallbackPage() {
    const { t } = useTranslation();
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const code = params.get('code');
    const state = params.get('state');
    const errorParam = params.get('error');
    const errorDescription = params.get('error_description');
    const [restricted, setRestricted] = useState(null);
    const [retrying, setRetrying] = useState(false);
    useEffect(() => {
        // Provider reported an error during the consent step.
        if (errorParam) {
            toast.error(t('accounts.oauthCallback.providerError', {
                message: errorDescription || errorParam,
            }));
            navigate('/accounts', { replace: true });
            return;
        }
        if (!code || !state) {
            toast.error(t('accounts.oauthCallback.missingState'));
            navigate('/accounts', { replace: true });
            return;
        }
        // The state token is single-use server-side, so React StrictMode's
        // double-mount in dev (or any accidental remount) would fire a second
        // POST that gets rejected. Guard via sessionStorage so only the first
        // mount actually submits — and don't cancel on unmount; we want the
        // side-effect to finish even if the user navigates away mid-sync.
        const submitKey = `oauth-submitted:${code}:${state}`;
        if (sessionStorage.getItem(submitKey))
            return;
        sessionStorage.setItem(submitKey, '1');
        (async () => {
            try {
                await connections.handleCallback(code, '', state);
                await queryClient.refetchQueries({ queryKey: ['connections'] });
                invalidateFinancialQueries(queryClient);
                toast.success(t('accounts.connected'));
                navigate('/accounts', { replace: true });
            }
            catch (err) {
                if (axios.isAxiosError(err) && err.response?.status === 409) {
                    const detail = err.response.data?.detail;
                    if (typeof detail === 'object' && detail?.code === 'no_accounts_linked') {
                        // Let the user retry: clear the guard so a fresh consent flow works.
                        sessionStorage.removeItem(submitKey);
                        setRestricted(detail);
                        return;
                    }
                }
                const message = axios.isAxiosError(err) && err.response?.data?.detail
                    ? String(err.response.data.detail)
                    : t('accounts.connectError');
                sessionStorage.removeItem(submitKey);
                toast.error(message);
                navigate('/accounts', { replace: true });
            }
        })();
    }, [code, state, errorParam, errorDescription, navigate, queryClient, t, retrying]);
    if (restricted) {
        return (_jsx("div", { className: "mx-auto max-w-md py-16 px-4", children: _jsxs("div", { className: "rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-900/20 p-6 space-y-4", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "rounded-lg bg-amber-100 dark:bg-amber-800/30 p-2 shrink-0", children: _jsx(Building2, { size: 18, className: "text-amber-700 dark:text-amber-300" }) }), _jsxs("div", { className: "space-y-1", children: [_jsx("h2", { className: "text-base font-semibold", children: t('accounts.oauthCallback.linkAccountsFirstTitle') }), _jsx("p", { className: "text-sm text-muted-foreground", children: t('accounts.oauthCallback.linkAccountsFirstDesc') })] })] }), _jsxs("div", { className: "flex flex-col gap-2", children: [restricted.help_url && (_jsx(Button, { asChild: true, variant: "outline", children: _jsxs("a", { href: restricted.help_url, target: "_blank", rel: "noreferrer", children: [t('accounts.oauthCallback.openPortal'), _jsx(ExternalLink, { size: 14, className: "ml-2" })] }) })), _jsx(Button, { onClick: () => {
                                    setRestricted(null);
                                    setRetrying((v) => !v);
                                }, children: t('accounts.oauthCallback.retry') }), _jsx(Button, { variant: "ghost", onClick: () => navigate('/accounts', { replace: true }), children: t('common.cancel') })] })] }) }));
    }
    return (_jsxs("div", { className: "flex flex-col items-center justify-center min-h-[60vh] gap-5 px-4 text-center", children: [_jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" }), _jsxs("div", { className: "space-y-1.5 max-w-md", children: [_jsx("p", { className: "text-base font-medium", children: t('accounts.oauthCallback.title') }), _jsx("p", { className: "text-sm text-muted-foreground", children: t('accounts.oauthCallback.linking') }), _jsx("p", { className: "text-xs text-muted-foreground", children: t('accounts.oauthCallback.dontClose') })] })] }));
}
