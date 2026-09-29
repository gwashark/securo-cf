import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from './ui/button.js';
import { invoices as invoicesApi } from '../lib/api.js';
/**
 * The workspace's mark, as a file rather than an address.
 *
 * It used to be a text box for a URL, which asked the user to host their
 * own logo somewhere and made every rendered document fetch it from a
 * third party. On a self-hosted install that is a request leaving the
 * building for an image the user already owns.
 */
export function InvoiceLogoField({ logoId, onChanged, }) {
    // Keyed by the id so a replaced logo mounts a fresh preview rather
    // than an effect having to blank the previous one.
    return _jsx(LogoField, { logoId: logoId, onChanged: onChanged }, logoId ?? 'none');
}
function LogoField({ logoId, onChanged, }) {
    const { t } = useTranslation();
    const fileInput = useRef(null);
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!logoId)
            return;
        let created = null;
        let cancelled = false;
        void invoicesApi.logoUrl(logoId).then((url) => {
            if (cancelled) {
                URL.revokeObjectURL(url);
                return;
            }
            created = url;
            setPreview(url);
        });
        return () => {
            cancelled = true;
            if (created)
                URL.revokeObjectURL(created);
        };
    }, [logoId]);
    const uploadMutation = useMutation({
        mutationFn: (file) => invoicesApi.uploadLogo(file),
        onSuccess: () => {
            setError(null);
            onChanged();
        },
        onError: (err) => {
            const detail = err?.response?.data?.detail;
            setError(detail ?? t('invoices.settings.logoFailed'));
        },
    });
    const removeMutation = useMutation({
        mutationFn: () => invoicesApi.removeLogo(),
        onSuccess: () => {
            setError(null);
            onChanged();
        },
    });
    const busy = uploadMutation.isPending || removeMutation.isPending;
    return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "h-14 w-24 shrink-0 rounded-md border border-border bg-muted/40 flex items-center justify-center overflow-hidden", children: preview ? (_jsx("img", { src: preview, alt: t('invoices.settings.logo'), className: "max-h-full max-w-full object-contain", "data-testid": "invoice-logo-preview" })) : (_jsx(ImagePlus, { className: "h-5 w-5 text-muted-foreground" })) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { type: "button", size: "sm", variant: "outline", disabled: busy, onClick: () => fileInput.current?.click(), children: logoId ? t('invoices.settings.logoReplace') : t('invoices.settings.logoUpload') }), logoId && (_jsx(Button, { type: "button", size: "sm", variant: "ghost", disabled: busy, onClick: () => removeMutation.mutate(), "aria-label": t('invoices.settings.logoRemove'), children: _jsx(Trash2, { className: "h-4 w-4" }) }))] }), _jsx("input", { ref: fileInput, type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", className: "hidden", "data-testid": "invoice-logo-input", onChange: (event) => {
                            const file = event.target.files?.[0];
                            if (file)
                                uploadMutation.mutate(file);
                            event.target.value = '';
                        } })] }), error && _jsx("p", { className: "text-[11px] text-destructive", children: error })] }));
}
