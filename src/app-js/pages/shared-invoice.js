import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { Button } from '../components/ui/button.js';
import { InvoiceDocumentView } from '../components/invoice-document.js';
import { publicInvoices } from '../lib/api.js';
/**
 * An invoice someone was sent a link to.
 *
 * Outside the app shell entirely: no sidebar, no workspace, no session.
 * The recipient is a client, not a user, and the page shows them one
 * document and a way to save it. A bad or revoked token is a plain
 * not-found — the same answer a link that never existed gets, because
 * "this used to be here" is itself information.
 */
export default function SharedInvoicePage() {
    const { token = '' } = useParams();
    const { t } = useTranslation();
    const { data, isLoading, isError } = useQuery({
        queryKey: ['shared-invoice', token],
        queryFn: () => publicInvoices.get(token),
        enabled: Boolean(token),
        retry: false,
    });
    if (isLoading) {
        return (_jsx("div", { className: "min-h-screen grid place-items-center text-sm text-muted-foreground", children: t('common.loading') }));
    }
    if (isError || !data) {
        return (_jsx("div", { className: "min-h-screen grid place-items-center px-6", children: _jsxs("div", { className: "text-center space-y-2", children: [_jsx("h1", { className: "text-lg font-semibold", children: t('invoices.shared.notFoundTitle') }), _jsx("p", { className: "text-sm text-muted-foreground max-w-sm", children: t('invoices.shared.notFoundBody') })] }) }));
    }
    return (_jsx("div", { className: "min-h-screen bg-background py-8 px-4", children: _jsxs("div", { className: "mx-auto max-w-3xl space-y-3", children: [_jsx("div", { className: "flex justify-end", children: _jsx(Button, { asChild: true, size: "sm", variant: "outline", "data-testid": "shared-download", children: _jsxs("a", { href: publicInvoices.pdfUrl(token), target: "_blank", rel: "noopener noreferrer", children: [_jsx(Download, { className: "h-4 w-4 mr-1.5" }), t('invoices.action.downloadPdf')] }) }) }), _jsx(InvoiceDocumentView, { document: data })] }) }));
}
