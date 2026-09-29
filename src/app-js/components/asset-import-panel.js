import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, AlertTriangle, CheckCircle2, Download, FileText, Info, Settings2, Upload, X } from 'lucide-react';
import { assets as assetsApi, assetGroups as assetGroupsApi } from '../lib/api.js';
import { ImportHistory } from './import-history.js';
import { Button } from './ui/button.js';
import { Label } from './ui/label.js';
import { useWorkspace } from '../contexts/workspace-context.js';
/** The Securo fields a CSV column can be mapped to; `*` marks the required ones. */
const MAPPABLE_FIELDS = [
    { key: 'ticker', required: true },
    { key: 'date', required: true },
    { key: 'quantity', required: true },
    { key: 'price', required: true },
    { key: 'fee', required: false },
    { key: 'kind', required: false },
    { key: 'currency', required: false },
    { key: 'notes', required: false },
];
const SELECT_CLASS = 'border border-border rounded-md px-3 py-2 text-sm bg-card focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]';
/**
 * The investments half of the import page.
 *
 * Deliberately built from the same pieces as the transaction importer: one
 * dashed drop zone that also carries the template link, then a result card
 * whose first strip picks the destination — the wallet here, the account
 * there. Two importers that look different teach the same person two habits.
 */
export function AssetImportPanel() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { canWrite } = useWorkspace();
    const fileInputRef = useRef(null);
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [mapping, setMapping] = useState({});
    const [groupId, setGroupId] = useState('');
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const { data: wallets } = useQuery({
        queryKey: ['asset-groups'],
        queryFn: assetGroupsApi.list,
    });
    async function runPreview(selected, nextMapping, nextGroup) {
        setLoading(true);
        try {
            const result = await assetsApi.previewImport(selected, {
                column_mapping: nextMapping,
                group_id: nextGroup || null,
            });
            setPreview(result);
        }
        catch {
            toast.error(t('assetImport.previewError'));
            setPreview(null);
        }
        finally {
            setLoading(false);
        }
    }
    function handleFile(selected) {
        setFile(selected);
        setPreview(null);
        setMapping({});
        if (selected)
            runPreview(selected, {}, groupId);
    }
    function handleReset() {
        handleFile(null);
        if (fileInputRef.current)
            fileInputRef.current.value = '';
    }
    function handleDrop(e) {
        e.preventDefault();
        setDragOver(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped)
            handleFile(dropped);
    }
    // Re-preview on every change, so the counts on screen always describe the
    // import that would actually run.
    function handleMappingChange(field, column) {
        const next = { ...mapping, [field]: column };
        if (!column)
            delete next[field];
        setMapping(next);
        if (file)
            runPreview(file, next, groupId);
    }
    function handleWalletChange(value) {
        setGroupId(value);
        if (file)
            runPreview(file, mapping, value);
    }
    async function handleImport() {
        if (!preview || preview.orders.length === 0)
            return;
        setImporting(true);
        try {
            const result = await assetsApi.importOrders(preview.orders, groupId || null, file?.name);
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            queryClient.invalidateQueries({ queryKey: ['asset-groups'] });
            queryClient.invalidateQueries({ queryKey: ['import-logs'] });
            toast.success(t('assetImport.imported', { count: result.imported }));
            navigate('/assets');
        }
        catch {
            toast.error(t('assetImport.importError'));
        }
        finally {
            setImporting(false);
        }
    }
    const importable = preview?.orders.length ?? 0;
    const rowErrors = preview?.errors ?? [];
    const walletWarnings = preview?.warnings ?? [];
    const needsMapping = !!preview?.parse_error;
    return (_jsxs("div", { className: "space-y-6", children: [canWrite && (_jsxs("div", { className: `cursor-pointer rounded-xl border-2 border-dashed bg-card transition-all ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-border'}`, onDragOver: (e) => { e.preventDefault(); setDragOver(true); }, onDragLeave: () => setDragOver(false), onDrop: handleDrop, onClick: () => !loading && fileInputRef.current?.click(), children: [_jsx("input", { ref: fileInputRef, type: "file", accept: ".csv,text/csv", className: "hidden", onChange: (e) => handleFile(e.target.files?.[0] ?? null) }), _jsx("div", { className: "flex flex-col items-center justify-center px-6 py-12 text-center", children: loading ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "mb-4 flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-primary/10", children: _jsx(FileText, { size: 22, className: "text-primary" }) }), _jsx("p", { className: "text-sm font-semibold text-foreground", children: t('assetImport.reading') }), _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: file?.name })] })) : file && preview && !needsMapping ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100", children: _jsx(CheckCircle2, { size: 22, className: "text-emerald-500" }) }), _jsx("p", { className: "text-sm font-semibold text-foreground", children: file.name }), _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: t('assetImport.summaryOrders', { count: importable }) }), _jsxs("button", { className: "mt-3 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-rose-500", onClick: (e) => { e.stopPropagation(); handleReset(); }, children: [_jsx(X, { size: 12 }), " ", t('import.removeFile')] })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted", children: _jsx(Upload, { size: 22, className: "text-muted-foreground" }) }), _jsx("p", { className: "mb-1 text-sm font-semibold text-foreground", children: t('import.dragOrClick') }), _jsx("p", { className: "text-xs text-muted-foreground", children: t('assetImport.chooseHint') }), _jsxs("button", { className: "mt-2 flex items-center gap-1 text-xs text-primary transition-colors hover:text-primary/80", onClick: (e) => { e.stopPropagation(); assetsApi.importTemplate(); }, children: [_jsx(Download, { size: 12 }), t('assetImport.downloadTemplate')] })] })) })] })), needsMapping && (_jsxs("div", { className: "overflow-hidden rounded-xl border border-border bg-card shadow-sm", children: [_jsxs("div", { className: "flex items-center gap-2 border-b border-border bg-muted/30 px-5 py-4", children: [_jsx(Settings2, { size: 14, className: "text-muted-foreground" }), _jsx("p", { className: "text-xs font-medium text-muted-foreground", children: t('assetImport.mapPrompt') })] }), _jsx("div", { className: "grid gap-3 p-5 sm:grid-cols-2", children: MAPPABLE_FIELDS.map(({ key, required }) => (_jsxs("div", { className: "grid gap-1", children: [_jsxs(Label, { htmlFor: `map-${key}`, className: "text-xs", children: [t(`assetImport.field.${key}`), required ? ' *' : ''] }), _jsxs("select", { id: `map-${key}`, className: SELECT_CLASS, value: mapping[key] ?? '', onChange: (e) => handleMappingChange(key, e.target.value), children: [_jsx("option", { value: "", children: t('assetImport.ignoreColumn') }), (preview?.csv_columns ?? []).map((col) => (_jsx("option", { value: col, children: col }, col)))] })] }, key))) })] })), preview && !needsMapping && (_jsxs("div", { className: "overflow-hidden rounded-xl border border-border bg-card shadow-sm", children: [_jsx("div", { className: "border-b border-border px-4 py-4 sm:px-5", children: _jsxs("div", { className: "flex flex-wrap items-center gap-x-4 gap-y-1 text-sm", children: [_jsx("span", { className: "font-semibold text-foreground", children: t('assetImport.summaryOrders', { count: importable }) }), _jsx("span", { className: "text-xs text-muted-foreground", children: t('assetImport.summaryHoldings', {
                                        created: preview.holdings_created,
                                        matched: preview.holdings_matched,
                                    }) }), preview.skipped > 0 && (_jsx("span", { className: "text-xs text-muted-foreground", children: t('assetImport.summarySkipped', { count: preview.skipped }) }))] }) }), _jsx("div", { className: "border-b border-border bg-muted/50 px-4 py-4 sm:px-5", children: _jsxs("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4", children: [_jsx(Label, { htmlFor: "asset-import-wallet", className: "shrink-0 whitespace-nowrap text-sm text-muted-foreground", children: t('assetImport.importTo') }), _jsxs("select", { id: "asset-import-wallet", className: `flex-1 ${SELECT_CLASS}`, value: groupId, onChange: (e) => handleWalletChange(e.target.value), children: [_jsx("option", { value: "", children: t('assetImport.noWallet') }), (wallets ?? []).map((w) => (_jsx("option", { value: w.id, children: w.name }, w.id)))] })] }) }), walletWarnings.length > 0 && (_jsxs("div", { className: "border-b border-border bg-blue-50 px-4 py-3 dark:bg-blue-950 sm:px-5", children: [_jsxs("p", { className: "mb-2 flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300", children: [_jsx(Info, { size: 14 }), t('assetImport.walletWarningTitle')] }), _jsx("ul", { className: "space-y-1 text-xs text-blue-600 dark:text-blue-300/80", children: walletWarnings.map((w) => (_jsx("li", { children: t(`assetImport.warning.${w.reason}`, { ticker: w.ticker, wallet: w.wallet ?? '—' }) }, `${w.ticker}-${w.reason}`))) })] })), rowErrors.length > 0 && (_jsxs("div", { className: "border-b border-border bg-amber-500/10 px-4 py-3 sm:px-5", children: [_jsxs("p", { className: "mb-2 flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400", children: [_jsx(AlertTriangle, { size: 14 }), t('assetImport.rowsSkipped', { count: rowErrors.length })] }), _jsxs("ul", { className: "space-y-1 text-xs text-muted-foreground", children: [rowErrors.slice(0, 8).map((err) => (_jsxs("li", { children: [t('assetImport.rowError', {
                                                row: err.row,
                                                ticker: err.ticker ?? '—',
                                                reason: t(`assetImport.reason.${err.reason}`, err.reason),
                                            }), err.detail ? ` (${err.detail})` : ''] }, `${err.row}-${err.reason}`))), rowErrors.length > 8 && (_jsx("li", { children: t('assetImport.moreErrors', { count: rowErrors.length - 8 }) }))] })] })), importable > 0 && (_jsxs("div", { className: "overflow-x-auto", children: [_jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-muted/40 text-xs uppercase text-muted-foreground", children: _jsxs("tr", { children: [_jsx("th", { className: "px-3 py-2 text-left sm:px-5", children: t('assetImport.field.ticker') }), _jsx("th", { className: "px-3 py-2 text-left", children: t('assetImport.field.date') }), _jsx("th", { className: "px-3 py-2 text-left", children: t('assetImport.field.kind') }), _jsx("th", { className: "px-3 py-2 text-right", children: t('assetImport.field.quantity') }), _jsx("th", { className: "px-3 py-2 text-right", children: t('assetImport.field.price') }), _jsx("th", { className: "px-3 py-2 text-right sm:px-5", children: t('assetImport.field.fee') })] }) }), _jsx("tbody", { className: "divide-y divide-border", children: preview.orders.slice(0, 50).map((order) => (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-1.5 font-medium sm:px-5", children: order.ticker }), _jsx("td", { className: "px-3 py-1.5", children: order.date }), _jsx("td", { className: "px-3 py-1.5", children: _jsx("span", { className: order.kind === 'sell' ? 'text-rose-500' : 'text-emerald-500', children: t(`assetImport.kind.${order.kind}`) }) }), _jsx("td", { className: "px-3 py-1.5 text-right tabular-nums", children: order.quantity }), _jsx("td", { className: "px-3 py-1.5 text-right tabular-nums", children: order.price }), _jsx("td", { className: "px-3 py-1.5 text-right tabular-nums sm:px-5", children: order.fee })] }, order.row))) })] }), preview.orders.length > 50 && (_jsx("p", { className: "border-t border-border px-4 py-2 text-xs text-muted-foreground sm:px-5", children: t('assetImport.moreRows', { count: preview.orders.length - 50 }) }))] })), _jsxs("div", { className: "flex items-center justify-between gap-3 border-t border-border px-4 py-4 sm:px-5", children: [importable === 0 ? (_jsxs("span", { className: "flex items-center gap-1.5 text-xs text-amber-600", children: [_jsx(AlertCircle, { size: 12 }), t('assetImport.nothingToImport')] })) : (_jsx("span", {})), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", onClick: handleReset, children: [_jsx(X, { size: 14, className: "mr-1" }), t('common.cancel')] }), _jsxs(Button, { onClick: handleImport, disabled: importing || importable === 0, className: "gap-2", children: [_jsx(Upload, { size: 14 }), importing ? t('assetImport.importing') : t('assetImport.confirm', { count: importable })] })] })] })] })), _jsx(ImportHistory, { entity: "asset_orders" })] }));
}
