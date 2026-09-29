import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAccountName, sortAccountsByDisplayName } from '../lib/account-utils.js';
import { useTranslation } from 'react-i18next';
import { useDisplayLocale, useDateLocale } from '../hooks/use-display-locale.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactions as transactionsApi, accounts as accountsApi, categories as categoriesApi, categoryGroups as categoryGroupsApi } from '../lib/api.js';
import { invalidateFinancialQueries } from '../lib/invalidate-queries.js';
import { toast } from 'sonner';
import { Button } from '../components/ui/button.js';
import { Label } from '../components/ui/label.js';
import { Upload, FileText, X, CheckCircle2, AlertCircle, Settings2, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog.js';
import { PageHeader } from '../components/page-header.js';
import { AssetImportPanel } from '../components/asset-import-panel.js';
import { ImportSummaryBar } from '../components/import-summary-bar.js';
import { ImportReviewTable } from '../components/import-review-table.js';
import { ImportHistory } from '../components/import-history.js';
import { useAuth } from '../contexts/auth-context.js';
import { useWorkspace } from '../contexts/workspace-context.js';
const TYPE_LABELS = {
    checking: 'accounts.typeChecking',
    savings: 'accounts.typeSavings',
    credit_card: 'accounts.typeCreditCard',
    investment: 'accounts.typeInvestment',
};
// Securo fields a CSV column can be mapped to, in display order.
const CSV_MAPPING_FIELDS = [
    { key: 'date', label: 'import.mapDate' },
    { key: 'description', label: 'import.mapDescription' },
    { key: 'amount', label: 'import.mapAmount' },
    { key: 'type', label: 'import.mapType' },
    { key: 'category', label: 'import.mapCategory' },
    { key: 'currency', label: 'import.mapCurrency' },
    { key: 'fx_rate', label: 'import.mapFxRate' },
    { key: 'payee', label: 'import.mapPayee' },
    { key: 'external_id', label: 'import.mapExternalId' },
    { key: 'notes', label: 'import.mapNotes' },
];
function toReviewTransactions(txns) {
    return txns.map((tx, i) => ({
        ...tx,
        _id: tx.external_id ? `${tx.external_id}-${i}` : `idx-${i}`,
        excluded: false,
        selected_category_id: undefined,
    }));
}
function TransactionImportPanel() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { canWrite } = useWorkspace();
    const userCurrency = user?.preferences?.currency_display ?? 'USD';
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const queryClient = useQueryClient();
    const fileInputRef = useRef(null);
    const [previewData, setPreviewData] = useState(null);
    const [reviewTransactions, setReviewTransactions] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const [fileName, setFileName] = useState(null);
    const [currentFile, setCurrentFile] = useState(null);
    const [csvHeaders, setCsvHeaders] = useState([]);
    const [isFailedRowsOpen, setIsFailedRowsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategoryIds, setFilterCategoryIds] = useState([]);
    const [filterUncategorized, setFilterUncategorized] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [csvDateFormat, setCsvDateFormat] = useState('');
    const [csvFlipAmount, setCsvFlipAmount] = useState(false);
    const [csvDetectDuplicates, setCsvDetectDuplicates] = useState(true);
    const [csvSplitColumns, setCsvSplitColumns] = useState(false);
    const [csvInflowColumn, setCsvInflowColumn] = useState('');
    const [csvOutflowColumn, setCsvOutflowColumn] = useState('');
    const [csvColumnMapping, setCsvColumnMapping] = useState({});
    const { data: accountsList } = useQuery({
        queryKey: ['accounts'],
        queryFn: () => accountsApi.list(),
    });
    const { data: categoriesList = [] } = useQuery({
        queryKey: ['categories'],
        queryFn: categoriesApi.list,
    });
    const { data: categoryGroupsList = [] } = useQuery({
        queryKey: ['category-groups'],
        queryFn: categoryGroupsApi.list,
    });
    const previewMutation = useMutation({
        mutationFn: ({ file, options }) => transactionsApi.previewImport(file, options),
        onSuccess: (data) => {
            setPreviewData(data);
            setCsvHeaders(data.csv_columns ?? []);
            setReviewTransactions(toReviewTransactions(data.transactions));
            setSearchQuery('');
            setFilterCategoryIds([]);
            setFilterUncategorized(false);
            setStatusFilter('all');
            setCurrentPage(1);
        },
        onError: (error) => {
            const detail = error?.response?.data?.detail;
            toast.error(detail || t('import.processError'));
        },
    });
    const importMutation = useMutation({
        mutationFn: () => {
            const txns = reviewTransactions.map(rt => ({
                description: rt.description,
                amount: rt.amount,
                date: rt.date,
                type: rt.type,
                external_id: rt.external_id ?? undefined,
                currency: rt.currency ?? undefined,
                fx_rate: rt.fx_rate ?? undefined,
                payee_raw: rt.payee_raw ?? undefined,
                notes: rt.notes ?? undefined,
                category_name: rt.category_name ?? undefined,
                excluded: rt.excluded,
                category_id: rt.selected_category_id !== undefined
                    ? (rt.selected_category_id ?? undefined)
                    : undefined,
                force_uncategorized: rt.selected_category_id === null,
            }));
            return transactionsApi.import(selectedAccount, txns, fileName ?? '', previewData.detected_format, isCsvFile ? { detect_duplicates: csvDetectDuplicates } : undefined);
        },
        onSuccess: (data) => {
            invalidateFinancialQueries(queryClient);
            queryClient.invalidateQueries({ queryKey: ['import-logs'] });
            queryClient.invalidateQueries({ queryKey: ['payees'] });
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            const hasSkippedOrExcluded = (data.skipped ?? 0) > 0 || (data.excluded ?? 0) > 0;
            const msg = hasSkippedOrExcluded
                ? t('import.importedWithExcluded', { imported: data.imported, skipped: data.skipped ?? 0, excluded: data.excluded ?? 0 })
                : `${data.imported} ${t('import.transactionsImported')}`;
            toast.success(msg);
            setPreviewData(null);
            setReviewTransactions([]);
            setSelectedAccount('');
            setFileName(null);
            setCurrentFile(null);
            resetCsvOptions();
            if (fileInputRef.current)
                fileInputRef.current.value = '';
        },
        onError: (error) => {
            const detail = error?.response?.data?.detail;
            toast.error(detail || t('import.importError'));
        },
    });
    function resetCsvOptions() {
        setCsvDateFormat('');
        setCsvFlipAmount(false);
        setCsvDetectDuplicates(true);
        setCsvSplitColumns(false);
        setCsvInflowColumn('');
        setCsvOutflowColumn('');
        setCsvColumnMapping({});
        setCsvHeaders([]);
    }
    function processFile(file) {
        setFileName(file.name);
        setCurrentFile(file);
        resetCsvOptions();
        // CSV headers come back from the preview response (csv_columns), which
        // parses the file server-side and handles any delimiter/quoting.
        previewMutation.mutate({ file });
    }
    // Re-run the preview with the current CSV options. Accepts overrides so a
    // change handler can pass its new value synchronously instead of waiting
    // for the corresponding state update to flush.
    const rePreview = useCallback((overrides) => {
        if (!currentFile)
            return;
        const dateFormat = overrides?.date_format ?? csvDateFormat;
        const flip = overrides?.flip_amount ?? csvFlipAmount;
        const split = overrides?.split ?? csvSplitColumns;
        const inflow = overrides?.inflow ?? csvInflowColumn;
        const outflow = overrides?.outflow ?? csvOutflowColumn;
        const mapping = overrides?.mapping ?? csvColumnMapping;
        const options = {};
        if (dateFormat)
            options.date_format = dateFormat;
        if (flip)
            options.flip_amount = true;
        if (split && inflow && outflow) {
            options.inflow_column = inflow;
            options.outflow_column = outflow;
        }
        const cleanMapping = Object.fromEntries(Object.entries(mapping).filter(([, v]) => v));
        if (Object.keys(cleanMapping).length > 0)
            options.column_mapping = cleanMapping;
        previewMutation.mutate({ file: currentFile, options });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentFile, csvDateFormat, csvFlipAmount, csvSplitColumns, csvInflowColumn, csvOutflowColumn, csvColumnMapping]);
    const handleMappingChange = useCallback((field, column) => {
        setCsvColumnMapping(prev => {
            const next = { ...prev, [field]: column };
            rePreview({ mapping: next });
            return next;
        });
    }, [rePreview]);
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file)
            processFile(file);
    };
    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file)
            processFile(file);
    };
    const handleReset = () => {
        setPreviewData(null);
        setReviewTransactions([]);
        setFileName(null);
        setCurrentFile(null);
        setSelectedAccount('');
        resetCsvOptions();
        if (fileInputRef.current)
            fileInputRef.current.value = '';
    };
    const handleToggleExcluded = useCallback((id) => {
        setReviewTransactions(prev => prev.map(t => t._id === id ? { ...t, excluded: !t.excluded } : t));
    }, []);
    const handleChangeCategory = useCallback((id, categoryId) => {
        setReviewTransactions(prev => prev.map(t => t._id === id ? { ...t, selected_category_id: categoryId } : t));
    }, []);
    const isCsvFile = fileName?.toLowerCase().endsWith('.csv') ?? false;
    // QIF dates are ambiguous for days 1-12 (DD/MM vs MM/DD), so the file
    // options panel is shown for QIF too, limited to the date-format selector.
    const isQifFile = fileName?.toLowerCase().endsWith('.qif') ?? false;
    const incomeCount = previewData?.transactions.filter(t => t.type === 'credit').length ?? 0;
    const expenseCount = previewData?.transactions.filter(t => t.type === 'debit').length ?? 0;
    const includedCount = reviewTransactions.filter(t => !t.excluded).length;
    return (_jsxs("div", { className: "space-y-6", children: [canWrite && _jsxs("div", { className: `bg-card rounded-xl border-2 border-dashed transition-all cursor-pointer ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-border'}`, onDragOver: (e) => { e.preventDefault(); setDragOver(true); }, onDragLeave: () => setDragOver(false), onDrop: handleDrop, onClick: () => !previewMutation.isPending && fileInputRef.current?.click(), children: [_jsx("input", { ref: fileInputRef, type: "file", accept: ".ofx,.qfx,.csv,.qif,.xml,.camt", onChange: handleFileChange, className: "hidden" }), _jsx("div", { className: "flex flex-col items-center justify-center py-12 px-6 text-center", children: previewMutation.isPending ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 animate-pulse", children: _jsx(FileText, { size: 22, className: "text-primary" }) }), _jsx("p", { className: "text-sm font-semibold text-foreground", children: t('import.processing') }), _jsx("p", { className: "text-xs text-muted-foreground mt-1", children: fileName })] })) : fileName && previewData ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4", children: _jsx(CheckCircle2, { size: 22, className: "text-emerald-500" }) }), _jsx("p", { className: "text-sm font-semibold text-foreground", children: fileName }), _jsx("p", { className: "text-xs text-muted-foreground mt-1", children: t('import.previewInfo', { count: previewData.transactions.length, format: previewData.detected_format.toUpperCase() }) }), _jsxs("button", { className: "mt-3 text-xs text-muted-foreground hover:text-rose-500 transition-colors flex items-center gap-1", onClick: (e) => { e.stopPropagation(); handleReset(); }, children: [_jsx(X, { size: 12 }), " ", t('import.removeFile')] })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4", children: _jsx(Upload, { size: 22, className: "text-muted-foreground" }) }), _jsx("p", { className: "text-sm font-semibold text-foreground mb-1", children: t('import.dragOrClick') }), _jsx("p", { className: "text-xs text-muted-foreground", children: t('import.acceptedFormats') }), _jsxs("button", { className: "mt-2 text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1", onClick: (e) => {
                                        e.stopPropagation();
                                        const csv = 'date,description,amount,currency,fx_rate\n2026-01-15,Grocery Store,-120.50,USD,\n2026-01-20,Salary Payment,5000.00,EUR,1.08\n';
                                        const blob = new Blob([csv], { type: 'text/csv' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = 'template.csv';
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    }, children: [_jsx(Download, { size: 12 }), t('import.downloadTemplate')] })] })) })] }), previewData && (_jsxs("div", { className: "bg-card rounded-xl border border-border shadow-sm overflow-hidden", children: [_jsx("div", { className: "px-5 py-4 border-b border-border", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: t('import.preview') }), _jsxs("div", { className: "flex items-center gap-3 text-xs text-muted-foreground", children: [_jsxs("span", { className: "flex items-center gap-1 text-emerald-600", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" }), t('import.incomeCount', { count: incomeCount })] }), _jsxs("span", { className: "flex items-center gap-1 text-rose-500", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" }), t('import.expenseCount', { count: expenseCount })] })] })] }) }), _jsx("div", { className: "px-4 sm:px-5 py-4 border-b border-border bg-muted/50", children: _jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4", children: [_jsx(Label, { className: "text-sm text-muted-foreground whitespace-nowrap shrink-0", children: t('import.importTo') }), _jsxs("select", { className: "flex-1 border border-border rounded-md px-3 py-2 text-sm bg-card focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]", value: selectedAccount, onChange: (e) => setSelectedAccount(e.target.value), children: [_jsx("option", { value: "", children: t('import.selectAccount') }), sortAccountsByDisplayName(accountsList ?? []).map((acc) => (_jsxs("option", { value: acc.id, children: [getAccountName(acc), " (", t(TYPE_LABELS[acc.type] || acc.type), ")"] }, acc.id)))] }), !selectedAccount && (_jsxs("div", { className: "flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1.5 rounded-lg shrink-0", children: [_jsx(AlertCircle, { size: 12 }), t('import.selectAccountWarning')] }))] }) }), (isCsvFile || isQifFile) && previewData && (_jsxs("div", { className: "px-5 py-4 border-b border-border bg-muted/30", children: [_jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx(Settings2, { size: 14, className: "text-muted-foreground" }), _jsx("p", { className: "text-xs font-medium text-muted-foreground", children: isCsvFile ? t('import.csvOptions') : t('import.importOptions') })] }), previewData.parse_error && (_jsxs("div", { className: "flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg mb-3", children: [_jsx(AlertCircle, { size: 14, className: "shrink-0 mt-0.5" }), _jsx("span", { children: t('import.mappingNeeded') })] })), previewData.failed_rows && previewData.failed_rows.length > 0 && (_jsxs("div", { className: "flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg mb-3", children: [_jsx(AlertCircle, { size: 14, className: "shrink-0 mt-0.5" }), _jsxs("div", { className: "flex-1", children: [_jsx("span", { children: t('import.failedRowsWarning', { count: previewData.failed_rows.length }) }), _jsx("button", { type: "button", className: "ml-2 font-semibold underline hover:text-amber-800 focus:outline-none", onClick: () => setIsFailedRowsOpen(true), children: t('import.viewDetails') })] })] })), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx(Label, { className: "text-xs text-muted-foreground mb-1 block", children: t('import.dateFormat') }), _jsxs("select", { className: "w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary", value: csvDateFormat, onChange: (e) => { setCsvDateFormat(e.target.value); rePreview({ date_format: e.target.value }); }, children: [_jsx("option", { value: "", children: t('import.dateFormatAuto') }), _jsx("option", { value: "DD/MM/YYYY", children: "DD/MM/YYYY" }), _jsx("option", { value: "MM/DD/YYYY", children: "MM/DD/YYYY" }), _jsx("option", { value: "YYYY-MM-DD", children: "YYYY-MM-DD" })] })] }), isCsvFile && _jsxs("div", { className: "flex items-center gap-2 pt-4", children: [_jsx("input", { type: "checkbox", id: "flip-amount", checked: csvFlipAmount, onChange: (e) => { setCsvFlipAmount(e.target.checked); rePreview({ flip_amount: e.target.checked }); }, className: "rounded border-border text-primary focus:ring-primary" }), _jsx(Label, { htmlFor: "flip-amount", className: "text-sm text-muted-foreground cursor-pointer", children: t('import.flipAmounts') })] }), isCsvFile && _jsxs("div", { className: "flex items-center gap-2 pt-4", children: [_jsx("input", { type: "checkbox", id: "split-columns", checked: csvSplitColumns, onChange: (e) => { setCsvSplitColumns(e.target.checked); rePreview({ split: e.target.checked }); }, className: "rounded border-border text-primary focus:ring-primary" }), _jsx(Label, { htmlFor: "split-columns", className: "text-sm text-muted-foreground cursor-pointer", children: t('import.splitColumns') })] }), isCsvFile && _jsxs("div", { className: "flex items-center gap-2 pt-4", children: [_jsx("input", { type: "checkbox", id: "detect-duplicates", checked: csvDetectDuplicates, onChange: (e) => setCsvDetectDuplicates(e.target.checked), className: "rounded border-border text-primary focus:ring-primary" }), _jsx(Label, { htmlFor: "detect-duplicates", className: "text-sm text-muted-foreground cursor-pointer", children: t('import.detectDuplicates') })] })] }), csvSplitColumns && csvHeaders.length > 0 && (_jsxs("div", { className: "grid grid-cols-2 gap-4 my-3", children: [_jsxs("div", { children: [_jsx(Label, { className: "text-xs text-muted-foreground mb-1 block", children: t('import.inflowColumn') }), _jsxs("select", { className: "w-full border border-border rounded-md px-3 py-1.5 text-sm bg-card focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]", value: csvInflowColumn, onChange: (e) => { setCsvInflowColumn(e.target.value); rePreview({ inflow: e.target.value }); }, children: [_jsx("option", { value: "", children: t('import.selectColumn') }), csvHeaders.map(h => _jsx("option", { value: h, children: h }, h))] })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-xs text-muted-foreground mb-1 block", children: t('import.outflowColumn') }), _jsxs("select", { className: "w-full border border-border rounded-md px-3 py-1.5 text-sm bg-card focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]", value: csvOutflowColumn, onChange: (e) => { setCsvOutflowColumn(e.target.value); rePreview({ outflow: e.target.value }); }, children: [_jsx("option", { value: "", children: t('import.selectColumn') }), csvHeaders.map(h => _jsx("option", { value: h, children: h }, h))] })] })] })), csvHeaders.length > 0 && (_jsxs("div", { className: "mt-4 pt-4 border-t border-border", children: [_jsx("p", { className: "text-xs font-medium text-muted-foreground", children: t('import.columnMapping') }), _jsx("p", { className: "text-xs text-muted-foreground mt-0.5 mb-3", children: t('import.columnMappingHint') }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3", children: CSV_MAPPING_FIELDS
                                            .filter((f) => !(csvSplitColumns && f.key === 'amount'))
                                            .map((f) => (_jsxs("div", { children: [_jsx(Label, { className: "text-xs text-muted-foreground mb-1 block", children: t(f.label) }), _jsxs("select", { className: "w-full border border-border rounded-md px-3 py-1.5 text-sm bg-card focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]", value: csvColumnMapping[f.key] ?? '', onChange: (e) => handleMappingChange(f.key, e.target.value), children: [_jsx("option", { value: "", children: t('import.columnAutoDetect') }), csvHeaders.map((h) => _jsx("option", { value: h, children: h }, h))] })] }, f.key))) })] }))] })), _jsx(ImportSummaryBar, { transactions: reviewTransactions, userCurrency: userCurrency, locale: locale }), _jsx(ImportReviewTable, { transactions: reviewTransactions, categories: categoriesList, groups: categoryGroupsList, userCurrency: userCurrency, locale: locale, dateLocale: dateLocale, searchQuery: searchQuery, filterCategoryIds: filterCategoryIds, filterUncategorized: filterUncategorized, statusFilter: statusFilter, currentPage: currentPage, onToggleExcluded: handleToggleExcluded, onChangeCategory: handleChangeCategory, onSearchChange: setSearchQuery, onCategoryIdsChange: setFilterCategoryIds, onUncategorizedChange: setFilterUncategorized, onStatusFilterChange: setStatusFilter, onPageChange: setCurrentPage }), _jsxs("div", { className: "px-4 sm:px-5 py-4 border-t border-border flex items-center justify-between", children: [_jsx("button", { className: "text-sm text-muted-foreground hover:text-foreground transition-colors", onClick: handleReset, children: t('common.cancel') }), _jsxs(Button, { onClick: () => importMutation.mutate(), disabled: !selectedAccount || importMutation.isPending || includedCount === 0, className: "gap-2", children: [_jsx(Upload, { size: 14 }), importMutation.isPending
                                        ? t('common.loading')
                                        : t('import.importButton', { count: includedCount })] })] })] })), _jsx(ImportHistory, { entity: "transactions" }), _jsx(Dialog, { open: isFailedRowsOpen, onOpenChange: setIsFailedRowsOpen, children: _jsxs(DialogContent, { className: "max-w-2xl max-h-[85vh] flex flex-col p-6", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { className: "text-base font-semibold", children: t('import.failedRowsTitle') }), _jsx(DialogDescription, { className: "text-xs text-muted-foreground mt-1", children: t('import.failedRowsDesc') })] }), _jsx("div", { className: "flex-1 border border-border rounded-lg overflow-hidden bg-card text-foreground mt-4 max-h-[50vh] overflow-y-auto", children: _jsxs("table", { className: "w-full text-left text-xs border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-muted text-muted-foreground border-b border-border sticky top-0", children: [_jsx("th", { className: "px-3 py-2 font-semibold w-16", children: t('import.lineNumber') }), _jsx("th", { className: "px-3 py-2 font-semibold", children: t('import.description') }), _jsx("th", { className: "px-3 py-2 font-semibold", children: t('import.rawValue') }), _jsx("th", { className: "px-3 py-2 font-semibold", children: t('import.errorReason') })] }) }), _jsx("tbody", { children: previewData?.failed_rows?.map((row, idx) => (_jsxs("tr", { className: "border-b border-border last:border-0 hover:bg-muted/50", children: [_jsx("td", { className: "px-3 py-2 text-muted-foreground", children: row.line_number }), _jsx("td", { className: "px-3 py-2 truncate max-w-[200px]", title: row.description, children: row.description || '-' }), _jsx("td", { className: "px-3 py-2 font-mono break-all max-w-[150px]", children: row.raw_value }), _jsx("td", { className: "px-3 py-2 text-amber-600 font-medium", children: t(`import.errors.${row.error_reason}`) })] }, idx))) })] }) }), _jsx(DialogFooter, { className: "mt-4 pt-4 border-t border-border flex justify-end", children: _jsx(Button, { onClick: () => setIsFailedRowsOpen(false), size: "sm", children: t('common.close') }) })] }) })] }));
}
/** Both importers live behind one menu entry: someone with a file to upload
    should not have to know first whether it holds transactions or orders. */
export default function ImportPage() {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = searchParams.get('tab') === 'investments' ? 'investments' : 'transactions';
    function selectTab(next) {
        const params = new URLSearchParams(searchParams);
        if (next === 'transactions')
            params.delete('tab');
        else
            params.set('tab', next);
        setSearchParams(params, { replace: true });
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(PageHeader, { section: t('import.title'), title: tab === 'investments' ? t('assetImport.title') : t('import.subtitle') }), _jsx("div", { className: "inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5", children: ['transactions', 'investments'].map((value) => (_jsx("button", { type: "button", onClick: () => selectTab(value), className: `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`, children: t(value === 'transactions' ? 'import.tabTransactions' : 'import.tabInvestments') }, value))) }), tab === 'investments' ? _jsx(AssetImportPanel, {}) : _jsx(TransactionImportPanel, {})] }));
}
