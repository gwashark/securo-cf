import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from './ui/button.js';
import { Label } from './ui/label.js';
import { TimezoneSelect } from './timezone-select.js';
import { admin } from '../lib/api.js';
const calendarQueryKeys = new Set([
    'accounts',
    'transactions',
    'recurring',
    'dashboard',
    'reports',
    'budgets',
    'goals',
    'assets',
    'asset-values',
    'asset-trend',
    'portfolio-trend',
    'fx-rates',
    'invoice',
    'invoices',
    'invoice-summary',
    'invoice-facets',
    'invoice-document',
    'reconciliation-suggestions',
    'timezones',
    'drill-down',
]);
/** The option that means "nothing saved, follow the server". */
const SERVER_DEFAULT = '';
export function TimezoneSettings() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState();
    const timezoneQuery = useQuery({
        queryKey: ['admin', 'timezone'],
        queryFn: admin.timezone,
    });
    const saveTimezone = useMutation({
        mutationFn: async (timezone) => {
            if (timezone === SERVER_DEFAULT)
                await admin.deleteSetting('timezone');
            else
                await admin.updateSetting('timezone', timezone);
            return timezone;
        },
        onSuccess: (timezone) => {
            queryClient.setQueryData(['admin', 'timezone'], (current) => current
                ? {
                    ...current,
                    saved: timezone === SERVER_DEFAULT ? null : timezone,
                    timezone: timezone === SERVER_DEFAULT ? current.fallback : timezone,
                }
                : current);
            setDraft(undefined);
            void queryClient.invalidateQueries({ queryKey: ['admin', 'timezone'] });
            void queryClient.invalidateQueries({
                predicate: ({ queryKey }) => calendarQueryKeys.has(String(queryKey[0])),
            });
            toast.success(t('admin.settings.updated'));
        },
        onError: () => toast.error(t('common.error')),
    });
    const setting = timezoneQuery.data;
    // A saved value the server cannot load is shown as what it is, so the
    // administrator sees the problem here and not only in the logs, and
    // picking anything else (the server default included) is a real change
    // that clears it.
    const savedIsBroken = !!setting?.saved && !setting.available.includes(setting.saved);
    const currentChoice = setting?.saved ?? SERVER_DEFAULT;
    const selectedChoice = draft ?? currentChoice;
    return (_jsxs("section", { className: "mb-8 rounded-xl border border-border/60 bg-card overflow-hidden", children: [_jsx("div", { className: "px-5 py-4 border-b border-border/40", children: _jsxs("div", { className: "flex items-center gap-2 mb-0.5", children: [_jsx(CalendarClock, { size: 15, className: "text-muted-foreground" }), _jsx("h2", { className: "text-sm font-semibold text-foreground", children: t('admin.settings.timezoneTitle') })] }) }), _jsxs("div", { className: "p-5 space-y-3", children: [_jsxs("div", { className: "space-y-1", children: [_jsx(Label, { htmlFor: "application-timezone", children: t('admin.settings.timezone') }), _jsx("p", { id: "application-timezone-help", className: "text-sm text-muted-foreground", children: t('admin.settings.timezoneHelp') })] }), timezoneQuery.isError ? (_jsxs("div", { role: "alert", className: "flex flex-wrap items-center gap-3 text-sm text-destructive", children: [_jsx("span", { children: t('common.error') }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => timezoneQuery.refetch(), children: t('common.retry') })] })) : !setting ? (_jsx("p", { role: "status", className: "text-sm text-muted-foreground", children: t('common.loading') })) : (_jsxs(_Fragment, { children: [savedIsBroken && (_jsxs("div", { role: "alert", className: "flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300", children: [_jsx(AlertTriangle, { size: 15, className: "mt-0.5 shrink-0" }), _jsx("span", { children: t('admin.settings.timezoneSavedInvalid', {
                                            value: setting.saved,
                                            zone: setting.timezone,
                                        }) })] })), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx(TimezoneSelect, { id: "application-timezone", "aria-describedby": "application-timezone-help", className: "h-10 w-80 max-w-full", disabled: saveTimezone.isPending, value: selectedChoice, onChange: setDraft, options: setting.available, emptyOption: t('admin.settings.timezoneServerDefault', { zone: setting.fallback }) }), _jsx(Button, { disabled: saveTimezone.isPending || draft === undefined || draft === currentChoice, onClick: () => draft !== undefined && saveTimezone.mutate(draft), children: saveTimezone.isPending ? t('common.loading') : t('common.save') })] })] }))] })] }));
}
