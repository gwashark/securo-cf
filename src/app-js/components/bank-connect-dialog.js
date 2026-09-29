import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useEffectEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { PluggyConnect } from 'react-pluggy-connect';
import { connections } from '../lib/api.js';
import { invalidateFinancialQueries } from '../lib/invalidate-queries.js';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, } from './ui/dialog.js';
import { Button } from './ui/button.js';
import { Label } from './ui/label.js';
export function BankConnectDialog({ open, onClose, reconnectConnectionId, updateItemId, provider = 'pluggy', supportsAssetSync = false, }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [connectToken, setConnectToken] = useState(null);
    const [syncAssets, setSyncAssets] = useState(true);
    const [optionsConfirmed, setOptionsConfirmed] = useState(false);
    // Only prompt for asset-sync when the provider actually imports holdings.
    const needsInitialOptions = !reconnectConnectionId && supportsAssetSync;
    const onTokenError = useEffectEvent(() => {
        toast.error(t('accounts.connectError'));
        onClose();
    });
    useEffect(() => {
        if (!open) {
            setConnectToken(null);
            setSyncAssets(true);
            setOptionsConfirmed(false);
            return;
        }
        if (needsInitialOptions && !optionsConfirmed)
            return;
        let cancelled = false;
        const fetchToken = async () => {
            try {
                const token = reconnectConnectionId
                    ? await connections.getReconnectToken(reconnectConnectionId)
                    : await connections.getConnectToken(provider);
                if (!cancelled)
                    setConnectToken(token);
            }
            catch {
                if (!cancelled) {
                    onTokenError();
                }
            }
        };
        fetchToken();
        return () => { cancelled = true; };
    }, [open, reconnectConnectionId, provider, needsInitialOptions, optionsConfirmed]);
    const handleSuccess = async (data) => {
        try {
            if (reconnectConnectionId) {
                await connections.sync(reconnectConnectionId);
            }
            else {
                await connections.handleCallback(data.item.id, provider, undefined, supportsAssetSync ? { sync_assets: syncAssets } : undefined);
            }
            invalidateFinancialQueries(queryClient);
            queryClient.invalidateQueries({ queryKey: ['connections'] });
            toast.success(t('accounts.connected'));
        }
        catch {
            toast.error(t('accounts.connectError'));
        }
        finally {
            handleClose();
        }
    };
    const handleClose = () => {
        setConnectToken(null);
        onClose();
    };
    if (open && needsInitialOptions && !optionsConfirmed) {
        return (_jsx(Dialog, { open: open, onOpenChange: (v) => !v && handleClose(), children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('connections.initialSyncSettings') }), _jsx("p", { className: "text-sm text-muted-foreground", children: t('connections.initialSyncSettingsDesc') })] }), _jsxs("div", { className: "flex items-start justify-between gap-4 rounded-lg border border-border p-3", children: [_jsxs("div", { className: "space-y-1", children: [_jsx(Label, { htmlFor: "initial-sync-assets", children: t('connections.syncAssets') }), _jsx("p", { className: "text-xs text-muted-foreground", children: t('connections.syncAssetsHint') })] }), _jsx("input", { id: "initial-sync-assets", type: "checkbox", checked: syncAssets, onChange: (e) => setSyncAssets(e.target.checked), className: "mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary" })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: handleClose, children: t('common.cancel') }), _jsx(Button, { onClick: () => setOptionsConfirmed(true), children: t('connections.continueToConnector') })] })] }) }));
    }
    if (!open || !connectToken)
        return null;
    return (_jsx(PluggyConnect, { connectToken: connectToken, updateItem: updateItemId, onSuccess: handleSuccess, onClose: handleClose, onError: () => {
            toast.error(t('accounts.connectError'));
            handleClose();
        } }));
}
