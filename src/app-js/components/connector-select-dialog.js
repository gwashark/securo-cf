import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { connections } from '../lib/api.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, } from './ui/dialog.js';
import { Building2 } from 'lucide-react';
export function ConnectorSelectDialog(props) {
    return props.open ? _jsx(ConnectorSelectSession, { ...props }) : null;
}
function ConnectorSelectSession({ open, onClose, onSelect }) {
    const { t } = useTranslation();
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let cancelled = false;
        connections.getProviders().then((data) => {
            if (cancelled)
                return;
            setProviders(data);
            setLoading(false);
        }).catch(() => {
            if (cancelled)
                return;
            setProviders([]);
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, []);
    return (_jsx(Dialog, { open: open, onOpenChange: (v) => !v && onClose(), children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('accounts.selectConnector') }), _jsx("p", { className: "text-sm text-muted-foreground", children: t('accounts.selectConnectorDesc') })] }), _jsx("div", { className: "space-y-2 pt-2", children: loading ? (_jsx("div", { className: "flex justify-center py-8", children: _jsx("div", { className: "h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" }) })) : providers.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground text-center py-8", children: t('accounts.noConnectorsAvailable') })) : (providers.map((p) => (_jsxs("button", { disabled: !p.configured, onClick: () => {
                            onSelect(p);
                            onClose();
                        }, className: `w-full flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${p.configured
                            ? 'border-border hover:border-primary hover:bg-muted/50 cursor-pointer'
                            : 'border-border/50 opacity-60 cursor-not-allowed'}`, children: [_jsx("div", { className: "w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5", children: _jsx(Building2, { size: 16, className: "text-muted-foreground" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-sm font-medium text-foreground", children: p.display_name }), _jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: t(`accounts.providers.${p.name}.description`, p.description) }), !p.configured && (_jsx("p", { className: "text-xs text-amber-600 mt-1.5", children: t('accounts.connectorNotConfigured') }))] })] }, p.name)))) })] }) }));
}
