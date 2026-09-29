import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FileText, Image as ImageIcon, Plus, Star, Trash2 } from 'lucide-react';
import { Button } from './ui/button.js';
import { IconAction, SectionCard } from './invoice-ui.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from './ui/select.js';
import { invoices as invoicesApi } from '../lib/api.js';
import { documentProvenance, formatFileSize, ISSUED_BY_US, previewKind, } from '../lib/invoice-utils.js';
import { useDateLocale } from '../hooks/use-display-locale.js';
import { cn } from '../lib/utils.js';
/**
 * Everything that stands as this invoice's paperwork, in one place.
 *
 * An invoice is often a folder: the supplier's bill arrives by email, the
 * fiscal document follows from a portal, the receipt after that. Reading
 * any of them used to mean opening one browser tab per file, which is no
 * way to check whether the fiscal document matches the bill.
 *
 * So the files sit down the left and the selected one is rendered on the
 * right. The page we generate is an entry in that same list when we are
 * the ones who wrote the invoice: it is one of the documents, not a
 * different kind of thing living elsewhere on the screen.
 */
const KINDS = ['bill', 'fiscal', 'receipt', 'contract', 'other'];
/** The generated page is addressed by a reserved id, so selection stays a
 *  single string instead of a union the whole component has to narrow. */
const OUR_PAGE = 'our-page';
export function InvoiceDocumentBrowser({ invoiceId, origin, canWrite, ourPageLabel, ourPageDate, ourPage, onChanged, }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const dateLocale = useDateLocale();
    const fileInput = useRef(null);
    const [kind, setKind] = useState('bill');
    const [error, setError] = useState(null);
    const [selected, setSelected] = useState(null);
    const { data: attachments = [] } = useQuery({
        queryKey: ['invoice-attachments', invoiceId],
        queryFn: () => invoicesApi.attachments.list(invoiceId),
    });
    // Issuing files the page as it read at that moment, and that file is
    // the document from then on. Listing the live render beside it shows
    // one invoice twice under one name, and the live one is precisely the
    // copy that drifts as payments land, which is what filing was for.
    const filedAtIssue = attachments.some((a) => a.source === ISSUED_BY_US);
    // An import with nothing filed has no page at all: drawing ours would
    // invent a document a supplier issued and we were never handed.
    const showOurPage = origin !== 'imported' && ourPage !== null && !filedAtIssue;
    const active = useMemo(() => {
        if (selected === OUR_PAGE && showOurPage)
            return OUR_PAGE;
        if (selected && attachments.some((a) => a.id === selected))
            return selected;
        // Falls to the file that *is* the document, then to our own page,
        // then to whatever was filed first.
        const primary = attachments.find((a) => a.is_primary);
        if (primary)
            return primary.id;
        if (showOurPage)
            return OUR_PAGE;
        return attachments[0]?.id ?? null;
    }, [selected, attachments, showOurPage]);
    const refresh = () => {
        // Cleared on any success: a refused file leaves a message on screen,
        // and if it outlives the next working action it stops being true.
        setError(null);
        void queryClient.invalidateQueries({ queryKey: ['invoice-attachments', invoiceId] });
        void queryClient.invalidateQueries({ queryKey: ['invoice-document', invoiceId] });
        onChanged?.();
    };
    const uploadMutation = useMutation({
        mutationFn: (file) => invoicesApi.attachments.upload(invoiceId, file, { kind }),
        onSuccess: (created) => {
            // Show what was just added. Uploading and then hunting for the file
            // in the list is a step the person did not ask for.
            setSelected(created.id);
            refresh();
        },
        onError: (err) => {
            const detail = err?.response?.data?.detail;
            setError(detail ?? t('invoices.documents.uploadFailed'));
        },
    });
    const primaryMutation = useMutation({
        mutationFn: (id) => invoicesApi.attachments.update(invoiceId, id, { is_primary: true }),
        onSuccess: refresh,
    });
    const removeMutation = useMutation({
        mutationFn: (id) => invoicesApi.attachments.remove(invoiceId, id),
        onSuccess: (_data, id) => {
            if (selected === id)
                setSelected(null);
            refresh();
        },
    });
    const longDate = (value) => value.toLocaleDateString(dateLocale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
    /** When the file reached us, which is rarely the date on the document
     *  itself — an integration can deliver a fiscal document weeks late.
     *  A full timestamp, so it is read in the reader's own zone. */
    const showArrival = (value) => longDate(new Date(value));
    /** A date with no time. Parsed at local midnight rather than handed to
     *  `new Date`, which reads a bare `2026-08-28` as UTC and lands on the
     *  27th for anybody west of Greenwich. */
    const showPlainDate = (value) => longDate(new Date(`${value}T00:00:00`));
    const activeAttachment = active && active !== OUR_PAGE ? attachments.find((a) => a.id === active) : undefined;
    const anyPrimary = attachments.some((a) => a.is_primary);
    return (_jsx(SectionCard, { children: _jsxs("div", { className: "flex flex-col lg:flex-row", children: [_jsxs("div", { className: "lg:w-72 xl:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-border flex flex-col", children: [_jsx("div", { className: "px-3 py-3 border-b border-border flex items-center gap-2", children: canWrite ? (_jsxs(_Fragment, { children: [_jsxs(Select, { value: kind, onValueChange: (v) => setKind(v), children: [_jsx(SelectTrigger, { className: "h-8 flex-1 text-xs", "aria-label": t('invoices.documents.kindLabel'), children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: KINDS.map((k) => (_jsx(SelectItem, { value: k, className: "text-xs", children: t(`invoices.documents.kind.${k}`) }, k))) })] }), _jsxs(Button, { size: "sm", variant: "outline", className: "h-8 shrink-0", disabled: uploadMutation.isPending, onClick: () => fileInput.current?.click(), children: [_jsx(Plus, { className: "h-3.5 w-3.5 mr-1" }), t('invoices.documents.add')] }), _jsx("input", { ref: fileInput, type: "file", className: "hidden", "data-testid": "invoice-document-input", onChange: (event) => {
                                            const file = event.target.files?.[0];
                                            if (file)
                                                uploadMutation.mutate(file);
                                            event.target.value = '';
                                        } })] })) : (_jsx("p", { className: "text-xs font-medium text-muted-foreground py-1", children: t('invoices.documents.title') })) }), error && _jsx("p", { className: "px-3 pt-3 text-xs text-destructive", children: error }), _jsxs("ul", { className: "flex-1 p-2 space-y-0.5 lg:max-h-[880px] lg:overflow-y-auto", children: [showOurPage && (_jsx("li", { children: _jsx(ShelfItem, { active: active === OUR_PAGE, onSelect: () => setSelected(OUR_PAGE), icon: _jsx(FileText, { className: "h-4 w-4" }), title: ourPageLabel || t('invoices.documents.ourPage'), subtitle: t('invoices.documents.rendered', {
                                            date: ourPageDate ? showPlainDate(ourPageDate) : '',
                                        }), isPrimary: !anyPrimary }) })), attachments.map((attachment) => (_jsx("li", { children: _jsx(ShelfItem, { active: active === attachment.id, onSelect: () => setSelected(attachment.id), icon: previewKind(attachment.content_type) === 'image' ? (_jsx(ImageIcon, { className: "h-4 w-4" })) : (_jsx(FileText, { className: "h-4 w-4" })), title: attachment.filename, subtitle: [
                                            t(`invoices.documents.kind.${attachment.kind}`),
                                            formatFileSize(attachment.size),
                                            attachment.issued_at ? showPlainDate(attachment.issued_at) : null,
                                        ]
                                            .filter(Boolean)
                                            .join(' · '), reference: attachment.document_number, provenance: (() => {
                                            const from = documentProvenance(attachment.source);
                                            const arrived = showArrival(attachment.created_at);
                                            if (from.kind === 'ours') {
                                                // The same words the live render carried before it
                                                // was filed, so nothing about the row changes when
                                                // the drawing becomes a file.
                                                return t('invoices.documents.rendered', { date: arrived });
                                            }
                                            return from.kind === 'system'
                                                ? t('invoices.documents.fromSystem', { source: from.name, date: arrived })
                                                : t('invoices.documents.fromUpload', { date: arrived });
                                        })(), isPrimary: attachment.is_primary, actions: canWrite ? (_jsxs(_Fragment, { children: [!attachment.is_primary && (_jsx(IconAction, { onClick: () => primaryMutation.mutate(attachment.id), label: t('invoices.documents.makePrimary'), children: _jsx(Star, { className: "h-3.5 w-3.5" }) })), _jsx(IconAction, { onClick: () => removeMutation.mutate(attachment.id), label: t('invoices.documents.remove'), destructive: true, children: _jsx(Trash2, { className: "h-3.5 w-3.5" }) })] })) : undefined }) }, attachment.id))), !showOurPage && attachments.length === 0 && (_jsx("li", { className: "px-3 py-6 text-xs text-muted-foreground", "data-testid": "invoice-no-documents", children: t('invoices.documents.empty') }))] })] }), _jsx("div", { className: "flex-1 min-w-0 bg-muted/40 p-3 sm:p-6 overflow-x-auto", children: active === OUR_PAGE ? (ourPage) : activeAttachment ? (_jsx(AttachmentView, { invoiceId: invoiceId, attachment: activeAttachment }, activeAttachment.id)) : (_jsxs("div", { className: "py-20 text-center", "data-testid": "invoice-missing-source", children: [_jsx(FileText, { className: "h-6 w-6 mx-auto text-muted-foreground" }), _jsx("p", { className: "mt-3 text-sm font-medium text-foreground", children: t('invoices.documents.notOurs') }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground max-w-md mx-auto", children: t('invoices.documents.notOursHint') })] })) })] }) }));
}
function ShelfItem({ active, onSelect, icon, title, subtitle, reference, provenance, isPrimary, actions, }) {
    const { t } = useTranslation();
    return (_jsxs("div", { "data-testid": "invoice-document-row", className: cn('group flex items-start gap-2 rounded-lg px-2 py-2 transition-colors', active ? 'bg-primary/5 ring-1 ring-primary/20' : 'hover:bg-muted'), children: [_jsxs("button", { onClick: onSelect, className: "flex items-start gap-2 min-w-0 flex-1 text-left", children: [_jsx("span", { className: cn('mt-0.5 shrink-0', active ? 'text-primary' : 'text-muted-foreground'), children: icon }), _jsxs("span", { className: "min-w-0", children: [_jsx("span", { className: "block text-sm font-medium text-foreground truncate", children: title }), _jsx("span", { className: "block text-xs text-muted-foreground truncate mt-0.5", children: subtitle }), reference && (_jsx("span", { className: "block text-[11px] text-muted-foreground/80 truncate mt-0.5 tabular-nums", children: reference })), provenance && (_jsx("span", { className: "block text-[11px] text-muted-foreground/80 truncate mt-0.5", children: provenance }))] })] }), isPrimary && (_jsx("span", { className: "shrink-0 mt-0.5 text-primary", title: t('invoices.documents.primaryHint'), children: _jsx(Star, { className: "h-3.5 w-3.5 fill-current" }) })), actions && (_jsx("span", { className: "shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity", children: actions }))] }));
}
/** One filed file, rendered where it can be read rather than downloaded. */
function AttachmentView({ invoiceId, attachment, }) {
    const { t } = useTranslation();
    const [url, setUrl] = useState(null);
    useEffect(() => {
        let created = null;
        let cancelled = false;
        void invoicesApi.attachments.blobUrl(invoiceId, attachment.id).then((next) => {
            if (cancelled) {
                URL.revokeObjectURL(next);
                return;
            }
            created = next;
            setUrl(next);
        });
        return () => {
            cancelled = true;
            if (created)
                URL.revokeObjectURL(created);
        };
    }, [invoiceId, attachment.id]);
    const preview = previewKind(attachment.content_type);
    return (_jsxs("div", { className: "mx-auto max-w-[794px]", "data-testid": "invoice-source-document", children: [_jsx("div", { className: "rounded-sm bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08),0_12px_32px_-10px_rgba(0,0,0,0.22)] overflow-hidden", children: !url ? (_jsx("div", { className: "h-[560px]" })) : preview === 'pdf' ? (_jsx("iframe", { src: url, title: attachment.filename, className: "w-full h-[1123px] max-h-[78vh] border-0 block" })) : preview === 'image' ? (_jsx("img", { src: url, alt: attachment.filename, className: "w-full block" })) : (_jsx("div", { className: "p-10 text-center", children: _jsx("p", { className: "text-sm text-muted-foreground", children: t('invoices.documents.cannotPreview') }) })) }), url && (_jsx("div", { className: "mt-3 text-center", children: _jsxs(Button, { size: "sm", variant: "outline", onClick: () => window.open(url, '_blank', 'noopener'), children: [_jsx(FileText, { className: "h-3.5 w-3.5 mr-1.5" }), t('invoices.documents.openOriginal')] }) }))] }));
}
