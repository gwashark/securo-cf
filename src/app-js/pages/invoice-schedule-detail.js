import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, Link2, MoreHorizontal, Pause, Pencil, Play, Plus, Receipt, Repeat, Trash2, Zap, } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Skeleton } from '../components/ui/skeleton.js';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '../components/ui/dialog.js';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '../components/ui/dropdown-menu.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '../components/ui/select.js';
import { PageHeader } from '../components/page-header.js';
import { IconAction, SectionCard, SectionHeader, StateBadge, TH } from '../components/invoice-ui.js';
import { EndConditionFields, ScheduleBadge } from '../components/invoice-schedule-ui.js';
import { InvoiceLineEditor } from '../components/invoice-line-editor.js';
import { cn } from '../lib/utils.js';
import { formatCurrency } from '../lib/format.js';
import { useDisplayLocale, useDateLocale } from '../hooks/use-display-locale.js';
import { usePrivacyMode } from '../hooks/use-privacy-mode.js';
import { useWorkspace } from '../contexts/workspace-context.js';
import { invoiceSchedules as schedulesApi, invoices as invoicesApi, payees as payeesApi } from '../lib/api.js';
import { displayNumber, invoiceErrorKey, linesTotal } from '../lib/invoice-utils.js';
import { FREQUENCIES, endPayload, isUpcomingTerm, localToday, monthlyEquivalent, periodLabel, scheduleActions, } from '../lib/invoice-schedule-utils.js';
/**
 * One agreement: what it is worth, what it has produced, and the price
 * over time.
 *
 * Two sections carry the design. **Terms** is the price as a history:
 * a raise recorded today for January sits there as an upcoming row and
 * changes nothing until then. **Invoices** is the money: every period
 * that was billed, born from the job or linked by hand, each an
 * ordinary invoice that knows which period it answers for.
 */
export default function InvoiceScheduleDetailPage() {
    const { t } = useTranslation();
    const { id = '' } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const { mask } = usePrivacyMode();
    const { canWrite } = useWorkspace();
    const [editOpen, setEditOpen] = useState(false);
    const [endOpen, setEndOpen] = useState(false);
    const [linkOpen, setLinkOpen] = useState(false);
    const [termTarget, setTermTarget] = useState(null);
    const { data: schedule, isLoading } = useQuery({
        queryKey: ['invoice-schedule', id],
        queryFn: () => schedulesApi.get(id),
        enabled: Boolean(id),
    });
    const { data: invoices = [] } = useQuery({
        queryKey: ['invoice-schedule-invoices', id],
        queryFn: () => schedulesApi.invoices(id),
        enabled: Boolean(id),
    });
    const { data: settings } = useQuery({
        queryKey: ['invoice-settings'],
        queryFn: invoicesApi.settings,
    });
    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ['invoice-schedule', id] });
        void queryClient.invalidateQueries({ queryKey: ['invoice-schedule-invoices', id] });
        void queryClient.invalidateQueries({ queryKey: ['invoice-schedule-periods', id] });
        void queryClient.invalidateQueries({ queryKey: ['invoice-schedules'] });
        void queryClient.invalidateQueries({ queryKey: ['invoice-schedule-summary'] });
        void queryClient.invalidateQueries({ queryKey: ['invoices'] });
        void queryClient.invalidateQueries({ queryKey: ['invoice-summary'] });
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
    const pauseMutation = useMutation(decision(() => schedulesApi.pause(id), 'invoices.schedules.paused'));
    const resumeMutation = useMutation(decision(() => schedulesApi.resume(id), 'invoices.schedules.resumed'));
    const generateMutation = useMutation({
        mutationFn: () => schedulesApi.generate(id),
        onSuccess: (emitted) => {
            toast.success(t('invoices.schedules.generated', { count: emitted.length }));
            refresh();
            if (emitted.length === 1)
                navigate(`/invoices/${emitted[0].id}`);
        },
        onError,
    });
    const deleteMutation = useMutation({
        mutationFn: () => schedulesApi.remove(id),
        onSuccess: () => {
            toast.success(t('invoices.schedules.deleted'));
            refresh();
            navigate('/invoices/schedules');
        },
        onError,
    });
    const removeTermMutation = useMutation({
        mutationFn: (termId) => schedulesApi.removeTerm(id, termId),
        onSuccess: () => {
            toast.success(t('invoices.schedules.termRemoved'));
            refresh();
        },
        onError,
    });
    const sortedTerms = useMemo(() => (schedule ? [...schedule.terms].sort((a, b) => a.effective_from.localeCompare(b.effective_from)) : []), [schedule]);
    if (isLoading || !schedule) {
        return (_jsxs("div", { children: [_jsx(Skeleton, { className: "h-4 w-28 mb-6" }), _jsx(Skeleton, { className: "h-40 w-full rounded-xl" })] }));
    }
    const actions = scheduleActions(schedule);
    // An ended agreement with invoices under it has no decision left to
    // take, and an empty menu is worse than none.
    const hasMenu = actions.canEdit || actions.canPause || actions.canResume || actions.canEnd || actions.canDelete;
    const money = (value) => mask(formatCurrency(Number(value ?? 0), schedule.currency, locale));
    const showDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(dateLocale);
    const currentId = schedule.current_term?.id;
    // The latest period already billed. A term governing it, or anything
    // before it, is history: the server refuses to change it, so the
    // buttons that would try are not offered.
    const billedUpTo = invoices.reduce((latest, inv) => (inv.period_start && (!latest || inv.period_start > latest) ? inv.period_start : latest), null);
    return (_jsxs("div", { children: [_jsxs("button", { onClick: () => navigate('/invoices/schedules'), className: "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-3", "data-testid": "schedule-back", children: [_jsx(ArrowLeft, { className: "h-3.5 w-3.5" }), t('invoices.schedules.backToList')] }), _jsx(PageHeader, { section: schedule.payee?.name ?? t('invoices.noClient'), title: schedule.name, action: canWrite ? (_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [actions.canChangePrice && (_jsxs(Button, { size: "sm", variant: "outline", onClick: () => setTermTarget('new'), "data-testid": "schedule-change-price", children: [_jsx(Pencil, { className: "h-4 w-4 mr-1.5" }), t('invoices.schedules.action.changePrice')] })), actions.canGenerate && (_jsxs(Button, { size: "sm", onClick: () => generateMutation.mutate(), disabled: generateMutation.isPending, "data-testid": "schedule-generate", children: [_jsx(Zap, { className: "h-4 w-4 mr-1.5" }), t('invoices.schedules.action.generate')] })), hasMenu && (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx("button", { type: "button", "aria-label": t('invoices.moreActions'), "data-testid": "schedule-more-actions", className: "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/80 bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", children: _jsx(MoreHorizontal, { className: "h-4 w-4" }) }) }), _jsxs(DropdownMenuContent, { align: "end", className: "w-[220px] p-1 bg-card border border-border rounded-xl shadow-md", children: [actions.canEdit && (_jsxs(DropdownMenuItem, { onClick: () => setEditOpen(true), "data-testid": "schedule-edit", className: "gap-2 text-sm", children: [_jsx(Pencil, { className: "h-4 w-4 text-muted-foreground" }), t('common.edit')] })), actions.canPause && (_jsxs(DropdownMenuItem, { onClick: () => pauseMutation.mutate(), "data-testid": "schedule-pause", className: "gap-2 text-sm", children: [_jsx(Pause, { className: "h-4 w-4 text-muted-foreground" }), t('invoices.schedules.action.pause')] })), actions.canResume && (_jsxs(DropdownMenuItem, { onClick: () => resumeMutation.mutate(), "data-testid": "schedule-resume", className: "gap-2 text-sm", children: [_jsx(Play, { className: "h-4 w-4 text-muted-foreground" }), t('invoices.schedules.action.resume')] })), actions.canEnd && (_jsxs(DropdownMenuItem, { onClick: () => setEndOpen(true), "data-testid": "schedule-end", className: "gap-2 text-sm text-destructive focus:text-destructive", children: [_jsx(Ban, { className: "h-4 w-4" }), t('invoices.schedules.action.end')] })), actions.canDelete && (_jsxs(DropdownMenuItem, { onClick: () => deleteMutation.mutate(), "data-testid": "schedule-delete", className: "gap-2 text-sm text-destructive focus:text-destructive", children: [_jsx(Trash2, { className: "h-4 w-4" }), t('common.delete')] }))] })] }))] })) : undefined }), _jsxs("div", { className: "flex flex-wrap items-center gap-x-3 gap-y-2 mb-5 text-xs text-muted-foreground", children: [_jsx(ScheduleBadge, { schedule: schedule }), _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Repeat, { className: "h-3 w-3" }), t(`invoices.schedules.frequency.${schedule.frequency}`)] }), _jsx("span", { children: t('invoices.schedules.since', { date: showDate(schedule.start_date) }) }), schedule.end_type === 'on_date' && schedule.end_date && (_jsx("span", { children: t('invoices.schedules.untilDate', { date: showDate(schedule.end_date) }) })), schedule.end_type === 'after_count' && schedule.end_count && (_jsx("span", { children: t('invoices.schedules.untilCount', { count: schedule.end_count }) })), schedule.status === 'ended' && schedule.ended_at && schedule.end_reason && (_jsx("span", { "data-testid": "schedule-ended-line", children: t('invoices.schedules.endedOn', {
                            date: showDate(schedule.ended_at),
                            reason: t(`invoices.schedules.endReason.${schedule.end_reason}`),
                        }) })), schedule.status === 'paused' && schedule.pause_reason === 'failures' && (_jsx("span", { className: "text-rose-500 font-medium", children: t('invoices.schedules.pausedByFailures') }))] }), _jsxs("div", { className: "space-y-5", children: [_jsx(SectionCard, { children: _jsx("div", { className: "grid grid-cols-2 sm:grid-cols-4 divide-x divide-border", children: [
                                { label: t('invoices.schedules.column.monthly'), value: money(schedule.monthly_amount) },
                                { label: t('invoices.schedules.figure.invoiced'), value: money(schedule.amount_invoiced) },
                                { label: t('invoices.schedules.figure.paid'), value: money(schedule.amount_paid) },
                                {
                                    label: t('invoices.schedules.column.next'),
                                    value: schedule.status === 'active' && schedule.next_period_start
                                        ? showDate(schedule.next_period_start)
                                        : '—',
                                    tone: schedule.past_due_count > 0 ? 'text-amber-600' : undefined,
                                    hint: schedule.past_due_count > 0
                                        ? t('invoices.schedules.figure.pastDue', { count: schedule.past_due_count })
                                        : undefined,
                                },
                            ].map((figure) => (_jsxs("div", { className: "px-4 sm:px-5 py-4", children: [_jsx("p", { className: "text-xs font-medium text-muted-foreground mb-0.5", children: figure.label }), _jsx("p", { className: cn('text-lg font-semibold tracking-tight tabular-nums', 'tone' in figure && figure.tone), children: figure.value }), 'hint' in figure && figure.hint && (_jsx("p", { className: "text-[11px] text-amber-600", children: figure.hint }))] }, figure.label))) }) }), _jsxs(SectionCard, { children: [_jsx(SectionHeader, { title: t('invoices.schedules.terms.title'), description: t('invoices.schedules.terms.description') }), _jsx("div", { className: "divide-y divide-border", "data-testid": "schedule-terms", children: sortedTerms.map((term) => {
                                    const upcoming = isUpcomingTerm(term.effective_from);
                                    const editable = upcoming && (!billedUpTo || term.effective_from > billedUpTo);
                                    const isCurrent = term.id === currentId;
                                    return (_jsxs("div", { className: "flex items-center gap-3 px-4 sm:px-5 py-3", "data-testid": "schedule-term-row", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "text-sm font-medium tabular-nums", children: t('invoices.schedules.terms.from', { date: showDate(term.effective_from) }) }), isCurrent && (_jsx("span", { className: "text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20", children: t('invoices.schedules.terms.current') })), upcoming && (_jsx("span", { className: "text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border", children: t('invoices.schedules.terms.upcoming') }))] }), _jsx("p", { className: "text-xs text-muted-foreground truncate", children: term.lines.map((line) => line.description).join(' · ') })] }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "text-sm font-bold tabular-nums", children: money(term.total) }), _jsx("p", { className: "text-[11px] text-muted-foreground tabular-nums", children: t('invoices.schedules.terms.perMonth', {
                                                            amount: money(monthlyEquivalent(Number(term.total), schedule.frequency)),
                                                        }) })] }), canWrite && editable && schedule.status !== 'ended' && (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx(IconAction, { onClick: () => setTermTarget(term), label: t('common.edit'), children: _jsx(Pencil, { className: "h-3.5 w-3.5" }) }), sortedTerms.length > 1 && (_jsx(IconAction, { onClick: () => removeTermMutation.mutate(term.id), label: t('common.delete'), children: _jsx(Trash2, { className: "h-3.5 w-3.5" }) }))] }))] }, term.id));
                                }) })] }), _jsxs(SectionCard, { children: [_jsx(SectionHeader, { title: t('invoices.schedules.invoices.title'), description: t('invoices.schedules.invoices.description'), action: canWrite && schedule.status !== 'ended' ? (_jsxs(Button, { size: "sm", variant: "outline", onClick: () => setLinkOpen(true), "data-testid": "schedule-link-invoice", children: [_jsx(Link2, { className: "h-4 w-4 mr-1.5" }), t('invoices.schedules.action.linkInvoice')] })) : undefined }), invoices.length === 0 ? (_jsxs("div", { className: "px-5 py-10 text-center", "data-testid": "schedule-invoices-empty", children: [_jsx(Receipt, { className: "h-7 w-7 mx-auto text-muted-foreground/50" }), _jsx("p", { className: "mt-3 text-sm text-muted-foreground max-w-sm mx-auto", children: schedule.status === 'active' && schedule.next_period_start
                                            ? t('invoices.schedules.invoices.emptyNext', { date: showDate(schedule.next_period_start) })
                                            : t('invoices.schedules.invoices.empty') })] })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-border", children: [_jsx("th", { className: `${TH} pl-4 sm:pl-5 text-left`, children: t('invoices.schedules.column.period') }), _jsx("th", { className: `${TH} text-left w-24 hidden sm:table-cell`, children: t('invoices.column.number') }), _jsx("th", { className: `${TH} text-left w-32 hidden md:table-cell`, children: t('invoices.column.due') }), _jsx("th", { className: `${TH} text-right w-32`, children: t('invoices.column.total') }), _jsx("th", { className: `${TH} pr-4 sm:pr-5 text-right w-28`, children: t('invoices.column.state') })] }) }), _jsx("tbody", { children: [...invoices]
                                                .sort((a, b) => (b.sequence ?? 0) - (a.sequence ?? 0))
                                                .map((invoice) => (_jsxs("tr", { onClick: () => navigate(`/invoices/${invoice.id}`), "data-testid": "schedule-invoice-row", className: "border-b border-border last:border-0 hover:bg-muted transition-colors cursor-pointer", children: [_jsx("td", { className: "py-3 pl-4 sm:pl-5 text-sm tabular-nums", children: invoice.period_start && invoice.period_end
                                                            ? periodLabel(invoice.period_start, invoice.period_end, dateLocale)
                                                            : showDate(invoice.issue_date) }), _jsx("td", { className: "py-3 text-xs text-muted-foreground tabular-nums hidden sm:table-cell", children: displayNumber(invoice, settings?.number_prefix) ?? t('invoices.noNumber') }), _jsx("td", { className: "py-3 text-xs text-muted-foreground tabular-nums hidden md:table-cell", children: showDate(invoice.due_date) }), _jsx("td", { className: "py-3 text-right text-sm tabular-nums", children: money(invoice.total) }), _jsx("td", { className: "py-3 pr-4 sm:pr-5 text-right", children: _jsx(StateBadge, { state: invoice.state }) })] }, invoice.id))) })] }) }))] })] }), _jsx(EditScheduleDialog, { open: editOpen, onOpenChange: setEditOpen, schedule: schedule, onSaved: refresh }, editOpen ? 'open' : 'closed'), _jsx(EndScheduleDialog, { open: endOpen, onOpenChange: setEndOpen, schedule: schedule, onEnded: refresh }, endOpen ? 'end-open' : 'end-closed'), _jsx(TermDialog, { open: termTarget !== null, onOpenChange: (open) => !open && setTermTarget(null), schedule: schedule, term: termTarget === 'new' ? null : termTarget, onSaved: refresh }, termTarget === null ? 'term-closed' : termTarget === 'new' ? 'term-new' : termTarget.id), _jsx(LinkInvoiceDialog, { open: linkOpen, onOpenChange: setLinkOpen, schedule: schedule, onLinked: refresh }, linkOpen ? 'link-open' : 'link-closed')] }));
}
function useScheduleError() {
    const { t } = useTranslation();
    return (error) => {
        const key = invoiceErrorKey(error);
        toast.error(key ? t(key, t('invoices.errors.generic')) : t('invoices.errors.generic'));
    };
}
function EditScheduleDialog({ open, onOpenChange, schedule, onSaved, }) {
    const { t } = useTranslation();
    const onError = useScheduleError();
    const { data: clients = [] } = useQuery({
        queryKey: ['payees', 'for-invoice'],
        queryFn: () => payeesApi.list({}),
        enabled: open,
    });
    const [name, setName] = useState(schedule.name);
    const [payeeId, setPayeeId] = useState(schedule.payee_id ?? '');
    const [frequency, setFrequency] = useState(schedule.frequency);
    const [startDate, setStartDate] = useState(schedule.start_date);
    const [endType, setEndType] = useState(schedule.end_type);
    const [endDate, setEndDate] = useState(schedule.end_date ?? '');
    const [endCount, setEndCount] = useState(schedule.end_count ? String(schedule.end_count) : '');
    const [paymentTerms, setPaymentTerms] = useState(schedule.payment_terms_days === null ? '' : String(schedule.payment_terms_days));
    const [notes, setNotes] = useState(schedule.notes ?? '');
    // The calendar is fixed once anything was billed: moving the anchor
    // would change what period every existing invoice was for.
    const calendarLocked = schedule.invoice_count > 0;
    const mutation = useMutation({
        mutationFn: () => schedulesApi.update(schedule.id, {
            name,
            payee_id: payeeId || null,
            ...(calendarLocked ? {} : { frequency, start_date: startDate }),
            ...endPayload(endType, endDate, endCount),
            payment_terms_days: paymentTerms ? Number(paymentTerms) : null,
            notes: notes || null,
        }),
        onSuccess: () => {
            toast.success(t('invoices.schedules.saved'));
            onOpenChange(false);
            onSaved();
        },
        onError,
    });
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "sm:max-w-lg", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('invoices.schedules.editTitle') }), _jsx(DialogDescription, { children: calendarLocked
                                ? t('invoices.schedules.editLockedDescription')
                                : t('invoices.schedules.editDescription') })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "edit-schedule-name", children: t('invoices.schedules.field.name') }), _jsx(Input, { id: "edit-schedule-name", "data-testid": "edit-schedule-name", value: name, onChange: (e) => setName(e.target.value) })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: t('invoices.field.client') }), _jsxs(Select, { value: payeeId, onValueChange: setPayeeId, children: [_jsx(SelectTrigger, { "data-testid": "edit-schedule-client", children: _jsx(SelectValue, { placeholder: t('invoices.field.clientPlaceholder') }) }), _jsx(SelectContent, { children: clients.map((client) => (_jsx(SelectItem, { value: client.id, children: client.name }, client.id))) })] })] }), _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: t('invoices.schedules.field.frequency') }), _jsxs(Select, { value: frequency, onValueChange: (v) => setFrequency(v), disabled: calendarLocked, children: [_jsx(SelectTrigger, { "data-testid": "edit-schedule-frequency", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: FREQUENCIES.map((value) => (_jsx(SelectItem, { value: value, children: t(`invoices.schedules.frequency.${value}`) }, value))) })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "edit-schedule-start", children: t('invoices.schedules.field.startDate') }), _jsx(Input, { id: "edit-schedule-start", type: "date", value: startDate, onChange: (e) => setStartDate(e.target.value), disabled: calendarLocked })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "edit-schedule-terms", children: t('invoices.schedules.field.paymentTerms') }), _jsx(Input, { id: "edit-schedule-terms", type: "number", min: 0, value: paymentTerms, onChange: (e) => setPaymentTerms(e.target.value) })] })] }), _jsx(EndConditionFields, { idPrefix: "edit-schedule", endType: endType, endDate: endDate, endCount: endCount, onChange: (next) => { setEndType(next.endType); setEndDate(next.endDate); setEndCount(next.endCount); } }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "edit-schedule-notes", children: t('invoices.field.notes') }), _jsx(Input, { id: "edit-schedule-notes", value: notes, onChange: (e) => setNotes(e.target.value) })] })] }), _jsxs(DialogFooter, { className: "gap-2", children: [_jsx(Button, { variant: "ghost", onClick: () => onOpenChange(false), children: t('common.cancel') }), _jsx(Button, { onClick: () => mutation.mutate(), disabled: !name.trim() || mutation.isPending, "data-testid": "edit-schedule-save", children: t('common.save') })] })] }) }));
}
const END_REASONS = ['canceled_by_client', 'canceled_by_us', 'completed', 'unpaid', 'other'];
function EndScheduleDialog({ open, onOpenChange, schedule, onEnded, }) {
    const { t } = useTranslation();
    const onError = useScheduleError();
    const [reason, setReason] = useState('canceled_by_client');
    const [endedAt, setEndedAt] = useState(() => localToday());
    const mutation = useMutation({
        mutationFn: () => schedulesApi.end(schedule.id, { reason, ended_at: endedAt }),
        onSuccess: () => {
            toast.success(t('invoices.schedules.ended'));
            onOpenChange(false);
            onEnded();
        },
        onError,
    });
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('invoices.schedules.endTitle') }), _jsx(DialogDescription, { children: t('invoices.schedules.endDescription') })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: t('invoices.schedules.field.endReason') }), _jsxs(Select, { value: reason, onValueChange: (v) => setReason(v), children: [_jsx(SelectTrigger, { "data-testid": "end-schedule-reason", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: END_REASONS.map((value) => (_jsx(SelectItem, { value: value, children: t(`invoices.schedules.endReason.${value}`) }, value))) })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "end-schedule-date", children: t('invoices.schedules.field.endedAt') }), _jsx(Input, { id: "end-schedule-date", "data-testid": "end-schedule-date", type: "date", value: endedAt, onChange: (e) => setEndedAt(e.target.value) })] })] }), _jsxs(DialogFooter, { className: "gap-2", children: [_jsx(Button, { variant: "ghost", onClick: () => onOpenChange(false), children: t('common.cancel') }), _jsx(Button, { variant: "destructive", onClick: () => mutation.mutate(), disabled: mutation.isPending, "data-testid": "end-schedule-confirm", children: t('invoices.schedules.action.end') })] })] }) }));
}
function TermDialog({ open, onOpenChange, schedule, term, onSaved, }) {
    const { t } = useTranslation();
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const onError = useScheduleError();
    const { data: settings } = useQuery({
        queryKey: ['invoice-settings'],
        queryFn: invoicesApi.settings,
        enabled: open,
    });
    const source = term ?? schedule.next_term ?? schedule.current_term;
    const [effectiveFrom, setEffectiveFrom] = useState(term?.effective_from ?? schedule.next_period_start ?? localToday());
    const [lines, setLines] = useState(source ? source.lines.map((line) => ({ ...line })) : [{ description: '', quantity: '1', unit_price: '0' }]);
    const [discount, setDiscount] = useState(source?.discount ?? '');
    const perPeriod = linesTotal(lines) - Number(discount || 0);
    const mutation = useMutation({
        mutationFn: () => {
            const payload = { effective_from: effectiveFrom, lines, discount: discount || null };
            return term
                ? schedulesApi.updateTerm(schedule.id, term.id, payload)
                : schedulesApi.addTerm(schedule.id, payload);
        },
        onSuccess: () => {
            toast.success(t('invoices.schedules.termSaved'));
            onOpenChange(false);
            onSaved();
        },
        onError,
    });
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "flex flex-col max-h-[calc(100dvh-2rem)] sm:max-w-3xl", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: term ? t('invoices.schedules.terms.editTitle') : t('invoices.schedules.action.changePrice') }), _jsx(DialogDescription, { children: t('invoices.schedules.terms.changeDescription') })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "term-from", children: t('invoices.schedules.terms.effectiveFrom') }), _jsx(Input, { id: "term-from", "data-testid": "term-from-input", type: "date", value: effectiveFrom, onChange: (e) => setEffectiveFrom(e.target.value) }), schedule.next_period_start && (_jsx("p", { className: "text-[11px] text-muted-foreground", children: t('invoices.schedules.terms.nextPeriodHint', {
                                                date: new Date(`${schedule.next_period_start}T00:00:00`).toLocaleDateString(dateLocale),
                                            }) }))] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "term-discount", children: t('invoices.schedules.terms.discount') }), _jsx(Input, { id: "term-discount", "data-testid": "term-discount-input", inputMode: "decimal", value: discount, onChange: (e) => setDiscount(e.target.value), placeholder: "0.00" })] })] }), _jsx(InvoiceLineEditor, { lines: lines, onChange: setLines, currency: schedule.currency, showTax: (settings?.tax_fields ?? 'hidden') !== 'hidden', required: true }), _jsx("p", { className: "text-xs text-muted-foreground", "data-testid": "term-monthly-preview", children: t('invoices.schedules.terms.preview', {
                                period: formatCurrency(perPeriod, schedule.currency, locale),
                                monthly: formatCurrency(monthlyEquivalent(perPeriod, schedule.frequency), schedule.currency, locale),
                            }) })] }), _jsxs(DialogFooter, { className: "gap-2", children: [_jsx(Button, { variant: "ghost", onClick: () => onOpenChange(false), children: t('common.cancel') }), _jsx(Button, { onClick: () => mutation.mutate(), disabled: perPeriod <= 0 || !effectiveFrom || mutation.isPending, "data-testid": "term-save", children: t('common.save') })] })] }) }));
}
function LinkInvoiceDialog({ open, onOpenChange, schedule, onLinked, }) {
    const { t } = useTranslation();
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const { mask } = usePrivacyMode();
    const onError = useScheduleError();
    const { data: settings } = useQuery({
        queryKey: ['invoice-settings'],
        queryFn: invoicesApi.settings,
        enabled: open,
    });
    const { data: periods = [] } = useQuery({
        queryKey: ['invoice-schedule-periods', schedule.id],
        queryFn: () => schedulesApi.periods(schedule.id, 3),
        enabled: open,
    });
    // Same client, same currency, not yet part of any agreement: the
    // only invoices that could answer for a period of this one.
    const { data: candidates = [] } = useQuery({
        queryKey: ['invoices', 'linkable', schedule.id],
        queryFn: () => invoicesApi.list({
            ...(schedule.payee_id ? { payee_id: schedule.payee_id } : {}),
            limit: 500,
        }),
        select: (rows) => rows.filter((invoice) => !invoice.schedule_id && invoice.status !== 'void' && invoice.currency === schedule.currency),
        enabled: open,
    });
    const [invoiceId, setInvoiceId] = useState('');
    const [periodStart, setPeriodStart] = useState('');
    const free = periods.filter((p) => !p.taken);
    const mutation = useMutation({
        mutationFn: () => schedulesApi.link(schedule.id, { invoice_id: invoiceId, period_start: periodStart }),
        onSuccess: () => {
            toast.success(t('invoices.schedules.linked'));
            onOpenChange(false);
            onLinked();
        },
        onError,
    });
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('invoices.schedules.linkTitle') }), _jsx(DialogDescription, { children: t('invoices.schedules.linkDescription') })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: t('invoices.schedules.field.invoice') }), _jsxs(Select, { value: invoiceId, onValueChange: setInvoiceId, children: [_jsx(SelectTrigger, { "data-testid": "link-invoice-select", children: _jsx(SelectValue, { placeholder: t('invoices.schedules.field.invoicePlaceholder') }) }), _jsx(SelectContent, { children: candidates.map((invoice) => (_jsx(SelectItem, { value: invoice.id, children: (displayNumber(invoice, settings?.number_prefix) ?? t('invoices.noNumber')) +
                                                    ' · ' +
                                                    new Date(`${invoice.issue_date}T00:00:00`).toLocaleDateString(dateLocale) +
                                                    ' · ' +
                                                    mask(formatCurrency(Number(invoice.total), invoice.currency, locale)) }, invoice.id))) })] }), candidates.length === 0 && (_jsx("p", { className: "text-[11px] text-muted-foreground", children: t('invoices.schedules.noCandidates') }))] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { children: t('invoices.schedules.field.period') }), _jsxs(Select, { value: periodStart, onValueChange: setPeriodStart, children: [_jsx(SelectTrigger, { "data-testid": "link-period-select", children: _jsx(SelectValue, { placeholder: t('invoices.schedules.field.periodPlaceholder') }) }), _jsx(SelectContent, { children: free.map((period) => (_jsx(SelectItem, { value: period.period_start, children: periodLabel(period.period_start, period.period_end, dateLocale) }, period.sequence))) })] })] })] }), _jsxs(DialogFooter, { className: "gap-2", children: [_jsx(Button, { variant: "ghost", onClick: () => onOpenChange(false), children: t('common.cancel') }), _jsxs(Button, { onClick: () => mutation.mutate(), disabled: !invoiceId || !periodStart || mutation.isPending, "data-testid": "link-invoice-submit", children: [_jsx(Plus, { className: "h-4 w-4 mr-1.5" }), t('invoices.schedules.action.link')] })] })] }) }));
}
