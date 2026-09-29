import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Skeleton } from '../components/ui/skeleton.js';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '../components/ui/dialog.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '../components/ui/select.js';
import { PageHeader } from '../components/page-header.js';
import { SectionCard, Segmented, TH } from '../components/invoice-ui.js';
import { InvoiceLineEditor } from '../components/invoice-line-editor.js';
import { EndConditionFields, ScheduleBadge } from '../components/invoice-schedule-ui.js';
import { CurrencySelect } from '../components/currency-select.js';
import { cn } from '../lib/utils.js';
import { formatCurrency } from '../lib/format.js';
import { useDisplayLocale, useDateLocale } from '../hooks/use-display-locale.js';
import { usePrivacyMode } from '../hooks/use-privacy-mode.js';
import { useAuth } from '../contexts/auth-context.js';
import { useWorkspace } from '../contexts/workspace-context.js';
import { invoiceSchedules as schedulesApi, invoices as invoicesApi, payees as payeesApi } from '../lib/api.js';
import { invoiceErrorKey, linesTotal } from '../lib/invoice-utils.js';
import { FREQUENCIES, endPayload, localToday, monthlyEquivalent } from '../lib/invoice-schedule-utils.js';
export default function InvoiceSchedulesPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const { mask } = usePrivacyMode();
    const { canWrite } = useWorkspace();
    const [filter, setFilter] = useState('all');
    const [createOpen, setCreateOpen] = useState(false);
    const { data: summary } = useQuery({
        queryKey: ['invoice-schedule-summary'],
        queryFn: schedulesApi.summary,
    });
    const { data: list, isLoading } = useQuery({
        queryKey: ['invoice-schedules', filter],
        queryFn: () => schedulesApi.list(filter === 'all' ? undefined : { status: filter }),
    });
    const money = (value, code) => mask(formatCurrency(Number(value ?? 0), code, locale));
    const showDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(dateLocale);
    const counts = useMemo(() => summary
        ? {
            all: summary.active_count + summary.paused_count + summary.ended_count,
            active: summary.active_count,
            paused: summary.paused_count,
            ended: summary.ended_count,
        }
        : undefined, [summary]);
    return (_jsxs("div", { children: [_jsxs("button", { onClick: () => navigate('/invoices'), className: "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-3", "data-testid": "schedules-back", children: [_jsx(ArrowLeft, { className: "h-3.5 w-3.5" }), t('invoices.backToList')] }), _jsx(PageHeader, { section: t('invoices.title'), title: t('invoices.schedules.title'), action: canWrite ? (_jsxs(Button, { size: "sm", onClick: () => setCreateOpen(true), "data-testid": "schedule-new-button", children: [_jsx(Plus, { className: "h-4 w-4 mr-1.5" }), t('invoices.schedules.new')] })) : undefined }), _jsx("div", { className: "bg-card rounded-xl border border-border shadow-sm mb-5", "data-testid": "schedules-summary", children: !summary ? (_jsx("div", { className: "px-5 py-4", children: _jsx(Skeleton, { className: "h-10 w-48" }) })) : summary.by_currency.length === 0 ? (_jsxs("div", { className: "px-5 py-4", children: [_jsx("p", { className: "text-xs font-medium text-muted-foreground mb-0.5", children: t('invoices.schedules.summary.monthly') }), _jsx("p", { className: "text-2xl font-semibold tracking-tight text-muted-foreground", children: t('invoices.schedules.summary.none') })] })) : (summary.by_currency.map((row) => (_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-y-3 px-5 py-4 border-b border-border last:border-0", "data-testid": `schedules-summary-${row.currency}`, children: [_jsxs("div", { className: "col-span-2 sm:col-span-1", children: [_jsx("p", { className: "text-xs font-medium text-muted-foreground mb-0.5", children: t('invoices.schedules.summary.monthly') }), _jsx("p", { className: "text-2xl font-semibold tracking-tight tabular-nums", children: money(row.monthly_recurring, row.currency) }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: t('invoices.schedules.summary.activeCount', { count: row.active_count }) })] }), _jsx(Stat, { label: t('invoices.schedules.summary.yearly'), value: money(Number(row.monthly_recurring) * 12, row.currency) }), _jsx(Stat, { label: t('invoices.schedules.summary.lost'), value: money(row.monthly_lost, row.currency), hint: t('invoices.schedules.summary.endedRecently', { count: row.ended_recently_count }), tone: Number(row.monthly_lost) > 0 ? 'text-rose-500' : undefined }), _jsx(Stat, { label: t('invoices.schedules.summary.pastDue'), value: String(row.past_due_count), hint: t('invoices.schedules.summary.pastDueHint'), tone: row.past_due_count > 0 ? 'text-amber-600' : undefined })] }, row.currency)))) }), _jsx("div", { className: "mb-4", children: _jsx(Segmented, { value: filter, onChange: setFilter, testIdPrefix: "schedule-filter", options: ['all', 'active', 'paused', 'ended'].map((value) => ({
                        value,
                        label: t(`invoices.schedules.filter.${value}`),
                        count: counts?.[value],
                    })) }) }), _jsx(SectionCard, { children: isLoading ? (_jsx("div", { className: "p-5 space-y-3", children: [0, 1, 2].map((i) => (_jsx(Skeleton, { className: "h-9 w-full" }, i))) })) : !list || list.length === 0 ? (_jsxs("div", { className: "px-5 py-14 text-center", "data-testid": "schedules-empty", children: [_jsx(Repeat, { className: "h-8 w-8 mx-auto text-muted-foreground/50" }), _jsx("p", { className: "mt-3 text-sm text-muted-foreground max-w-sm mx-auto", children: filter === 'all'
                                ? t('invoices.schedules.empty')
                                : t('invoices.schedules.emptyFiltered') }), filter === 'all' && canWrite && (_jsxs(Button, { size: "sm", className: "mt-4", onClick: () => setCreateOpen(true), children: [_jsx(Plus, { className: "h-4 w-4 mr-1.5" }), t('invoices.schedules.new')] }))] })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-border", children: [_jsx("th", { className: `${TH} pl-4 sm:pl-5 text-left`, children: t('invoices.schedules.column.name') }), _jsx("th", { className: `${TH} text-left hidden md:table-cell`, children: t('invoices.schedules.column.cadence') }), _jsx("th", { className: `${TH} text-right w-32 pr-6`, children: t('invoices.schedules.column.monthly') }), _jsx("th", { className: `${TH} text-left w-36 hidden sm:table-cell`, children: t('invoices.schedules.column.next') }), _jsx("th", { className: `${TH} text-right w-20 hidden lg:table-cell`, children: t('invoices.schedules.column.invoices') }), _jsx("th", { className: `${TH} pr-4 sm:pr-5 text-right w-28`, children: t('invoices.schedules.column.status') })] }) }), _jsx("tbody", { children: list.map((schedule) => (_jsxs("tr", { onClick: () => navigate(`/invoices/schedules/${schedule.id}`), "data-testid": "schedule-row", className: "border-b border-border last:border-0 hover:bg-muted transition-colors cursor-pointer", children: [_jsxs("td", { className: "py-3 pl-4 sm:pl-5", children: [_jsx("div", { className: "text-sm font-medium text-foreground truncate", children: schedule.name }), _jsx("div", { className: "text-xs text-muted-foreground truncate", children: schedule.payee?.name ?? t('invoices.noClient') })] }), _jsxs("td", { className: "py-3 hidden md:table-cell text-xs text-muted-foreground", children: [t(`invoices.schedules.frequency.${schedule.frequency}`), (schedule.current_term ?? schedule.next_term) && (_jsxs("span", { className: "tabular-nums", children: [' · ', money((schedule.current_term ?? schedule.next_term).total, schedule.currency)] }))] }), _jsx("td", { className: "py-3 pr-6 text-right text-sm font-bold tabular-nums", children: schedule.status === 'active'
                                                ? money(schedule.monthly_amount, schedule.currency)
                                                : _jsx("span", { className: "text-muted-foreground font-medium", children: "\u2014" }) }), _jsx("td", { className: "py-3 hidden sm:table-cell text-xs text-muted-foreground tabular-nums", children: schedule.status === 'active' && schedule.next_period_start
                                                ? showDate(schedule.next_period_start)
                                                : '—' }), _jsx("td", { className: "py-3 text-right hidden lg:table-cell text-xs text-muted-foreground tabular-nums", children: schedule.invoice_count }), _jsx("td", { className: "py-3 pr-4 sm:pr-5 text-right", children: _jsx(ScheduleBadge, { schedule: schedule }) })] }, schedule.id))) })] }) })) }), _jsx(CreateScheduleDialog, { open: createOpen, onOpenChange: setCreateOpen, onCreated: (schedule) => navigate(`/invoices/schedules/${schedule.id}`) }, createOpen ? 'open' : 'closed')] }));
}
function Stat({ label, value, hint, tone, }) {
    return (_jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium text-muted-foreground mb-0.5", children: label }), _jsx("p", { className: cn('text-lg font-semibold tracking-tight tabular-nums', tone), children: value }), hint && _jsx("p", { className: "text-[11px] text-muted-foreground", children: hint })] }));
}
function CreateScheduleDialog({ open, onOpenChange, onCreated, }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const locale = useDisplayLocale();
    const { user } = useAuth();
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
    const [name, setName] = useState('');
    const [payeeId, setPayeeId] = useState('');
    const [frequency, setFrequency] = useState('monthly');
    const [startDate, setStartDate] = useState(() => localToday());
    const [endType, setEndType] = useState('never');
    const [endDate, setEndDate] = useState('');
    const [endCount, setEndCount] = useState('');
    const [paymentTerms, setPaymentTerms] = useState('');
    const [notes, setNotes] = useState('');
    const [currencyCode, setCurrencyCode] = useState(user?.preferences?.currency_display ?? 'USD');
    const [lines, setLines] = useState([
        { description: '', quantity: '1', unit_price: '0' },
    ]);
    const perPeriod = linesTotal(lines);
    const monthly = monthlyEquivalent(perPeriod, frequency);
    const mutation = useMutation({
        mutationFn: () => schedulesApi.create({
            name,
            payee_id: payeeId || null,
            frequency,
            start_date: startDate,
            ...endPayload(endType, endDate, endCount),
            payment_terms_days: paymentTerms ? Number(paymentTerms) : null,
            currency: currencyCode,
            notes: notes || null,
            lines,
        }),
        onSuccess: (schedule) => {
            toast.success(t('invoices.schedules.created'));
            void queryClient.invalidateQueries({ queryKey: ['invoice-schedules'] });
            void queryClient.invalidateQueries({ queryKey: ['invoice-schedule-summary'] });
            onOpenChange(false);
            onCreated(schedule);
        },
        onError: (error) => {
            const key = invoiceErrorKey(error);
            toast.error(key ? t(key, t('invoices.errors.generic')) : t('invoices.errors.generic'));
        },
    });
    const ready = name.trim().length > 0 &&
        perPeriod > 0 &&
        Boolean(startDate) &&
        (endType !== 'on_date' || Boolean(endDate)) &&
        (endType !== 'after_count' || Number(endCount) >= 1);
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "flex flex-col max-h-[calc(100dvh-2rem)] sm:max-w-3xl", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('invoices.schedules.new') }), _jsx(DialogDescription, { children: t('invoices.schedules.newDescription') })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "schedule-name", children: t('invoices.schedules.field.name') }), _jsx(Input, { id: "schedule-name", "data-testid": "schedule-name-input", value: name, onChange: (e) => setName(e.target.value), placeholder: t('invoices.schedules.field.namePlaceholder') })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: t('invoices.field.client') }), _jsxs(Select, { value: payeeId, onValueChange: setPayeeId, children: [_jsx(SelectTrigger, { "data-testid": "schedule-client-select", children: _jsx(SelectValue, { placeholder: t('invoices.field.clientPlaceholder') }) }), _jsx(SelectContent, { children: clients.map((client) => (_jsx(SelectItem, { value: client.id, children: client.name }, client.id))) })] })] })] }), _jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: t('invoices.schedules.field.frequency') }), _jsxs(Select, { value: frequency, onValueChange: (v) => setFrequency(v), children: [_jsx(SelectTrigger, { "data-testid": "schedule-frequency-select", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: FREQUENCIES.map((value) => (_jsx(SelectItem, { value: value, children: t(`invoices.schedules.frequency.${value}`) }, value))) })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "schedule-start", children: t('invoices.schedules.field.startDate') }), _jsx(Input, { id: "schedule-start", "data-testid": "schedule-start-input", type: "date", value: startDate, onChange: (e) => setStartDate(e.target.value) })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "schedule-terms", children: t('invoices.schedules.field.paymentTerms') }), _jsx(Input, { id: "schedule-terms", "data-testid": "schedule-terms-input", type: "number", min: 0, value: paymentTerms, onChange: (e) => setPaymentTerms(e.target.value), placeholder: String(settings?.default_payment_terms_days ?? 30) })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "schedule-currency", children: t('invoices.schedules.field.currency') }), _jsx(CurrencySelect, { id: "schedule-currency", value: currencyCode, onChange: setCurrencyCode })] })] }), _jsx(EndConditionFields, { idPrefix: "schedule", endType: endType, endDate: endDate, endCount: endCount, onChange: (next) => {
                                setEndType(next.endType);
                                setEndDate(next.endDate);
                                setEndCount(next.endCount);
                            } }), _jsx(InvoiceLineEditor, { lines: lines, onChange: setLines, currency: currencyCode, showTax: (settings?.tax_fields ?? 'hidden') !== 'hidden', required: true }), _jsx("p", { className: "text-xs text-muted-foreground", "data-testid": "schedule-monthly-preview", children: t('invoices.schedules.monthlyPreview', {
                                amount: formatCurrency(monthly, currencyCode, locale),
                            }) }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "schedule-notes", children: t('invoices.field.notes') }), _jsx(Input, { id: "schedule-notes", "data-testid": "schedule-notes-input", value: notes, onChange: (e) => setNotes(e.target.value) })] })] }), _jsxs(DialogFooter, { className: "gap-2", children: [_jsx(Button, { variant: "ghost", onClick: () => onOpenChange(false), children: t('common.cancel') }), _jsx(Button, { onClick: () => mutation.mutate(), disabled: !ready || mutation.isPending, "data-testid": "schedule-create-submit", children: t('common.create') })] })] }) }));
}
