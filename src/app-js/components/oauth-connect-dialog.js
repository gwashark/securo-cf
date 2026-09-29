import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { connections } from '../lib/api.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, } from './ui/dialog.js';
import { Button } from './ui/button.js';
import { Building2, ChevronLeft, Globe } from 'lucide-react';
import { toast } from 'sonner';
const LAST_COUNTRY_KEY = 'securo:lastOAuthCountry';
const REGION_NAMES = (() => {
    try {
        return new Intl.DisplayNames(navigator.language || 'en', { type: 'region' });
    }
    catch {
        return null;
    }
})();
function countryLabel(code) {
    if (!REGION_NAMES)
        return code;
    return REGION_NAMES.of(code) || code;
}
export function OAuthConnectDialog(props) {
    return props.open ? _jsx(OAuthConnectSession, { ...props }, props.provider) : null;
}
function OAuthConnectSession({ open, onClose, provider, supportsAssetSync = false }) {
    const { t } = useTranslation();
    const [step, setStep] = useState('country');
    const [country, setCountry] = useState(null);
    const [countries, setCountries] = useState([]);
    const [institutions, setInstitutions] = useState([]);
    const [loadingCountries, setLoadingCountries] = useState(true);
    const [loadingBanks, setLoadingBanks] = useState(false);
    const loading = loadingCountries || loadingBanks;
    const [error, setError] = useState(false);
    const [redirecting, setRedirecting] = useState(false);
    const [syncAssets, setSyncAssets] = useState(true);
    useEffect(() => {
        let cancelled = false;
        connections
            .listInstitutions(provider)
            .then((data) => {
            if (cancelled)
                return;
            setCountries(data.countries);
            const stored = localStorage.getItem(LAST_COUNTRY_KEY);
            if (stored && data.countries.includes(stored)) {
                setLoadingBanks(true);
                setCountry(stored);
                setStep('bank');
            }
        })
            .catch(() => { if (!cancelled)
            setError(true); })
            .finally(() => { if (!cancelled)
            setLoadingCountries(false); });
        return () => { cancelled = true; };
    }, [provider]);
    useEffect(() => {
        if (!country || step !== 'bank')
            return;
        let cancelled = false;
        connections
            .listInstitutions(provider, country)
            .then((data) => { if (!cancelled)
            setInstitutions(data.institutions); })
            .catch(() => { if (!cancelled)
            setError(true); })
            .finally(() => { if (!cancelled)
            setLoadingBanks(false); });
        return () => { cancelled = true; };
    }, [provider, country, step]);
    const sortedCountries = useMemo(() => [...countries].sort((a, b) => countryLabel(a).localeCompare(countryLabel(b))), [countries]);
    const handleCountrySelect = (code) => {
        setLoadingBanks(true);
        setError(false);
        setCountry(code);
        localStorage.setItem(LAST_COUNTRY_KEY, code);
        setStep('bank');
    };
    const handleBack = () => {
        setStep('country');
        setLoadingBanks(false);
        setError(false);
    };
    const handleBankSelect = async (institution) => {
        if (!country)
            return;
        setRedirecting(true);
        try {
            const url = await connections.getOAuthUrl(provider, {
                country,
                institution_name: institution.name,
                valid_until_days: institution.max_consent_days,
                ...(supportsAssetSync ? { sync_assets: syncAssets } : {}),
            });
            window.location.assign(url);
        }
        catch (e) {
            setRedirecting(false);
            const message = e instanceof Error ? e.message : String(e);
            toast.error(message || t('accounts.connectError'));
        }
    };
    return (_jsx(Dialog, { open: open, onOpenChange: (v) => !v && !redirecting && onClose(), children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsxs(DialogHeader, { children: [_jsxs(DialogTitle, { className: "flex items-center gap-2", children: [step === 'bank' && (_jsx("button", { onClick: handleBack, className: "text-muted-foreground hover:text-foreground", "aria-label": t('accounts.back'), children: _jsx(ChevronLeft, { size: 18 }) })), step === 'country' ? t('accounts.selectCountry') : t('accounts.selectBank')] }), _jsx("p", { className: "text-sm text-muted-foreground", children: step === 'country'
                                ? t('accounts.selectCountryDesc')
                                : t('accounts.selectBankDesc') })] }), !redirecting && supportsAssetSync && (_jsxs("div", { className: "flex items-start justify-between gap-4 rounded-lg border border-border p-3", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { htmlFor: "oauth-sync-assets", className: "text-sm font-medium text-foreground", children: t('connections.syncAssets') }), _jsx("p", { className: "text-xs text-muted-foreground", children: t('connections.syncAssetsHint') })] }), _jsx("input", { id: "oauth-sync-assets", type: "checkbox", checked: syncAssets, onChange: (e) => setSyncAssets(e.target.checked), className: "mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary" })] })), redirecting ? (_jsxs("div", { className: "py-12 flex flex-col items-center gap-3", children: [_jsx("div", { className: "h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" }), _jsx("p", { className: "text-sm text-muted-foreground", children: t('accounts.redirecting') })] })) : loading ? (_jsx("div", { className: "flex justify-center py-8", children: _jsx("div", { className: "h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" }) })) : error ? (_jsx("div", { className: "py-8 text-center text-sm text-destructive", children: t('accounts.loadingInstitutionsError') })) : step === 'country' ? (_jsx("div", { className: "space-y-1 pt-2 max-h-[60vh] overflow-y-auto", children: sortedCountries.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground text-center py-8", children: t('accounts.noInstitutionsFound') })) : (sortedCountries.map((code) => (_jsxs("button", { onClick: () => handleCountrySelect(code), className: "w-full flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary hover:bg-muted/50", children: [_jsx("div", { className: "w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0", children: _jsx(Globe, { size: 14, className: "text-muted-foreground" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-sm font-medium text-foreground", children: countryLabel(code) }), _jsx("p", { className: "text-xs text-muted-foreground", children: code })] })] }, code)))) })) : (_jsxs("div", { className: "space-y-1 pt-2 max-h-[60vh] overflow-y-auto", children: [institutions.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground text-center py-8", children: t('accounts.noInstitutionsFound') })) : (institutions.map((inst) => (_jsxs("button", { onClick: () => handleBankSelect(inst), className: "w-full flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary hover:bg-muted/50", children: [_jsx("div", { className: "w-8 h-8 rounded-md bg-muted overflow-hidden flex items-center justify-center shrink-0", children: inst.logo ? (_jsx("img", { src: inst.logo, alt: "", className: "w-full h-full object-contain", onError: (e) => {
                                            e.target.style.display = 'none';
                                        } })) : (_jsx(Building2, { size: 14, className: "text-muted-foreground" })) }), _jsx("div", { className: "min-w-0 flex-1", children: _jsx("p", { className: "text-sm font-medium text-foreground truncate", children: inst.display_name }) })] }, `${inst.country}-${inst.name}`)))), _jsx("div", { className: "pt-2", children: _jsxs(Button, { variant: "ghost", size: "sm", onClick: handleBack, children: [_jsx(ChevronLeft, { size: 14, className: "mr-1" }), t('accounts.back')] }) })] }))] }) }));
}
