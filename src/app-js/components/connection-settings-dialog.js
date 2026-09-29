import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { connections } from '../lib/api.js';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from './ui/dialog.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
export function ConnectionSettingsDialog({ open, onClose, connection, supportsAssetSync = false, }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [displayName, setDisplayName] = useState('');
    const [payeeSource, setPayeeSource] = useState('auto');
    const [importPending, setImportPending] = useState(true);
    const [syncAssets, setSyncAssets] = useState(true);
    const [formSource, setFormSource] = useState(null);
    if (!formSource || formSource.connection !== connection) {
        setFormSource({ connection });
        if (connection) {
            setDisplayName(connection.display_name ?? '');
            setPayeeSource(connection.settings?.payee_source ?? 'auto');
            setImportPending(connection.settings?.import_pending ?? true);
            setSyncAssets(connection.settings?.sync_assets ?? true);
        }
    }
    const mutation = useMutation({
        mutationFn: () => connections.updateSettings(connection.id, {
            display_name: displayName.trim() || null,
            payee_source: payeeSource,
            import_pending: importPending,
            // Only persist asset-sync for connectors that actually import holdings.
            ...(supportsAssetSync ? { sync_assets: syncAssets } : {}),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['connections'] });
            toast.success(t('accounts.updated'));
            onClose();
        },
        onError: () => toast.error(t('common.error')),
    });
    return (_jsx(Dialog, { open: open, onOpenChange: onClose, children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('connections.settings') }) }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "connection-display-name", children: t('connections.displayName') }), _jsx(Input, { id: "connection-display-name", value: displayName, onChange: (e) => setDisplayName(e.target.value), placeholder: connection?.institution_name ?? t('connections.displayNamePlaceholder'), maxLength: 255 }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: t('connections.displayNameHint') })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('connections.payeeSource') }), _jsxs("select", { className: "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary", value: payeeSource, onChange: (e) => setPayeeSource(e.target.value), children: [_jsx("option", { value: "auto", children: t('connections.payeeAuto') }), _jsx("option", { value: "merchant", children: t('connections.payeeMerchant') }), _jsx("option", { value: "payment_data", children: t('connections.payeePaymentData') }), _jsx("option", { value: "description", children: t('connections.payeeDescription') }), _jsx("option", { value: "none", children: t('connections.payeeNone') })] })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Label, { htmlFor: "import-pending", children: t('connections.importPending') }), _jsx("input", { id: "import-pending", type: "checkbox", checked: importPending, onChange: (e) => setImportPending(e.target.checked), className: "h-4 w-4 rounded border-border text-primary focus:ring-primary" })] }), supportsAssetSync && (_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsx(Label, { htmlFor: "sync-assets", children: t('connections.syncAssets') }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: t('connections.syncAssetsHint') })] }), _jsx("input", { id: "sync-assets", type: "checkbox", checked: syncAssets, onChange: (e) => setSyncAssets(e.target.checked), className: "mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary" })] }))] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: onClose, children: t('common.cancel') }), _jsx(Button, { onClick: () => mutation.mutate(), disabled: mutation.isPending, children: mutation.isPending ? t('common.loading') : t('common.save') })] })] }) }));
}
