import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { History, Trash2 } from 'lucide-react';
import { importLogs as importLogsApi } from '../lib/api.js';
import { invalidateFinancialQueries } from '../lib/invalidate-queries.js';
import { formatCurrency } from '../lib/format.js';
import { useDisplayLocale, useDateLocale } from '../hooks/use-display-locale.js';
import { useAuth } from '../contexts/auth-context.js';
import { useWorkspace } from '../contexts/workspace-context.js';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from './ui/dialog.js';
/**
 * Past imports, newest first, each removable.
 *
 * Deleting an entry is the undo: the server takes the rows back out, and for
 * orders it also recomputes the affected positions. The two entities share
 * this table but not its columns — an order import has no account and no
 * credit/debit totals, so those columns only appear for statements.
 */
export function ImportHistory({ entity }) {
    const { t } = useTranslation();
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { canWrite } = useWorkspace();
    const userCurrency = user?.preferences?.currency_display ?? 'USD';
    const [deleteTarget, setDeleteTarget] = useState(null);
    const { data: logs = [] } = useQuery({
        queryKey: ['import-logs'],
        queryFn: importLogsApi.list,
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => importLogsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['import-logs'] });
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            invalidateFinancialQueries(queryClient);
            setDeleteTarget(null);
            toast.success(t('import.undone'));
        },
        onError: () => toast.error(t('common.error')),
    });
    const rows = logs.filter((log) => (log.entity ?? 'transactions') === entity);
    const isStatement = entity === 'transactions';
    return (_jsxs("div", { className: "mt-8", children: [_jsxs("div", { className: "mb-4 flex items-center gap-2", children: [_jsx(History, { className: "h-5 w-5 text-muted-foreground" }), _jsx("h2", { className: "text-lg font-semibold text-foreground", children: t('import.history') })] }), rows.length === 0 ? (_jsx("div", { className: "rounded-xl border border-border bg-card p-8 text-center text-muted-foreground", children: t('import.noHistory') })) : (_jsx("div", { className: "overflow-hidden rounded-xl border border-border bg-card shadow-sm", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-border", children: [_jsx("th", { className: "px-3 py-3 text-left font-medium text-muted-foreground sm:px-4", children: t('import.historyDate') }), _jsx("th", { className: "px-3 py-3 text-left font-medium text-muted-foreground sm:px-4", children: t('import.historyFile') }), _jsx("th", { className: "hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell", children: t('import.historyFormat') }), isStatement && (_jsx("th", { className: "hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell", children: t('import.historyAccount') })), _jsx("th", { className: "px-3 py-3 text-right font-medium text-muted-foreground sm:px-4", children: t('import.historyCount') }), isStatement && (_jsxs(_Fragment, { children: [_jsx("th", { className: "hidden px-4 py-3 text-right font-medium text-muted-foreground sm:table-cell", children: t('import.historyCredit') }), _jsx("th", { className: "hidden px-4 py-3 text-right font-medium text-muted-foreground sm:table-cell", children: t('import.historyDebit') })] })), _jsx("th", { className: "px-3 py-3 sm:px-4", "aria-label": t('common.more') })] }) }), _jsx("tbody", { className: "divide-y divide-border", children: rows.map((log) => (_jsxs("tr", { className: "hover:bg-muted", children: [_jsx("td", { className: "px-3 py-3 text-xs whitespace-nowrap text-muted-foreground sm:px-4 sm:text-sm", children: new Date(log.created_at).toLocaleString(dateLocale, { dateStyle: 'short', timeStyle: 'short' }) }), _jsx("td", { className: "max-w-[120px] truncate px-3 py-3 font-mono text-xs text-foreground sm:max-w-none sm:px-4", children: log.filename || '—' }), _jsx("td", { className: "hidden px-4 py-3 lg:table-cell", children: _jsx("span", { className: "rounded bg-muted px-2 py-0.5 font-mono text-xs uppercase text-muted-foreground", children: log.format || '—' }) }), isStatement && (_jsx("td", { className: "hidden px-4 py-3 text-muted-foreground md:table-cell", children: log.account_name || '—' })), _jsx("td", { className: "px-3 py-3 text-right text-foreground sm:px-4", children: log.transaction_count }), isStatement && (_jsxs(_Fragment, { children: [_jsx("td", { className: "hidden px-4 py-3 text-right font-medium text-emerald-600 sm:table-cell", children: formatCurrency(log.total_credit, log.account_currency ?? userCurrency, locale) }), _jsx("td", { className: "hidden px-4 py-3 text-right font-medium text-rose-600 sm:table-cell", children: formatCurrency(log.total_debit, log.account_currency ?? userCurrency, locale) })] })), _jsx("td", { className: "px-3 py-3 text-right sm:px-4", children: canWrite && (_jsx("button", { onClick: () => setDeleteTarget(log), className: "text-muted-foreground transition-colors hover:text-rose-500", "aria-label": t('import.undoImport'), title: t('import.undoImport'), children: _jsx(Trash2, { className: "h-4 w-4" }) })) })] }, log.id))) })] }) })), _jsx(Dialog, { open: !!deleteTarget, onOpenChange: (open) => !open && setDeleteTarget(null), children: _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('import.undoImport') }), _jsx(DialogDescription, { children: t(isStatement ? 'import.undoDescription' : 'import.undoOrdersDescription', {
                                        count: deleteTarget?.transaction_count,
                                        filename: deleteTarget?.filename || '—',
                                    }) })] }), _jsxs(DialogFooter, { children: [_jsx("button", { onClick: () => setDeleteTarget(null), className: "px-4 py-2 text-sm text-muted-foreground hover:text-foreground", children: t('common.cancel') }), _jsx("button", { onClick: () => deleteTarget && deleteMutation.mutate(deleteTarget.id), disabled: deleteMutation.isPending, className: "rounded-lg bg-rose-500 px-4 py-2 text-sm text-white hover:bg-rose-600 disabled:opacity-50", children: deleteMutation.isPending ? t('import.deleting') : t('import.deleteAll') })] })] }) })] }));
}
