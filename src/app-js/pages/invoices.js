import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar as CalendarIcon, ChevronDown, Package, Plus, Receipt, Repeat, Settings2, } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Skeleton } from '../components/ui/skeleton.js';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '../components/ui/dialog.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '../components/ui/select.js';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '../components/ui/dropdown-menu.js';
import { PageHeader } from '../components/page-header.js';
import { SectionCard, Segmented, StateBadge, TH } from '../components/invoice-ui.js';
import { InvoiceLineEditor } from '../components/invoice-line-editor.js';
import { InvoiceInstallmentsEditor } from '../components/invoice-installments-editor.js';
import { displayDue, installmentsTotal } from '../lib/installment-utils.js';
import { localToday } from '../lib/invoice-schedule-utils.js';
import { InvoiceLogoField } from '../components/invoice-logo-field.js';
import { CurrencySelect } from '../components/currency-select.js';
import { cn } from '../lib/utils.js';
import { formatCurrency } from '../lib/format.js';
import { useDisplayLocale, useDateLocale } from '../hooks/use-display-locale.js';
import { usePrivacyMode } from '../hooks/use-privacy-mode.js';
import { useAuth } from '../contexts/auth-context.js';
import { useWorkspace } from '../contexts/workspace-context.js';
import { fiscal as fiscalApi, invoices as invoicesApi, payees as payeesApi } from '../lib/api.js';
import { customFieldDefs, displayNumber, invoiceErrorKey, linesTotal, } from '../lib/invoice-utils.js';
/** The three derived states where money is still expected. `open` in the
 *  filter bar means all of them, which is why it is not a server query. */
const OUTSTANDING = ['open', 'partial', 'overdue'];
/** Aging buckets, oldest last. The tone runs from quiet to loud with the
 *  age, so the bar reads as a temperature without needing its legend. */
const BUCKETS = [
    { key: 'current', tone: 'bg-emerald-500/70' },
    { key: 'd1_30', tone: 'bg-amber-400/80' },
    { key: 'd31_60', tone: 'bg-orange-500/80' },
    { key: 'd61_90', tone: 'bg-rose-500/80' },
    { key: 'd90_plus', tone: 'bg-rose-700/80' },
];
export default function InvoicesPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const { mask } = usePrivacyMode();
    const { user } = useAuth();
    const { canWrite } = useWorkspace();
    const currency = user?.preferences?.currency_display ?? 'USD';
    // `null` is "every year". The default is the current one, which is
    // what someone opening the page is almost always asking about.
    // Which ledger is on screen. A bigger axis than the state filter — the
    // totals above the list change with it — so it sits above the summary
    // rather than among the filters.
    const [direction, setDirection] = useState('receivable');
    const [year, setYear] = useState(() => new Date().getFullYear());
    const [filter, setFilter] = useState('all');
    const [createOpen, setCreateOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const { data: settings } = useQuery({
        queryKey: ['invoice-settings'],
        queryFn: invoicesApi.settings,
    });
    const { data: summary, isLoading: summaryLoading } = useQuery({
        queryKey: ['invoice-summary', direction],
        queryFn: () => invoicesApi.summary(direction),
    });
    const { data: facets } = useQuery({
        queryKey: ['invoice-facets', year, direction],
        queryFn: () => invoicesApi.facets(year ?? undefined, direction),
    });
    const { data: list, isLoading } = useQuery({
        queryKey: ['invoices', filter, year, direction],
        queryFn: () => invoicesApi.list({
            direction,
            // `open` spans three derived states, so it is filtered here
            // rather than asked for three times.
            ...(filter === 'all' || filter === 'open' ? {} : { state: filter }),
            ...(year ? { year } : {}),
        }),
    });
    const visible = useMemo(() => {
        if (!list)
            return [];
        return filter === 'open' ? list.filter((i) => OUTSTANDING.includes(i.state)) : list;
    }, [list, filter]);
    const money = (value, code) => mask(formatCurrency(Number(value ?? 0), code ?? currency, locale));
    const showDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(dateLocale);
    const outstanding = Number(summary?.outstanding ?? 0);
    const overdue = Number(summary?.overdue_amount ?? 0);
    const bucketTotal = BUCKETS.reduce((sum, b) => sum + Number(summary?.buckets[b.key] ?? 0), 0);
    return (_jsxs("div", { children: [_jsx(PageHeader, { section: t('invoices.section'), title: t('invoices.title'), action: _jsxs("div", { className: "flex items-center gap-2", children: [direction === 'receivable' && (_jsxs(_Fragment, { children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: () => navigate('/invoices/products'), "data-testid": "invoice-products-button", children: [_jsx(Package, { className: "h-4 w-4 mr-1.5" }), t('invoices.products.title')] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: () => navigate('/invoices/schedules'), "data-testid": "invoice-schedules-button", children: [_jsx(Repeat, { className: "h-4 w-4 mr-1.5" }), t('invoices.schedules.title')] })] })), _jsxs(Button, { variant: "outline", size: "sm", onClick: () => setSettingsOpen(true), "data-testid": "invoice-settings-button", children: [_jsx(Settings2, { className: "h-4 w-4 mr-1.5" }), t('invoices.settings.title')] }), canWrite && (_jsxs(Button, { size: "sm", onClick: () => setCreateOpen(true), "data-testid": "invoice-new-button", children: [_jsx(Plus, { className: "h-4 w-4 mr-1.5" }), direction === 'payable' ? t('invoices.newPayable') : t('invoices.new')] }))] }) }), _jsx("div", { className: "mb-4", children: _jsx(Segmented, { value: direction, onChange: setDirection, testIdPrefix: "invoice-direction", options: [
                        { value: 'receivable', label: t('invoices.direction.receivable') },
                        { value: 'payable', label: t('invoices.direction.payable') },
                    ] }) }), _jsx("div", { className: "bg-card rounded-xl border border-border shadow-sm mb-5", children: _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3", children: [_jsxs("div", { className: "lg:col-span-2 px-5 py-4", children: [_jsx("p", { className: "text-xs font-medium text-muted-foreground mb-0.5", children: direction === 'payable'
                                        ? t('invoices.summary.owed')
                                        : t('invoices.summary.outstanding') }), summaryLoading ? (_jsx(Skeleton, { className: "h-10 w-40" })) : (_jsx("p", { className: "text-4xl font-bold tabular-nums leading-tight text-foreground", children: money(outstanding) })), _jsxs("div", { className: "flex flex-wrap gap-6 mt-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium text-muted-foreground mb-0.5", children: t('invoices.summary.overdue') }), _jsxs("p", { className: cn('text-sm font-bold tabular-nums', overdue > 0 ? 'text-rose-500' : 'text-muted-foreground'), "data-testid": "summary-overdue", children: [money(overdue), summary && summary.overdue_count > 0 && (_jsx("span", { className: "ml-1.5 font-medium text-muted-foreground", children: t('invoices.summary.overdueCount', { count: summary.overdue_count }) }))] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium text-muted-foreground mb-0.5", children: direction === 'payable'
                                                        ? t('invoices.summary.paidThisMonth')
                                                        : t('invoices.summary.receivedThisMonth') }), _jsx("p", { className: "text-sm font-bold tabular-nums text-emerald-600", "data-testid": "summary-received", children: money(summary?.received_this_month) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium text-muted-foreground mb-0.5", children: t('invoices.summary.upcoming') }), _jsx("p", { className: "text-sm font-bold tabular-nums text-foreground", "data-testid": "summary-upcoming", children: summary?.upcoming.length ?? 0 })] })] })] }), _jsxs("div", { className: "px-5 py-4 border-t border-border lg:border-t-0 lg:border-l", children: [_jsx("p", { className: "text-xs font-medium text-muted-foreground mb-2", children: t('invoices.summary.aging') }), bucketTotal > 0 ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "flex h-2 w-full overflow-hidden rounded-full bg-muted", "data-testid": "aging-bar", children: BUCKETS.map((bucket) => {
                                                const amount = Number(summary?.buckets[bucket.key] ?? 0);
                                                if (amount <= 0)
                                                    return null;
                                                return (_jsx("div", { className: bucket.tone, style: { width: `${(amount / bucketTotal) * 100}%` }, title: t(`invoices.bucket.${bucket.key}`) }, bucket.key));
                                            }) }), _jsx("dl", { className: "mt-3 space-y-1", children: BUCKETS.map((bucket) => {
                                                const amount = Number(summary?.buckets[bucket.key] ?? 0);
                                                if (amount <= 0)
                                                    return null;
                                                return (_jsxs("div", { className: "flex items-center gap-2 text-xs", children: [_jsx("span", { className: cn('h-2 w-2 rounded-full shrink-0', bucket.tone) }), _jsx("dt", { className: "text-muted-foreground", children: t(`invoices.bucket.${bucket.key}`) }), _jsx("dd", { className: "ml-auto tabular-nums font-medium", children: money(amount) })] }, bucket.key));
                                            }) })] })) : (_jsx("p", { className: "text-xs text-muted-foreground", children: t('invoices.summary.nothingDue') }))] })] }) }), _jsxs("div", { className: "mb-4 flex flex-wrap items-center justify-between gap-3", children: [_jsx(Segmented, { value: filter, onChange: setFilter, testIdPrefix: "invoice-filter", options: ['all', 'open', 'overdue', 'paid', 'draft'].map((value) => ({
                            value,
                            label: t(`invoices.filter.${value}`),
                            count: facets?.counts[value],
                        })) }), _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs("button", { type: "button", "data-testid": "invoice-year-trigger", className: "inline-flex items-center justify-center gap-2 border border-border rounded-lg px-3 py-1.5 text-sm bg-card text-foreground hover:bg-muted/50 transition-all cursor-pointer min-w-[180px]", children: [_jsx(CalendarIcon, { className: "size-3.5 text-muted-foreground" }), year ? t('invoices.fiscalYear', { year }) : t('invoices.allYears'), _jsx(ChevronDown, { className: "size-3.5 text-muted-foreground ml-auto" })] }) }), _jsxs(DropdownMenuContent, { align: "end", className: "w-[180px] p-1 bg-card border border-border rounded-xl shadow-md", children: [_jsx(DropdownMenuItem, { onClick: () => setYear(null), "data-testid": "invoice-year-all", className: "text-sm", children: t('invoices.allYears') }), (facets?.years ?? []).map((option) => (_jsx(DropdownMenuItem, { onClick: () => setYear(option), "data-testid": `invoice-year-${option}`, className: "text-sm tabular-nums", children: t('invoices.fiscalYear', { year: option }) }, option)))] })] })] }), _jsx(SectionCard, { children: isLoading ? (_jsx("div", { className: "p-5 space-y-3", children: [0, 1, 2].map((i) => (_jsx(Skeleton, { className: "h-9 w-full" }, i))) })) : visible.length === 0 ? (_jsxs("div", { className: "px-5 py-14 text-center", "data-testid": "invoices-empty", children: [_jsx(Receipt, { className: "h-8 w-8 mx-auto text-muted-foreground/50" }), _jsx("p", { className: "mt-3 text-sm text-muted-foreground max-w-sm mx-auto", children: filter !== 'all'
                                ? t('invoices.emptyFiltered')
                                : year
                                    ? t('invoices.emptyYear', { year: t('invoices.fiscalYear', { year }) })
                                    : t('invoices.empty') }), filter === 'all' && year && facets && facets.years.length > 0 ? (_jsx(Button, { size: "sm", variant: "outline", className: "mt-4", onClick: () => setYear(null), children: t('invoices.showAllYears') })) : (filter === 'all' &&
                            canWrite && (_jsxs(Button, { size: "sm", className: "mt-4", onClick: () => setCreateOpen(true), children: [_jsx(Plus, { className: "h-4 w-4 mr-1.5" }), t('invoices.new')] })))] })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-border", children: [_jsx("th", { className: `${TH} pl-4 sm:pl-5 text-left`, children: direction === 'payable'
                                                ? t('invoices.column.supplier')
                                                : t('invoices.column.client') }), _jsx("th", { className: `${TH} text-left w-24 hidden sm:table-cell`, children: t('invoices.column.number') }), _jsx("th", { className: `${TH} text-left w-32 hidden md:table-cell`, children: t('invoices.column.due') }), _jsx("th", { className: `${TH} text-right w-32`, children: t('invoices.column.total') }), _jsx("th", { className: `${TH} text-right w-32 hidden sm:table-cell`, children: t('invoices.column.balance') }), _jsx("th", { className: `${TH} pr-4 sm:pr-5 text-right w-28`, children: t('invoices.column.state') })] }) }), _jsx("tbody", { children: visible.map((invoice) => (_jsxs("tr", { onClick: () => navigate(`/invoices/${invoice.id}`), "data-testid": "invoice-row", className: "border-b border-border last:border-0 hover:bg-muted transition-colors cursor-pointer", children: [_jsxs("td", { className: "py-3 pl-4 sm:pl-5", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-sm font-medium text-foreground truncate", children: [invoice.schedule_id && (_jsx(Repeat, { className: "h-3.5 w-3.5 shrink-0 text-muted-foreground", "aria-label": t('invoices.schedules.recurringInvoice'), "data-testid": "invoice-row-recurring" })), invoice.payee?.name ?? (_jsx("span", { className: "text-muted-foreground", children: direction === 'payable'
                                                                ? t('invoices.noSupplier')
                                                                : t('invoices.noClient') }))] }), _jsxs("div", { className: "sm:hidden text-xs text-muted-foreground tabular-nums mt-0.5", children: [displayNumber(invoice, settings?.number_prefix) ?? t('invoices.noNumber'), ' · ', showDate(invoice.due_date)] })] }), _jsx("td", { className: "py-3 text-xs text-muted-foreground tabular-nums hidden sm:table-cell", children: displayNumber(invoice, settings?.number_prefix) ?? (_jsx("span", { className: "text-muted-foreground/60", children: t('invoices.noNumber') })) }), _jsxs("td", { className: "py-3 hidden md:table-cell", children: [_jsx("span", { className: "text-xs text-muted-foreground tabular-nums", children: showDate(displayDue(invoice)) }), invoice.installments.length > 0 && (_jsx("span", { className: "ml-1.5 text-[11px] text-muted-foreground/70", "data-testid": "invoice-row-installments", children: t('invoices.installments.count', { count: invoice.installments.length }) })), invoice.days_overdue > 0 && (_jsx("span", { className: "ml-1.5 text-[11px] font-medium text-rose-500", children: t('invoices.daysLate', { count: invoice.days_overdue }) }))] }), _jsx("td", { className: "py-3 text-right text-xs sm:text-sm tabular-nums text-muted-foreground", children: money(invoice.total, invoice.currency) }), _jsx("td", { className: "py-3 text-right text-xs sm:text-sm font-bold tabular-nums hidden sm:table-cell", children: Number(invoice.balance) > 0 ? (money(invoice.balance, invoice.currency)) : (_jsx("span", { className: "text-muted-foreground font-medium", children: "\u2014" })) }), _jsx("td", { className: "py-3 pr-4 sm:pr-5 text-right", children: _jsx(StateBadge, { state: invoice.state }) })] }, invoice.id))) })] }) })) }), _jsx(CreateInvoiceDialog, { open: createOpen, onOpenChange: setCreateOpen, direction: direction, onCreated: (invoice) => navigate(`/invoices/${invoice.id}`) }), _jsx(InvoiceSettingsDialog, { open: settingsOpen, onOpenChange: setSettingsOpen }, settingsOpen ? 'open' : 'closed')] }));
}
function CreateInvoiceDialog({ open, onOpenChange, direction, onCreated, }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data: settings } = useQuery({
        queryKey: ['invoice-settings'],
        queryFn: invoicesApi.settings,
        enabled: open,
    });
    const { data: clients = [] } = useQuery({
        queryKey: ['payees', 'for-invoice'],
        queryFn: () => payeesApi.list({}),
        enabled: open,
    });
    const [payeeId, setPayeeId] = useState('');
    const [total, setTotal] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [notes, setNotes] = useState('');
    const [custom, setCustom] = useState({});
    const [lines, setLines] = useState([]);
    // Null is the ordinary invoice: one due date. A list is a schedule.
    const [installments, setInstallments] = useState(null);
    const grossTotal = lines.length ? linesTotal(lines) : Number(total || 0);
    const scheduleOff = installments !== null && Math.abs(installmentsTotal(installments) - grossTotal) >= 0.005;
    const defs = customFieldDefs(settings?.template);
    const { user } = useAuth();
    // An invoice is denominated in one currency, and it is not necessarily
    // the one this user reads the app in — a freelancer in São Paulo bills
    // a client in New York in USD and is paid into a BRL account. The
    // display preference is only the starting guess.
    const [currencyCode, setCurrencyCode] = useState(user?.preferences?.currency_display ?? 'USD');
    const mutation = useMutation({
        mutationFn: (asDraft) => invoicesApi.create({
            direction,
            as_draft: asDraft,
            payee_id: payeeId || null,
            // Lines are the source of truth once they exist: the server
            // recomputes the total from them and ignores what was typed.
            ...(lines.length ? { lines } : { total }),
            ...(dueDate ? { due_date: dueDate } : {}),
            ...(installments ? { installments } : {}),
            currency: currencyCode,
            notes: notes || null,
            ...(Object.keys(custom).length ? { custom_fields: custom } : {}),
        }),
        onSuccess: (invoice) => {
            toast.success(invoice.status === 'draft' ? t('invoices.draftSaved') : t('invoices.created'));
            // The dialog owns the mutation, so it owns the invalidation: the
            // parent navigates away and would otherwise leave a stale list
            // behind for whenever the user comes back to it.
            void queryClient.invalidateQueries({ queryKey: ['invoices'] });
            void queryClient.invalidateQueries({ queryKey: ['invoice-summary'] });
            void queryClient.invalidateQueries({ queryKey: ['invoice-facets'] });
            onOpenChange(false);
            setPayeeId('');
            setTotal('');
            setDueDate('');
            setNotes('');
            setCurrencyCode(user?.preferences?.currency_display ?? 'USD');
            setCustom({});
            setLines([]);
            setInstallments(null);
            onCreated(invoice);
        },
        onError: (error) => {
            const key = invoiceErrorKey(error);
            toast.error(key ? t(key, t('invoices.errors.generic')) : t('invoices.errors.generic'));
        },
    });
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: cn('flex flex-col max-h-[calc(100dvh-2rem)]', lines.length || settings?.document_required ? 'sm:max-w-3xl' : 'sm:max-w-lg'), children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: direction === 'payable' ? t('invoices.newPayable') : t('invoices.new') }), _jsx(DialogDescription, { children: direction === 'payable'
                                ? t('invoices.newPayableDescription')
                                : t('invoices.newDescription') })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: direction === 'payable'
                                        ? t('invoices.field.supplier')
                                        : t('invoices.field.client') }), _jsxs(Select, { value: payeeId, onValueChange: setPayeeId, children: [_jsx(SelectTrigger, { "data-testid": "invoice-client-select", children: _jsx(SelectValue, { placeholder: t(direction === 'payable'
                                                    ? 'invoices.field.supplierPlaceholder'
                                                    : 'invoices.field.clientPlaceholder') }) }), _jsx(SelectContent, { children: clients.map((client) => (_jsx(SelectItem, { value: client.id, children: client.name }, client.id))) })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "invoice-total", children: t('invoices.field.total') }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { id: "invoice-total", "data-testid": "invoice-total-input", inputMode: "decimal", value: lines.length ? linesTotal(lines).toFixed(2) : total, onChange: (e) => setTotal(e.target.value), 
                                                    // Derived once lines exist, so the two can never disagree.
                                                    disabled: lines.length > 0, placeholder: "0.00" }), _jsx(CurrencySelect, { id: "invoice-currency", value: currencyCode, onChange: setCurrencyCode, className: "w-28 shrink-0" })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "invoice-due", children: t('invoices.field.dueDate') }), _jsx(Input, { id: "invoice-due", "data-testid": "invoice-due-input", type: "date", value: installments ? installments[installments.length - 1]?.due_date ?? '' : dueDate, onChange: (e) => setDueDate(e.target.value), 
                                            // With a schedule, the due date is the last installment's.
                                            disabled: installments !== null }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: installments
                                                ? t('invoices.installments.dueDerived')
                                                : t(direction === 'payable'
                                                    ? 'invoices.field.dueDateHintPayable'
                                                    : 'invoices.field.dueDateHint', { days: settings?.default_payment_terms_days ?? 30 }) })] })] }), defs.map((def) => (_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: `custom-${def.key}`, children: def.label }), _jsx(Input, { id: `custom-${def.key}`, "data-testid": `invoice-custom-${def.key}`, value: custom[def.key] ?? '', onChange: (e) => setCustom({ ...custom, [def.key]: e.target.value }) })] }, def.key))), _jsx(InvoiceLineEditor, { lines: lines, onChange: setLines, currency: currencyCode, showTax: (settings?.tax_fields ?? 'hidden') !== 'hidden', 
                            // Under the document preset the server requires line items,
                            // so the editor opens with an empty row rather than letting
                            // the user discover the rule from a rejected submit.
                            required: settings?.document_required ?? false }), _jsx(InvoiceInstallmentsEditor, { value: installments, onChange: setInstallments, total: grossTotal, currency: currencyCode, firstDueDate: dueDate || localToday() }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "invoice-notes", children: t('invoices.field.notes') }), _jsx(Input, { id: "invoice-notes", "data-testid": "invoice-notes-input", value: notes, onChange: (e) => setNotes(e.target.value) })] })] }), _jsxs(DialogFooter, { className: "sm:justify-between gap-2", children: [_jsx(Button, { variant: "ghost", onClick: () => onOpenChange(false), children: t('common.cancel') }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "outline", onClick: () => mutation.mutate(true), disabled: mutation.isPending, "data-testid": "invoice-save-draft", children: t('invoices.action.saveDraft') }), _jsx(Button, { onClick: () => mutation.mutate(false), disabled: (lines.length ? linesTotal(lines) <= 0 : !total) || scheduleOff || mutation.isPending, "data-testid": "invoice-create-submit", children: t('common.create') })] })] })] }) }));
}
function InvoiceSettingsDialog({ open, onOpenChange, }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data: settings } = useQuery({
        queryKey: ['invoice-settings'],
        queryFn: invoicesApi.settings,
        enabled: open,
    });
    const [draft, setDraft] = useState({});
    const value = (key) => draft[key] ?? settings?.[key];
    const mutation = useMutation({
        mutationFn: () => invoicesApi.updateSettings(draft),
        onSuccess: () => {
            toast.success(t('invoices.settings.saved'));
            void queryClient.invalidateQueries({ queryKey: ['invoice-settings'] });
            setDraft({});
            onOpenChange(false);
        },
    });
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "sm:max-w-3xl flex flex-col max-h-[calc(100dvh-2rem)]", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('invoices.settings.title') }), _jsx(DialogDescription, { children: t('invoices.settings.description') })] }), _jsxs("div", { className: "overflow-y-auto flex-1 -mx-1 px-1 grid gap-x-8 gap-y-5 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: t('invoices.settings.groupBehaviour') }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: t('invoices.settings.preset') }), _jsxs(Select, { value: String(value('preset') ?? 'tracking'), onValueChange: (v) => setDraft({ ...draft, preset: v }), children: [_jsx(SelectTrigger, { "data-testid": "invoice-preset-select", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "tracking", children: t('invoices.settings.presetTracking') }), _jsx(SelectItem, { value: "document", children: t('invoices.settings.presetDocument') })] })] }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: value('preset') === 'document'
                                                ? t('invoices.settings.presetDocumentHint')
                                                : t('invoices.settings.presetTrackingHint') })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "settings-prefix", children: t('invoices.settings.numberPrefix') }), _jsx(Input, { id: "settings-prefix", "data-testid": "invoice-prefix-input", value: String(value('number_prefix') ?? ''), onChange: (e) => setDraft({ ...draft, number_prefix: e.target.value }), placeholder: "FAT-" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "settings-terms", children: t('invoices.settings.paymentTerms') }), _jsx(Input, { id: "settings-terms", "data-testid": "invoice-terms-input", type: "number", min: 0, value: String(value('default_payment_terms_days') ?? 30), onChange: (e) => setDraft({ ...draft, default_payment_terms_days: Number(e.target.value) }) })] })] }), _jsx(IssuerSection, {})] }), _jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: t('invoices.settings.groupDocument') }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "settings-issuer", children: t('invoices.settings.issuerName') }), _jsx(Input, { id: "settings-issuer", "data-testid": "invoice-issuer-input", value: String(value('issuer_display_name') ?? ''), onChange: (e) => setDraft({ ...draft, issuer_display_name: e.target.value }) })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: t('invoices.settings.logo') }), _jsx(InvoiceLogoField, { logoId: settings?.logo_id ?? null, onChanged: () => {
                                                void queryClient.invalidateQueries({ queryKey: ['invoice-settings'] });
                                            } }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: t('invoices.settings.logoHint') })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "settings-payment", children: t('invoices.settings.paymentDetails') }), _jsx(Input, { id: "settings-payment", "data-testid": "invoice-payment-details-input", value: String(value('payment_details') ?? ''), onChange: (e) => setDraft({ ...draft, payment_details: e.target.value }), placeholder: "Pix: \u2026" }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: t('invoices.settings.paymentDetailsHint') })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "settings-accent", children: t('invoices.settings.accentColor') }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { id: "settings-accent", type: "color", "data-testid": "invoice-accent-input", className: "h-9 w-12 rounded border bg-transparent p-1", value: String(value('accent_color') ?? '#111827'), onChange: (e) => setDraft({ ...draft, accent_color: e.target.value }) }), _jsx("span", { className: "font-mono text-xs text-muted-foreground", children: String(value('accent_color') ?? '#111827') })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "settings-footer", children: t('invoices.settings.footerNote') }), _jsx(Input, { id: "settings-footer", "data-testid": "invoice-footer-input", value: String(value('footer_note') ?? ''), onChange: (e) => setDraft({ ...draft, footer_note: e.target.value }) })] })] }), _jsx("div", { className: "sm:col-span-2", children: _jsx(LabelSection, { template: value('template') ?? null, onChange: (template) => setDraft({ ...draft, template }) }) })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => onOpenChange(false), children: t('common.cancel') }), _jsx(Button, { onClick: () => mutation.mutate(), disabled: Object.keys(draft).length === 0 || mutation.isPending, "data-testid": "invoice-settings-save", children: t('common.save') })] })] }) }));
}
/**
 * The workspace describing itself: what appears as the sender on every
 * document issued from now on.
 *
 * Which fiscal documents are offered comes from the workspace's own
 * jurisdiction pack, so a Brazilian workspace is asked for a CNPJ and a
 * German one for a VAT number without this component knowing either
 * exists. It also never *restricts* the choice — a company can hold a
 * document its country's pack never anticipated.
 */
function IssuerSection() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data: issuer } = useQuery({ queryKey: ['invoice-issuer'], queryFn: invoicesApi.issuer });
    const { data: kinds } = useQuery({ queryKey: ['tax-id-kinds'], queryFn: fiscalApi.taxIdKinds });
    const [draft, setDraft] = useState({});
    const [docs, setDocs] = useState(null);
    const rows = docs ?? issuer?.tax_ids ?? [];
    const offered = (kinds?.kinds ?? []).filter((k) => k.offered);
    const mutation = useMutation({
        mutationFn: () => invoicesApi.updateIssuer({
            ...(draft.legal_name !== undefined ? { legal_name: draft.legal_name } : {}),
            ...(draft.address !== undefined ? { address: draft.address } : {}),
            ...(docs ? { tax_ids: docs.filter((d) => d.value.trim()) } : {}),
        }),
        onSuccess: () => {
            toast.success(t('invoices.settings.saved'));
            void queryClient.invalidateQueries({ queryKey: ['invoice-issuer'] });
            setDraft({});
            setDocs(null);
        },
        onError: (error) => {
            const key = invoiceErrorKey(error);
            toast.error(key ? t(key, t('invoices.errors.generic')) : t('invoices.errors.generic'));
        },
    });
    return (_jsxs("div", { className: "border-t pt-4 space-y-3", "data-testid": "invoice-issuer-section", children: [_jsxs("div", { children: [_jsx(Label, { children: t('invoices.settings.issuer') }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: t('invoices.settings.issuerHint') })] }), _jsx(Input, { "data-testid": "issuer-legal-name", placeholder: t('invoices.settings.legalName'), value: draft.legal_name ?? issuer?.legal_name ?? '', onChange: (e) => setDraft({ ...draft, legal_name: e.target.value }) }), _jsx(Input, { "data-testid": "issuer-address", placeholder: t('invoices.settings.addressLabel'), value: draft.address ?? issuer?.address ?? '', onChange: (e) => setDraft({ ...draft, address: e.target.value }) }), offered.map((kind) => {
                const existing = rows.find((r) => r.kind === kind.kind);
                return (_jsx(Input, { "data-testid": `issuer-tax-${kind.kind}`, placeholder: t(kind.label_key, kind.kind.toUpperCase()), value: existing?.value ?? '', onChange: (e) => {
                        const next = rows.filter((r) => r.kind !== kind.kind);
                        if (e.target.value.trim())
                            next.push({ kind: kind.kind, value: e.target.value });
                        setDocs(next);
                    } }, kind.kind));
            }), _jsx(Button, { size: "sm", variant: "outline", onClick: () => mutation.mutate(), disabled: mutation.isPending || (Object.keys(draft).length === 0 && docs === null), "data-testid": "issuer-save", children: t('invoices.settings.saveIssuer') })] }));
}
/**
 * Renaming what the document calls each field.
 *
 * Only the fields a sender actually renames are offered. The full set is
 * eighteen, and a settings dialog with eighteen text inputs is a wall
 * nobody reads; the rest stay editable through the API for the rare
 * workspace that wants them.
 *
 * Placeholders show the pack for the workspace's language, so an empty
 * box reads as "this is what it will say" rather than as a missing
 * value. Clearing a box returns that label to the pack.
 */
const EDITABLE_LABELS = [
    'invoice',
    'billTo',
    'from',
    'description',
    'quantity',
    'unitPrice',
    'total',
    'paymentDetails',
    'notes',
];
function LabelSection({ template, onChange, }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const labels = template?.labels ?? {};
    const set = (key, value) => {
        const next = { ...labels };
        // An empty box means "use the default", not "print nothing".
        if (value.trim())
            next[key] = value;
        else
            delete next[key];
        onChange({ ...(template ?? {}), labels: next });
    };
    return (_jsxs("div", { className: "border-t pt-4", children: [_jsxs("button", { type: "button", onClick: () => setOpen(!open), "data-testid": "invoice-labels-toggle", className: "flex w-full items-center justify-between text-left", children: [_jsxs("div", { children: [_jsx(Label, { className: "cursor-pointer", children: t('invoices.settings.labels') }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: t('invoices.settings.labelsHint') })] }), _jsx(ChevronDown, { className: cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180') })] }), open && (_jsx("div", { className: "mt-3 grid gap-2 sm:grid-cols-2", children: EDITABLE_LABELS.map((key) => (_jsx(Input, { "data-testid": `invoice-label-${key}`, value: labels[key] ?? '', placeholder: t(`invoices.label.${key}`), onChange: (e) => set(key, e.target.value) }, key))) }))] }));
}
