import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, Check, CheckCircle2, CircleSlash, Copy, Download, FileText, Link2, MinusCircle, MoreHorizontal, Pencil, Repeat, RotateCcw, Send, Share2, Trash2, Unlink, } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Skeleton } from '../components/ui/skeleton.js';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '../components/ui/dialog.js';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '../components/ui/dropdown-menu.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '../components/ui/select.js';
import { PageHeader } from '../components/page-header.js';
import { InvoiceSuggestions } from '../components/invoice-suggestions.js';
import { IconAction, SectionCard, SectionHeader, Segmented, StateBadge, } from '../components/invoice-ui.js';
import { InvoiceDocumentView } from '../components/invoice-document.js';
import { InvoiceDocumentBrowser } from '../components/invoice-documents.js';
import { InvoiceLineEditor } from '../components/invoice-line-editor.js';
import { InvoiceInstallmentsEditor } from '../components/invoice-installments-editor.js';
import { DEDUCTION_KINDS, displayDue, installmentsTotal } from '../lib/installment-utils.js';
import { EndConditionFields, SchedulePeriodChip } from '../components/invoice-schedule-ui.js';
import { FREQUENCIES, endPayload } from '../lib/invoice-schedule-utils.js';
import { cn } from '../lib/utils.js';
import { formatCurrency } from '../lib/format.js';
import { useDisplayLocale, useDateLocale } from '../hooks/use-display-locale.js';
import { usePrivacyMode } from '../hooks/use-privacy-mode.js';
import { useAuth } from '../contexts/auth-context.js';
import { useWorkspace } from '../contexts/workspace-context.js';
import { invoices as invoicesApi, payees as payeesApi, transactions as transactionsApi, } from '../lib/api.js';
import { allocationOrigin, availableActions, customFieldDefs, displayNumber, invoiceErrorKey, linesTotal, } from '../lib/invoice-utils.js';
export default function InvoiceDetailPage() {
    const { t } = useTranslation();
    const { id = '' } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const { mask } = usePrivacyMode();
    const { user } = useAuth();
    const { canWrite } = useWorkspace();
    const fallbackCurrency = user?.preferences?.currency_display ?? 'USD';
    const [linkOpen, setLinkOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [recurringOpen, setRecurringOpen] = useState(false);
    const [deductionOpen, setDeductionOpen] = useState(false);
    const [tab, setTab] = useState('details');
    const [copied, setCopied] = useState(false);
    const { data: invoice, isLoading } = useQuery({
        queryKey: ['invoice', id],
        queryFn: () => invoicesApi.get(id),
        enabled: Boolean(id),
    });
    const { data: settings } = useQuery({
        queryKey: ['invoice-settings'],
        queryFn: invoicesApi.settings,
    });
    // Only when the tab is open: it resolves the snapshot and builds the
    // whole page server-side, and the ledger view has no use for any of it.
    // Fetched here rather than only inside the Documents section: the
    // header has to know whether a real document exists before it offers
    // to download one. Same query key as the section, so this is one
    // request shared through the cache, not two.
    const { data: attachments = [] } = useQuery({
        queryKey: ['invoice-attachments', id],
        queryFn: () => invoicesApi.attachments.list(id),
        enabled: Boolean(id),
    });
    const hasFiledDocument = attachments.some((a) => a.is_primary);
    const { data: documentPayload } = useQuery({
        queryKey: ['invoice-document', id],
        queryFn: () => invoicesApi.document(id),
        enabled: Boolean(id) && tab === 'document',
    });
    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ['invoice', id] });
        void queryClient.invalidateQueries({ queryKey: ['invoice-document', id] });
        void queryClient.invalidateQueries({ queryKey: ['invoices'] });
        void queryClient.invalidateQueries({ queryKey: ['invoice-summary'] });
        void queryClient.invalidateQueries({ queryKey: ['invoice-facets'] });
        // An invoice of an agreement changes what the agreement reads:
        // issuing it moves "invoiced", a payment moves "received".
        void queryClient.invalidateQueries({ queryKey: ['invoice-schedule'] });
        void queryClient.invalidateQueries({ queryKey: ['invoice-schedule-invoices'] });
        void queryClient.invalidateQueries({ queryKey: ['invoice-schedules'] });
        void queryClient.invalidateQueries({ queryKey: ['invoice-schedule-summary'] });
    };
    const onError = (error) => {
        const key = invoiceErrorKey(error);
        toast.error(key ? t(key, t('invoices.errors.generic')) : t('invoices.errors.generic'));
    };
    const decision = (run, successKey) => ({
        mutationFn: run,
        onSuccess: () => {
            toast.success(t(successKey));
            refresh();
        },
        onError,
    });
    const issueMutation = useMutation(decision(() => invoicesApi.issue(id), 'invoices.issued'));
    const voidMutation = useMutation(decision(() => invoicesApi.void(id), 'invoices.voided'));
    const writeOffMutation = useMutation(decision(() => invoicesApi.writeOff(id), 'invoices.writtenOff'));
    const reopenMutation = useMutation(decision(() => invoicesApi.reopen(id), 'invoices.reopened'));
    const deleteMutation = useMutation({
        mutationFn: () => invoicesApi.remove(id),
        onSuccess: () => {
            toast.success(t('invoices.deleted'));
            refresh();
            navigate('/invoices');
        },
        onError,
    });
    const unlinkScheduleMutation = useMutation({
        mutationFn: () => invoicesApi.unlinkSchedule(id),
        onSuccess: () => {
            toast.success(t('invoices.schedules.unlinked'));
            refresh();
            void queryClient.invalidateQueries({ queryKey: ['invoice-schedules'] });
        },
        onError,
    });
    const undeductMutation = useMutation({
        mutationFn: (deductionId) => invoicesApi.undeduct(id, deductionId),
        onSuccess: () => {
            toast.success(t('invoices.deductions.removed'));
            refresh();
        },
        onError,
    });
    const unlinkMutation = useMutation({
        mutationFn: (allocationId) => invoicesApi.unallocate(id, allocationId),
        onSuccess: () => {
            toast.success(t('invoices.unlinked'));
            refresh();
        },
        onError,
    });
    // Fetched as a blob rather than opened as a link: the PDF route needs
    // the auth and workspace headers the axios interceptor adds, which a
    // plain anchor would not carry.
    const downloadMutation = useMutation({
        mutationFn: async () => {
            const blob = await invoicesApi.pdf(id);
            const url = URL.createObjectURL(blob);
            const anchor = window.document.createElement('a');
            anchor.href = url;
            anchor.download = `${invoice?.number ?? 'invoice'}.pdf`;
            anchor.click();
            URL.revokeObjectURL(url);
        },
        onError,
    });
    // The statement of account: what was paid and deducted since issue,
    // and how that arrives at the balance. The invoice PDF is the document
    // as issued and never shows it.
    const statementMutation = useMutation({
        mutationFn: async () => {
            const blob = await invoicesApi.statement(id);
            const url = URL.createObjectURL(blob);
            const anchor = window.document.createElement('a');
            anchor.href = url;
            anchor.download = `${invoice?.number ?? 'invoice'}-statement.pdf`;
            anchor.click();
            URL.revokeObjectURL(url);
        },
        onError,
    });
    const shareMutation = useMutation({
        mutationFn: () => invoicesApi.share(id),
        onSuccess: async (link) => {
            const url = `${window.location.origin}${link.path}`;
            try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
                toast.success(t('invoices.shareCopied'));
            }
            catch {
                // A blocked clipboard is not a failed share — the link exists.
                toast.success(url);
            }
            refresh();
        },
        onError,
    });
    const unshareMutation = useMutation({
        mutationFn: () => invoicesApi.unshare(id),
        onSuccess: () => {
            toast.success(t('invoices.shareRevoked'));
            refresh();
        },
        onError,
    });
    if (isLoading || !invoice) {
        return (_jsxs("div", { children: [_jsx(Skeleton, { className: "h-4 w-28 mb-6" }), _jsx(Skeleton, { className: "h-40 w-full rounded-xl" })] }));
    }
    const actions = availableActions(invoice);
    const currency = invoice.currency || fallbackCurrency;
    const money = (value) => mask(formatCurrency(Number(value ?? 0), currency, locale));
    const showDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(dateLocale);
    const number = displayNumber(invoice, settings?.number_prefix);
    const customFields = customFieldDefs(settings?.template)
        .map((def) => ({ ...def, value: invoice.custom_fields?.[def.key] }))
        .filter((field) => Boolean(field.value));
    const shareUrl = invoice.share_token
        ? `${window.location.origin}/i/${invoice.share_token}`
        : null;
    // "Repeat this": an issued receivable that is not already a period of
    // an agreement. A draft has nothing agreed yet, and a bill received is
    // the supplier's to repeat.
    const canRecur = invoice.direction === 'receivable' &&
        invoice.status !== 'draft' &&
        invoice.status !== 'void' &&
        !invoice.schedule_id;
    // Only for what we issued: a draft was sent to nobody, and a bill we
    // received is the supplier's to state.
    const canStatement = invoice.direction === 'receivable' &&
        invoice.status !== 'draft' &&
        invoice.origin !== 'imported';
    const hasDeductions = Number(invoice.amount_deducted) > 0;
    // Once money has moved, the invoice PDF (frozen at issue) no longer says
    // everything: what was paid and deducted since is on the statement, and
    // the page offers both instead of letting the first pass for the whole.
    const offerStatement = canStatement && (Number(invoice.amount_paid) > 0 || hasDeductions);
    return (_jsxs("div", { children: [_jsxs("button", { onClick: () => navigate('/invoices'), className: "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-3", children: [_jsx(ArrowLeft, { className: "h-3.5 w-3.5" }), t('invoices.backToList')] }), _jsx(PageHeader, { section: invoice.payee?.name ??
                    t(invoice.direction === 'payable' ? 'invoices.noSupplier' : 'invoices.noClient'), title: number ?? t('invoices.draftTitle'), action: canWrite ? (_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [actions.canEdit && (_jsxs(Button, { size: "sm", variant: "outline", onClick: () => setEditOpen(true), "data-testid": "invoice-edit", children: [_jsx(Pencil, { className: "h-4 w-4 mr-1.5" }), t('common.edit')] })), actions.canIssue && (_jsxs(Button, { size: "sm", onClick: () => issueMutation.mutate(), "data-testid": "invoice-issue", children: [_jsx(Send, { className: "h-4 w-4 mr-1.5" }), t('invoices.action.issue')] })), actions.canAllocate && (_jsxs(Button, { size: "sm", onClick: () => setLinkOpen(true), "data-testid": "invoice-link-payment", children: [_jsx(Link2, { className: "h-4 w-4 mr-1.5" }), t('invoices.action.markPaid')] })), invoice.status !== 'draft' && (_jsxs(_Fragment, { children: [offerStatement ? (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs(Button, { size: "sm", variant: "outline", "data-testid": "invoice-download-pdf", children: [_jsx(Download, { className: "h-4 w-4 mr-1.5" }), t('invoices.action.downloadPdf')] }) }), _jsxs(DropdownMenuContent, { align: "end", className: "w-[260px] p-1 bg-card border border-border rounded-xl shadow-md", children: [_jsxs(DropdownMenuItem, { onClick: () => downloadMutation.mutate(), disabled: downloadMutation.isPending, "data-testid": "invoice-download-issued", className: "flex-col items-start gap-0.5 text-sm", children: [_jsx("span", { children: t('invoices.statement.asIssued') }), _jsx("span", { className: "text-[11px] text-muted-foreground", children: t('invoices.statement.asIssuedHint') })] }), _jsxs(DropdownMenuItem, { onClick: () => statementMutation.mutate(), disabled: statementMutation.isPending, "data-testid": "invoice-download-statement", className: "flex-col items-start gap-0.5 text-sm", children: [_jsx("span", { children: t('invoices.statement.title') }), _jsx("span", { className: "text-[11px] text-muted-foreground", children: t('invoices.statement.hint') })] })] })] })) : (invoice.origin !== 'imported' || hasFiledDocument) && (_jsxs(Button, { size: "sm", variant: "outline", onClick: () => downloadMutation.mutate(), disabled: downloadMutation.isPending, "data-testid": "invoice-download-pdf", children: [_jsx(Download, { className: "h-4 w-4 mr-1.5" }), t('invoices.action.downloadPdf')] })), invoice.direction === 'receivable' && (_jsxs(Button, { size: "sm", variant: "outline", onClick: () => invoice.share_token ? unshareMutation.mutate() : shareMutation.mutate(), "data-testid": invoice.share_token ? 'invoice-unshare' : 'invoice-share', children: [copied ? (_jsx(Check, { className: "h-4 w-4 mr-1.5" })) : (_jsx(Share2, { className: "h-4 w-4 mr-1.5" })), invoice.share_token
                                            ? t('invoices.action.revokeLink')
                                            : t('invoices.action.share')] }))] })), (canRecur ||
                            invoice.schedule_id ||
                            actions.canWriteOff ||
                            actions.canReopen ||
                            actions.canVoid ||
                            actions.canDelete) && (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx("button", { type: "button", "aria-label": t('invoices.moreActions'), "data-testid": "invoice-more-actions", className: "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/80 bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", children: _jsx(MoreHorizontal, { className: "h-4 w-4" }) }) }), _jsxs(DropdownMenuContent, { align: "end", className: "w-[220px] p-1 bg-card border border-border rounded-xl shadow-md", children: [canRecur && (_jsxs(DropdownMenuItem, { onClick: () => setRecurringOpen(true), "data-testid": "invoice-make-recurring", className: "gap-2 text-sm", children: [_jsx(Repeat, { className: "h-4 w-4 text-muted-foreground" }), t('invoices.schedules.action.makeRecurring')] })), invoice.schedule_id && (_jsxs(DropdownMenuItem, { onClick: () => unlinkScheduleMutation.mutate(), "data-testid": "invoice-unlink-schedule", className: "gap-2 text-sm", children: [_jsx(Unlink, { className: "h-4 w-4 text-muted-foreground" }), t('invoices.schedules.action.unlink')] })), actions.canWriteOff && (_jsxs(DropdownMenuItem, { onClick: () => writeOffMutation.mutate(), "data-testid": "invoice-writeoff", className: "gap-2 text-sm", children: [_jsx(Ban, { className: "h-4 w-4 text-muted-foreground" }), t('invoices.action.writeOff')] })), actions.canReopen && (_jsxs(DropdownMenuItem, { onClick: () => reopenMutation.mutate(), "data-testid": "invoice-reopen", className: "gap-2 text-sm", children: [_jsx(RotateCcw, { className: "h-4 w-4 text-muted-foreground" }), t('invoices.action.reopen')] })), actions.canVoid && (_jsxs(DropdownMenuItem, { onClick: () => voidMutation.mutate(), "data-testid": "invoice-void", className: "gap-2 text-sm text-destructive focus:text-destructive", children: [_jsx(CircleSlash, { className: "h-4 w-4" }), t('invoices.action.void')] })), actions.canDelete && (_jsxs(DropdownMenuItem, { onClick: () => deleteMutation.mutate(), "data-testid": "invoice-delete", className: "gap-2 text-sm text-destructive focus:text-destructive", children: [_jsx(Trash2, { className: "h-4 w-4" }), t('common.delete')] }))] })] }))] })) : undefined }), _jsxs("div", { className: "flex flex-wrap items-center gap-x-4 gap-y-2 mb-5", children: [_jsx(Segmented, { value: tab, onChange: setTab, testIdPrefix: "invoice-tab", options: [
                            { value: 'details', label: t('invoices.tab.details') },
                            { value: 'document', label: t('invoices.tab.document') },
                        ] }), _jsx(StateBadge, { state: invoice.state }), invoice.days_overdue > 0 && (_jsx("span", { className: "text-xs font-medium text-rose-500", children: t('invoices.daysLate', { count: invoice.days_overdue }) })), _jsx(SchedulePeriodChip, { invoice: invoice })] }), tab === 'document' ? (_jsxs("div", { className: "space-y-4", children: [offerStatement && (_jsx(SectionCard, { children: _jsxs("div", { className: "flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3 text-sm", "data-testid": "invoice-statement-banner", children: [_jsx(FileText, { className: "h-4 w-4 text-muted-foreground shrink-0" }), _jsx("p", { className: "flex-1 min-w-[16rem] text-muted-foreground", children: t('invoices.statement.banner', {
                                        paid: money(invoice.amount_paid),
                                        deducted: money(invoice.amount_deducted),
                                    }) }), _jsxs(Button, { size: "sm", variant: "outline", onClick: () => statementMutation.mutate(), disabled: statementMutation.isPending, children: [_jsx(Download, { className: "h-4 w-4 mr-1.5" }), t('invoices.action.downloadStatement')] })] }) })), shareUrl && (_jsx(SectionCard, { children: _jsxs("div", { className: "flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3 text-xs", "data-testid": "invoice-share-banner", children: [_jsx(Share2, { className: "h-3.5 w-3.5 text-muted-foreground shrink-0" }), _jsx("span", { className: "text-muted-foreground", children: t('invoices.shareActive') }), _jsx("code", { className: "truncate font-mono text-[11px] text-foreground", children: shareUrl }), _jsx("div", { className: "ml-auto", children: _jsx(IconAction, { onClick: () => {
                                            void navigator.clipboard.writeText(shareUrl);
                                            toast.success(t('invoices.shareCopied'));
                                        }, label: t('invoices.shareCopy'), children: _jsx(Copy, { className: "h-3.5 w-3.5" }) }) })] }) })), documentPayload ? (_jsx(InvoiceDocumentBrowser, { invoiceId: invoice.id, origin: invoice.origin, canWrite: canWrite, ourPageLabel: number, ourPageDate: invoice.issue_date, ourPage: _jsx(InvoiceDocumentView, { document: documentPayload }), onChanged: refresh })) : (_jsx(Skeleton, { className: "h-[520px] w-full rounded-xl" }))] })) : (_jsxs("div", { className: "space-y-5", children: [_jsx(SectionCard, { children: _jsx("div", { className: cn('grid grid-cols-2 divide-x divide-border', hasDeductions ? 'sm:grid-cols-5' : 'sm:grid-cols-4'), children: [
                                { label: t('invoices.column.total'), value: money(invoice.total) },
                                {
                                    label: invoice.direction === 'payable'
                                        ? t('invoices.field.paidOut')
                                        : t('invoices.field.paid'),
                                    value: money(invoice.amount_paid),
                                },
                                ...(hasDeductions
                                    ? [{
                                            label: t('invoices.deductions.figure'),
                                            value: money(invoice.amount_deducted),
                                            testId: 'invoice-deducted',
                                        }]
                                    : []),
                                {
                                    label: t('invoices.column.balance'),
                                    value: money(invoice.balance),
                                    tone: Number(invoice.balance) > 0
                                        ? 'text-foreground'
                                        : 'text-emerald-600',
                                    testId: 'invoice-balance',
                                },
                                {
                                    label: invoice.installments.length ? t('invoices.installments.nextDue') : t('invoices.column.due'),
                                    value: showDate(displayDue(invoice)),
                                    testId: 'invoice-due-figure',
                                },
                            ].map((figure) => (_jsxs("div", { className: "px-4 sm:px-5 py-4", "data-testid": figure.testId, children: [_jsx("p", { className: "text-xs font-medium text-muted-foreground mb-0.5", children: figure.label }), _jsx("p", { className: cn('text-lg font-bold tabular-nums', figure.tone ?? 'text-foreground'), children: figure.value })] }, figure.label))) }) }), invoice.installments.length > 0 && (_jsxs(SectionCard, { children: [_jsx(SectionHeader, { title: t('invoices.installments.schedule'), description: t('invoices.installments.count', { count: invoice.installments.length }) }), _jsx("table", { className: "w-full", "data-testid": "invoice-installments", children: _jsx("tbody", { children: invoice.installments.map((row, index) => (_jsxs("tr", { className: "border-b border-border last:border-0", "data-testid": "invoice-installment-row", children: [_jsx("td", { className: "py-2.5 pl-4 sm:pl-5 text-sm", children: row.label ?? `${index + 1}/${invoice.installments.length}` }), _jsx("td", { className: "py-2.5 text-xs text-muted-foreground tabular-nums", children: showDate(row.due_date) }), _jsxs("td", { className: "py-2.5 text-right text-sm tabular-nums", children: [money(row.amount), Number(row.settled) > 0 && Number(row.settled) < Number(row.amount) && (_jsxs("span", { className: "ml-1.5 text-[11px] text-muted-foreground", children: [t('invoices.field.paid').toLowerCase(), " ", money(row.settled)] }))] }), _jsx("td", { className: "py-2.5 pr-4 sm:pr-5 text-right w-28", children: _jsx("span", { "data-testid": `installment-state-${row.state}`, className: cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap', row.state === 'paid' && 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20', row.state === 'overdue' && 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20', row.state === 'partial' && 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20', !['paid', 'overdue', 'partial'].includes(row.state) && 'bg-muted text-muted-foreground border-border'), children: t(`invoices.installments.state.${row.state}`) }) })] }, row.id))) }) })] })), (invoice.lines.length > 0 || invoice.notes || customFields.length > 0) && (_jsxs(SectionCard, { children: [_jsx(SectionHeader, { title: t('invoices.detailsTitle') }), _jsxs("div", { className: "px-4 sm:px-5 py-4 space-y-4", children: [invoice.competence_date && invoice.competence_date !== invoice.issue_date && (_jsx("p", { className: "text-xs text-muted-foreground", "data-testid": "invoice-competence", children: t('invoices.competenceDiverges', {
                                            competence: showDate(invoice.competence_date),
                                            issue: showDate(invoice.issue_date),
                                        }) })), customFields.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-x-8 gap-y-2", children: customFields.map((field) => (_jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium text-muted-foreground mb-0.5", children: field.label }), _jsx("p", { className: "text-sm", children: field.value })] }, field.key))) })), invoice.lines.length > 0 && (_jsx("table", { className: "w-full", children: _jsx("tbody", { children: invoice.lines.map((line) => (_jsxs("tr", { className: "border-b border-border last:border-0", children: [_jsx("td", { className: "py-2.5 text-sm text-foreground", children: line.description }), _jsxs("td", { className: "py-2.5 text-right text-xs text-muted-foreground tabular-nums", children: [Number(line.quantity), " \u00D7 ", money(line.unit_price)] }), _jsx("td", { className: "py-2.5 text-right text-sm font-medium tabular-nums w-32", children: money(line.total) })] }, line.id))) }) })), invoice.notes && (_jsx("p", { className: "text-sm text-muted-foreground", children: invoice.notes }))] })] })), _jsx(InvoiceSuggestions, { invoiceId: invoice.id, canWrite: canWrite }), _jsxs(SectionCard, { children: [_jsx(SectionHeader, { title: t('invoices.payments'), action: actions.canAllocate && canWrite ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Button, { size: "sm", variant: "ghost", onClick: () => setDeductionOpen(true), "data-testid": "invoice-record-deduction", children: [_jsx(MinusCircle, { className: "h-3.5 w-3.5 mr-1.5" }), t('invoices.deductions.action')] }), _jsxs(Button, { size: "sm", variant: "outline", onClick: () => setLinkOpen(true), children: [_jsx(Link2, { className: "h-3.5 w-3.5 mr-1.5" }), t('invoices.action.link')] })] })) : undefined }), invoice.deductions.length > 0 && (_jsx("table", { className: "w-full border-b border-border", "data-testid": "invoice-deductions", children: _jsx("tbody", { children: invoice.deductions.map((deduction) => (_jsxs("tr", { "data-testid": "invoice-deduction", className: "border-b border-border last:border-0 bg-muted/20", children: [_jsxs("td", { className: "py-3 pl-4 sm:pl-5", children: [_jsxs("div", { className: "text-sm font-medium text-foreground truncate", children: [t(`invoices.deductions.kind.${deduction.kind}`), deduction.tax_kind && (_jsx("span", { className: "ml-1.5 text-xs uppercase text-muted-foreground", children: deduction.tax_kind }))] }), _jsxs("div", { className: "text-xs text-muted-foreground truncate", children: [t('invoices.deductions.settledWithout'), deduction.note ? ` · ${deduction.note}` : ''] })] }), _jsx("td", { className: "py-3 text-right text-sm font-bold tabular-nums text-muted-foreground", children: money(deduction.amount) }), _jsx("td", { className: "py-3 pr-4 sm:pr-5 text-right w-16", children: canWrite && invoice.status === 'open' && (_jsx(IconAction, { onClick: () => undeductMutation.mutate(deduction.id), label: t('common.delete'), destructive: true, children: _jsx(Trash2, { className: "h-4 w-4" }) })) })] }, deduction.id))) }) })), invoice.allocations.length === 0 ? (_jsx("p", { className: "px-4 sm:px-5 py-8 text-center text-sm text-muted-foreground", "data-testid": "invoice-no-payments", children: t('invoices.noPayments') })) : (_jsx("table", { className: "w-full", children: _jsx("tbody", { children: invoice.allocations.map((allocation) => (_jsxs("tr", { "data-testid": "invoice-allocation", className: "border-b border-border last:border-0", children: [_jsxs("td", { className: "py-3 pl-4 sm:pl-5", children: [_jsx("div", { className: "text-sm font-medium text-foreground truncate", children: allocation.transaction?.description ?? t('invoices.linkedPayment') }), _jsxs("div", { className: "text-xs text-muted-foreground tabular-nums mt-0.5", children: [allocation.transaction?.date
                                                                ? showDate(allocation.transaction.date)
                                                                : '', ' · ', (() => {
                                                                const origin = allocationOrigin(allocation.method);
                                                                if (!origin.automatic)
                                                                    return t('invoices.linkedManually');
                                                                // The strategy id is shown as the title rather
                                                                // than the label: it is a machine name today
                                                                // and becomes a readable one when the policy
                                                                // is fetchable, without this line changing.
                                                                return (_jsx("span", { title: origin.strategyId ?? undefined, children: t('invoices.linkedAutomatically') }));
                                                            })()] })] }), _jsx("td", { className: "py-3 text-right text-sm font-bold tabular-nums text-emerald-600", children: money(allocation.amount) }), _jsx("td", { className: "py-3 pr-4 sm:pr-5 text-right w-16", children: canWrite && (_jsx(IconAction, { onClick: () => unlinkMutation.mutate(allocation.id), label: t('invoices.action.unlink'), destructive: true, children: _jsx(Unlink, { className: "h-4 w-4" }) })) })] }, allocation.id))) }) }))] })] })), _jsx(EditDraftDialog, { open: editOpen, onOpenChange: setEditOpen, invoice: invoice, showTax: (settings?.tax_fields ?? 'hidden') !== 'hidden', currency: currency, onSaved: refresh }), _jsx(MakeRecurringDialog, { open: recurringOpen, onOpenChange: setRecurringOpen, invoice: invoice, onCreated: (scheduleId) => {
                    refresh();
                    navigate(`/invoices/schedules/${scheduleId}`);
                } }, recurringOpen ? 'recurring-open' : 'recurring-closed'), _jsx(LinkPaymentDialog, { open: linkOpen, onOpenChange: setLinkOpen, invoiceId: id, direction: invoice.direction, balance: invoice.balance, 
                // With a schedule, a short payment is short of the installment
                // being paid, not of the whole invoice.
                settleTarget: (() => {
                    const next = invoice.installments.find((row) => Number(row.settled) < Number(row.amount));
                    return next ? (Number(next.amount) - Number(next.settled)).toFixed(2) : invoice.balance;
                })(), currency: currency, onLinked: refresh }), _jsx(RecordDeductionDialog, { open: deductionOpen, onOpenChange: setDeductionOpen, invoiceId: id, balance: invoice.balance, currency: currency, onRecorded: refresh }, deductionOpen ? 'deduction-open' : 'deduction-closed')] }));
}
/**
 * Closing part of the debt without money. The exception to the payment
 * flow, kept as its own small dialog: a reason, an amount defaulting to
 * whatever is left, and a note the accountant will thank you for.
 */
function RecordDeductionDialog({ open, onOpenChange, invoiceId, balance, currency, onRecorded, initialAmount, transactionId, }) {
    const { t } = useTranslation();
    const locale = useDisplayLocale();
    const [kind, setKind] = useState('withholding_tax');
    const [amount, setAmount] = useState(initialAmount ?? balance);
    const [taxKind, setTaxKind] = useState('');
    const [note, setNote] = useState('');
    const mutation = useMutation({
        mutationFn: () => invoicesApi.deduct(invoiceId, {
            kind,
            amount,
            tax_kind: kind === 'withholding_tax' ? taxKind || null : null,
            note: note || null,
            transaction_id: transactionId ?? null,
        }),
        onSuccess: () => {
            toast.success(t('invoices.deductions.recorded'));
            onOpenChange(false);
            onRecorded();
        },
        onError: (error) => {
            const key = invoiceErrorKey(error);
            toast.error(key ? t(key, t('invoices.errors.generic')) : t('invoices.errors.generic'));
        },
    });
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('invoices.deductions.title') }), _jsx(DialogDescription, { children: t('invoices.deductions.description') })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: t('invoices.deductions.kindLabel') }), _jsxs(Select, { value: kind, onValueChange: (v) => setKind(v), children: [_jsx(SelectTrigger, { "data-testid": "deduction-kind", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: DEDUCTION_KINDS.map((k) => (_jsx(SelectItem, { value: k, children: t(`invoices.deductions.kind.${k}`) }, k))) })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "deduction-amount", children: t('invoices.deductions.amount') }), _jsx(Input, { id: "deduction-amount", "data-testid": "deduction-amount", inputMode: "decimal", value: amount, onChange: (e) => setAmount(e.target.value) }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: t('invoices.deductions.amountHint', { balance: formatCurrency(Number(balance), currency, locale) }) })] }), kind === 'withholding_tax' && (_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "deduction-tax-kind", children: t('invoices.deductions.taxKind') }), _jsx(Input, { id: "deduction-tax-kind", "data-testid": "deduction-tax-kind", value: taxKind, onChange: (e) => setTaxKind(e.target.value), placeholder: t('invoices.deductions.taxKindPlaceholder'), maxLength: 30 })] }))] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "deduction-note", children: t('invoices.deductions.note') }), _jsx(Input, { id: "deduction-note", "data-testid": "deduction-note", value: note, onChange: (e) => setNote(e.target.value), maxLength: 500 })] })] }), _jsxs(DialogFooter, { className: "gap-2", children: [_jsx(Button, { variant: "ghost", onClick: () => onOpenChange(false), children: t('common.cancel') }), _jsx(Button, { onClick: () => mutation.mutate(), disabled: !(Number(amount) > 0) || mutation.isPending, "data-testid": "deduction-submit", children: t('invoices.deductions.action') })] })] }) }));
}
export function LinkPaymentDialog({ open, onOpenChange, invoiceId, direction, balance, settleTarget, currency, onLinked, }) {
    const { t } = useTranslation();
    const locale = useDisplayLocale();
    const [selected, setSelected] = useState('');
    const [amount, setAmount] = useState('');
    // When the payment is short of the balance: what the difference is,
    // or nothing. Answered once, here, instead of leaving the invoice
    // partial and sending the person to find another button.
    const [differenceKind, setDifferenceKind] = useState('none');
    // Money moving the way this invoice is settled: a receivable by money
    // coming in, a payable by money going out. Asking for credits either
    // way — which this did — means the payment that actually settled a
    // supplier's bill is never in the list, and the bill stays open
    // forever with no way to close it.
    const settlingType = direction === 'payable' ? 'debit' : 'credit';
    const { data } = useQuery({
        queryKey: ['transactions', 'for-invoice', settlingType],
        queryFn: () => transactionsApi.list({ type: settlingType, limit: 50 }),
        enabled: open,
    });
    // Same currency only — the server refuses a cross-currency allocation
    // rather than inventing a rate, so offering one here would only be
    // offering an error.
    //
    // And only money with something left to give: a payment already linked
    // to this invoice, or spent in full on others, was offered here too, and
    // picking it could only fail.
    const candidates = useMemo(() => (data?.items ?? []).filter((tx) => {
        if ((tx.currency ?? currency) !== currency)
            return false;
        const links = tx.invoice_links ?? [];
        if (links.some((link) => link.invoice_id === invoiceId))
            return false;
        const used = links.reduce((sum, link) => sum + Number(link.amount), 0);
        return Math.abs(Number(tx.amount)) - used > 0.005;
    }), [data, currency, invoiceId]);
    const selectedTx = candidates.find((tx) => tx.id === selected);
    const target = Number(settleTarget ?? balance);
    const applied = amount ? Number(amount) : Math.min(Number(balance), Math.abs(Number(selectedTx?.amount ?? 0)));
    const difference = selectedTx ? Math.round((target - applied) * 100) / 100 : 0;
    // Linking and deducting are two requests. Once the first has landed
    // the invoice is already different, so if the second fails the dialog
    // still closes and refreshes: left open, "try again" would link the
    // same payment a second time.
    const linked = useRef(false);
    const close = () => {
        onOpenChange(false);
        setSelected('');
        setAmount('');
        setDifferenceKind('none');
        onLinked();
    };
    const mutation = useMutation({
        mutationFn: async () => {
            linked.current = false;
            const after = await invoicesApi.allocate(invoiceId, selected, amount || undefined);
            linked.current = true;
            if (differenceKind !== 'none' && difference > 0) {
                await invoicesApi.deduct(invoiceId, {
                    kind: differenceKind,
                    amount: difference.toFixed(2),
                    transaction_id: selected,
                });
            }
            return after;
        },
        onSuccess: () => {
            toast.success(t('invoices.linked'));
            close();
        },
        onError: (error) => {
            const key = invoiceErrorKey(error);
            toast.error(key ? t(key, t('invoices.errors.generic')) : t('invoices.errors.generic'));
            if (linked.current) {
                toast.success(t('invoices.linked'));
                close();
            }
        },
    });
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "sm:max-w-lg", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('invoices.action.markPaid') }), _jsx(DialogDescription, { children: t('invoices.linkDescription') })] }), _jsxs("div", { className: "space-y-3 max-h-72 overflow-y-auto", children: [candidates.length === 0 && (_jsx("p", { className: "text-sm text-muted-foreground", children: t('invoices.noCandidates') })), candidates.map((tx) => (_jsxs("button", { onClick: () => setSelected(tx.id), "data-testid": "invoice-candidate", className: cn('w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors', selected === tx.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'), children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "text-sm truncate", children: tx.description }), _jsx("div", { className: "text-xs text-muted-foreground tabular-nums", children: tx.date })] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [_jsx("span", { className: "text-sm tabular-nums", children: formatCurrency(Number(tx.amount), tx.currency ?? currency, 'en') }), selected === tx.id && _jsx(CheckCircle2, { className: "h-4 w-4 text-primary" })] })] }, tx.id)))] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "allocation-amount", children: t('invoices.field.amountToApply') }), _jsx(Input, { id: "allocation-amount", "data-testid": "invoice-allocation-amount", inputMode: "decimal", value: amount, onChange: (e) => setAmount(e.target.value), placeholder: balance }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: t('invoices.field.amountHint') })] }), selectedTx && difference > 0 && (_jsxs("div", { className: "rounded-lg border border-border bg-muted/30 px-3 py-2.5 space-y-2", "data-testid": "invoice-difference", children: [_jsx("p", { className: "text-sm font-medium", children: t('invoices.deductions.differenceTitle', { difference: formatCurrency(difference, currency, locale) }) }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: t('invoices.deductions.differenceHint') }), _jsxs(Select, { value: differenceKind, onValueChange: (v) => setDifferenceKind(v), children: [_jsx(SelectTrigger, { "data-testid": "invoice-difference-kind", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "none", children: t('invoices.deductions.differenceNone') }), DEDUCTION_KINDS.map((k) => (_jsx(SelectItem, { value: k, children: t(`invoices.deductions.kind.${k}`) }, k)))] })] })] })), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => onOpenChange(false), children: t('common.cancel') }), _jsx(Button, { onClick: () => mutation.mutate(), disabled: !selected || mutation.isPending, "data-testid": "invoice-allocation-submit", children: t('invoices.action.link') })] })] }) }));
}
/**
 * Editing a draft.
 *
 * Only a draft: once issued, the financial substance is frozen and the
 * server refuses the change, because a document that changes after the
 * client received it is not an edit, it is a second document. The button
 * that opens this disappears at the same moment.
 *
 * Notes stay editable after issuance through the detail view, since they
 * are the seller's own record and never left the building.
 */
function EditDraftDialog({ open, onOpenChange, invoice, showTax, currency, onSaved, }) {
    const { t } = useTranslation();
    const { data: clients = [] } = useQuery({
        queryKey: ['payees', 'for-invoice'],
        queryFn: () => payeesApi.list({}),
        enabled: open,
    });
    // Seeded from the invoice each time the dialog opens, keyed so a
    // reopen after a save starts from what was saved.
    const [payeeId, setPayeeId] = useState(invoice.payee_id ?? '');
    const [total, setTotal] = useState(invoice.total);
    const [dueDate, setDueDate] = useState(invoice.due_date);
    const [notes, setNotes] = useState(invoice.notes ?? '');
    const [installments, setInstallments] = useState(() => invoice.installments.length
        ? invoice.installments.map((row) => ({ due_date: row.due_date, amount: row.amount, label: row.label }))
        : null);
    const [lines, setLines] = useState(() => invoice.lines.map((line) => ({
        description: line.description,
        quantity: String(Number(line.quantity)),
        unit_price: line.unit_price,
        tax_rate: line.tax_rate,
    })));
    const mutation = useMutation({
        mutationFn: () => invoicesApi.update(invoice.id, {
            payee_id: payeeId || null,
            due_date: dueDate,
            notes: notes || null,
            // Always sent: the server takes an omitted key as "leave the
            // schedule alone" and an empty list as "clear it".
            installments: installments ?? [],
            // Lines are the source of truth once they exist: the server
            // recomputes the total from them and ignores what was typed.
            //
            // An empty list is sent when the draft had lines and no longer
            // does, because omitting the key means "leave them alone" — so
            // deleting every row used to save successfully and change
            // nothing, and the rows came back on the next read.
            ...(lines.length
                ? { lines }
                : invoice.lines.length
                    ? { lines: [], total }
                    : { total }),
        }),
        onSuccess: () => {
            toast.success(t('invoices.updated'));
            onOpenChange(false);
            onSaved();
        },
        onError: (error) => {
            const key = invoiceErrorKey(error);
            toast.error(key ? t(key, t('invoices.errors.generic')) : t('invoices.errors.generic'));
        },
    });
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: cn('flex flex-col max-h-[calc(100dvh-2rem)]', lines.length ? 'sm:max-w-3xl' : 'sm:max-w-lg'), children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('invoices.editDraft') }), _jsx(DialogDescription, { children: t('invoices.editDraftDescription') })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: t('invoices.field.client') }), _jsxs(Select, { value: payeeId, onValueChange: setPayeeId, children: [_jsx(SelectTrigger, { "data-testid": "edit-client-select", children: _jsx(SelectValue, { placeholder: t('invoices.field.clientPlaceholder') }) }), _jsx(SelectContent, { children: clients.map((client) => (_jsx(SelectItem, { value: client.id, children: client.name }, client.id))) })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "edit-total", children: t('invoices.field.total') }), _jsx(Input, { id: "edit-total", "data-testid": "edit-total-input", inputMode: "decimal", value: lines.length ? linesTotal(lines).toFixed(2) : total, onChange: (e) => setTotal(e.target.value), disabled: lines.length > 0 })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "edit-due", children: t('invoices.field.dueDate') }), _jsx(Input, { id: "edit-due", "data-testid": "edit-due-input", type: "date", value: installments ? installments[installments.length - 1]?.due_date ?? '' : dueDate, onChange: (e) => setDueDate(e.target.value), disabled: installments !== null })] })] }), _jsx(InvoiceLineEditor, { lines: lines, onChange: setLines, currency: currency, showTax: showTax }), _jsx(InvoiceInstallmentsEditor, { value: installments, onChange: setInstallments, total: lines.length ? linesTotal(lines) : Number(total || 0), currency: currency, firstDueDate: dueDate, minDate: invoice.issue_date }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "edit-notes", children: t('invoices.field.notes') }), _jsx(Input, { id: "edit-notes", "data-testid": "edit-notes-input", value: notes, onChange: (e) => setNotes(e.target.value) })] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => onOpenChange(false), children: t('common.cancel') }), _jsx(Button, { onClick: () => mutation.mutate(), disabled: mutation.isPending || (installments !== null && Math.abs(installmentsTotal(installments) - (lines.length ? linesTotal(lines) : Number(total || 0))) >= 0.005), "data-testid": "edit-submit", children: t('common.save') })] })] }) }));
}
function MakeRecurringDialog({ open, onOpenChange, invoice, onCreated, }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const dateLocale = useDateLocale();
    const [name, setName] = useState(invoice.lines[0]?.description ?? invoice.payee?.name ?? '');
    const [frequency, setFrequency] = useState('monthly');
    // The invoice's own date by default. Earlier makes this invoice a
    // later period, so the ones billed by hand before it can be linked.
    const [startDate, setStartDate] = useState(invoice.issue_date);
    const [endType, setEndType] = useState('never');
    const [endDate, setEndDate] = useState('');
    const [endCount, setEndCount] = useState('');
    const mutation = useMutation({
        mutationFn: () => invoicesApi.makeRecurring(invoice.id, {
            frequency,
            name: name.trim() || undefined,
            start_date: startDate,
            ...endPayload(endType, endDate, endCount),
        }),
        onSuccess: (schedule) => {
            toast.success(t('invoices.schedules.created'));
            void queryClient.invalidateQueries({ queryKey: ['invoice-schedules'] });
            void queryClient.invalidateQueries({ queryKey: ['invoice-schedule-summary'] });
            onOpenChange(false);
            onCreated(schedule.id);
        },
        onError: (error) => {
            const key = invoiceErrorKey(error);
            toast.error(key ? t(key, t('invoices.errors.generic')) : t('invoices.errors.generic'));
        },
    });
    const ready = name.trim().length > 0 &&
        Boolean(startDate) &&
        (endType !== 'on_date' || Boolean(endDate)) &&
        (endType !== 'after_count' || Number(endCount) >= 1);
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "sm:max-w-lg", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('invoices.schedules.action.makeRecurring') }), _jsx(DialogDescription, { children: t('invoices.schedules.makeRecurringDescription', {
                                date: new Date(`${invoice.issue_date}T00:00:00`).toLocaleDateString(dateLocale),
                            }) })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "recurring-name", children: t('invoices.schedules.field.name') }), _jsx(Input, { id: "recurring-name", "data-testid": "recurring-name-input", value: name, onChange: (e) => setName(e.target.value), placeholder: t('invoices.schedules.field.namePlaceholder') })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: t('invoices.schedules.field.frequency') }), _jsxs(Select, { value: frequency, onValueChange: (v) => setFrequency(v), children: [_jsx(SelectTrigger, { "data-testid": "recurring-frequency-select", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: FREQUENCIES.map((value) => (_jsx(SelectItem, { value: value, children: t(`invoices.schedules.frequency.${value}`) }, value))) })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "recurring-start", children: t('invoices.schedules.field.startDate') }), _jsx(Input, { id: "recurring-start", "data-testid": "recurring-start-input", type: "date", max: invoice.issue_date, value: startDate, onChange: (e) => setStartDate(e.target.value) }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: t('invoices.schedules.field.startDateHint') })] })] }), _jsx(EndConditionFields, { idPrefix: "recurring", endType: endType, endDate: endDate, endCount: endCount, onChange: (next) => {
                                setEndType(next.endType);
                                setEndDate(next.endDate);
                                setEndCount(next.endCount);
                            } })] }), _jsxs(DialogFooter, { className: "gap-2", children: [_jsx(Button, { variant: "ghost", onClick: () => onOpenChange(false), children: t('common.cancel') }), _jsxs(Button, { onClick: () => mutation.mutate(), disabled: !ready || mutation.isPending, "data-testid": "recurring-submit", children: [_jsx(Repeat, { className: "h-4 w-4 mr-1.5" }), t('invoices.schedules.action.makeRecurring')] })] })] }) }));
}
