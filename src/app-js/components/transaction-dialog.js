import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getAccountLabel, getAccountName, sortAccountsByDisplayName } from '../lib/account-utils.js';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useDateLocale, useDisplayLocale } from '../hooks/use-display-locale.js';
import { formatAmountInput, formatCurrency, parseAmountInput } from '../lib/format.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/auth-context.js';
import { currencies as currenciesApi, transactions as transactionsApi, settings as settingsApi, payees as payeesApi, rules as rulesApi, categories as categoriesApi, categoryGroups as categoryGroupsApi } from '../lib/api.js';
import { localDateString } from '../lib/date-utils.js';
import { invalidateFinancialQueries } from '../lib/invalidate-queries.js';
import { normalizeRuleMatchValue } from '../lib/rule-match-utils.js';
import { findCategoryReference, getRuleCategoryId } from '../lib/category-reference-utils.js';
import { flattenConditions, hasConditionGroups } from '../lib/rule-conditions.js';
import { cn, normalizeText } from '../lib/utils.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { DatePickerInput } from './ui/date-picker-input.js';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover.js';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from './ui/command.js';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, } from './ui/dialog.js';
import { AlertTriangle, ChevronDown, ChevronLeft, Download, Eye, EyeClosed, Paperclip, Upload, X, FileText, Plus, Unlink, SlidersHorizontal, ListPlus, Check } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from './ui/dropdown-menu.js';
import { CategorySelect } from './category-select.js';
import { PayeeSelect } from './payee-select.js';
import { RuleDialog } from './rule-dialog.js';
import { TransactionAttachments } from './transaction-attachments.js';
import { TransactionSplitsSection } from './transaction-splits-section.js';
import { buildInstallmentSeriesInput, hasNonStatusChange, isManualInstallmentSeriesRow } from '../lib/installment-series.js';
import { usePrivacyMode } from '../hooks/use-privacy-mode.js';
import { toast } from 'sonner';
function isImageType(contentType) {
    return contentType.startsWith('image/');
}
function canExtendRuleFromTransaction(rule) {
    // Rules that mix AND and OR are left out: appending a top-level condition —
    // and possibly flipping the rule to OR — would silently change what the
    // grouped rule matches. Those are edited from the rules page instead.
    if (hasConditionGroups(rule.conditions))
        return false;
    return rule.is_active && !!getRuleCategoryId(rule) && (rule.conditions_op === 'or' || rule.conditions.length <= 1);
}
/** Appends a "description contains" condition for this transaction, unless the
 * rule already has an equivalent one. Also flips a single-condition rule to OR
 * so the new condition extends the match instead of narrowing it. */
function buildExtendedRuleConditions(rule, description) {
    const newCondition = { field: 'description', op: 'contains', value: description };
    const isDuplicate = flattenConditions(rule.conditions).some(existing => existing.field === newCondition.field &&
        existing.op === newCondition.op &&
        normalizeRuleMatchValue(existing.value) === normalizeRuleMatchValue(newCondition.value));
    return {
        conditions: isDuplicate ? rule.conditions : [...rule.conditions, newCondition],
        conditionsOp: rule.conditions.length <= 1 ? 'or' : rule.conditions_op,
        isDuplicate,
    };
}
export function TransactionDialog({ open, onClose, transaction, categories, categoryGroups, accounts, recurringMatch, onSave, onDelete, onUnlinkTransfer, onIgnoreChanged, onCreateRule, loading, error, isSynced = false, duplicateDraft = null, formResetKey = 0, defaultAccountId, }) {
    const { t } = useTranslation();
    const [preview, setPreview] = useState(null);
    const [pendingInstallmentEdit, setPendingInstallmentEdit] = useState(null);
    const handlePreviewChange = useCallback((newPreview) => {
        setPreview(newPreview);
    }, []);
    if (!open && preview)
        setPreview(null);
    useEffect(() => () => {
        if (preview?.url)
            URL.revokeObjectURL(preview.url);
    }, [preview]);
    const handleDownloadPreview = async () => {
        if (!preview || !transaction)
            return;
        try {
            const url = await transactionsApi.attachments.downloadUrl(transaction.id, preview.attachmentId);
            const a = document.createElement('a');
            a.href = url;
            a.download = preview.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        catch {
            toast.error(t('common.error'));
        }
    };
    const isEditing = !!transaction;
    const hasPreview = isEditing && !!preview;
    const handleClose = () => {
        setPendingInstallmentEdit(null);
        onClose();
    };
    const handleSave = (data, recurringData, installmentData, pendingFiles, action) => {
        if (transaction &&
            isManualInstallmentSeriesRow(transaction) &&
            hasNonStatusChange(data, transaction)) {
            setPendingInstallmentEdit({ data, recurringData, installmentData, pendingFiles, action });
            return;
        }
        onSave(data, recurringData, installmentData, pendingFiles, action);
    };
    const submitInstallmentEdit = (scope) => {
        if (!pendingInstallmentEdit)
            return;
        const { data, recurringData, installmentData, pendingFiles, action } = pendingInstallmentEdit;
        onSave({ ...data, apply_to: scope }, recurringData, installmentData, pendingFiles, action);
        setPendingInstallmentEdit(null);
    };
    return (_jsxs(_Fragment, { children: [_jsx(Dialog, { open: open, onOpenChange: handleClose, children: _jsxs(DialogContent, { className: cn(
                    // Bound the dialog to the viewport (dvh accounts for mobile browser
                    // chrome) and make it a flex column so the inner scroll region works
                    // on small screens, not just at the sm: breakpoint (issue #286).
                    'transition-[max-width] duration-300 flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden', hasPreview ? 'sm:max-w-5xl max-w-2xl' : 'sm:max-w-2xl max-w-2xl'), children: [_jsxs("div", { className: isEditing
                                ? 'flex flex-col min-h-0 flex-1 sm:flex-row sm:flex-none sm:gap-0 sm:h-[80vh]'
                                : 'flex flex-col min-h-0 flex-1', children: [_jsxs("div", { className: isEditing
                                        ? 'flex flex-col min-w-0 min-h-0 flex-1 overflow-hidden sm:pr-6'
                                        : 'flex flex-col min-h-0 flex-1', children: [_jsx(DialogHeader, { className: "mb-4", children: _jsx(DialogTitle, { children: transaction ? t('common.edit') : t('transactions.addManual') }) }), _jsx(TransactionForm, { transaction: transaction, duplicateDraft: duplicateDraft, defaultAccountId: defaultAccountId, categories: categories, categoryGroups: categoryGroups, accounts: accounts, recurringMatch: recurringMatch, onSave: handleSave, onDelete: onDelete, onUnlinkTransfer: onUnlinkTransfer, onIgnoreChanged: onIgnoreChanged, onCreateRule: onCreateRule, onCancel: handleClose, loading: loading, error: error, isSynced: isSynced, onPreviewChange: handlePreviewChange, activePreviewId: preview?.attachmentId ?? null, hasPreview: hasPreview }, transaction?.id ?? `new-${formResetKey}`)] }), _jsx("div", { className: cn('hidden sm:flex shrink-0 border-l flex-col overflow-hidden transition-[width] duration-300 ease-in-out', hasPreview ? 'w-[420px]' : 'w-0 border-l-0'), children: preview && (_jsxs(_Fragment, { children: [_jsx("div", { className: "flex-1 overflow-hidden", children: preview.contentType === 'application/pdf' ? (_jsx("iframe", { src: `${preview.url}#toolbar=0&navpanes=0`, title: preview.filename, className: "w-full h-full border-0 bg-white" })) : isImageType(preview.contentType) ? (_jsx("div", { className: "flex items-center justify-center h-full p-4 bg-muted/30", children: _jsx("img", { src: preview.url, alt: preview.filename, className: "max-h-full max-w-full rounded object-contain" }) })) : null }), _jsxs("div", { className: "flex items-center gap-2 px-4 py-3 border-t text-sm shrink-0", children: [_jsx("button", { type: "button", className: "p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer", onClick: () => handlePreviewChange(null), title: t('common.closePreview'), children: _jsx(ChevronLeft, { size: 16 }) }), _jsx("span", { className: "flex-1 truncate font-medium", children: preview.filename }), _jsx("button", { type: "button", className: "p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer", onClick: handleDownloadPreview, title: t('common.download'), children: _jsx(Download, { size: 14 }) })] })] })) })] }), hasPreview && (_jsxs("div", { className: "sm:hidden fixed inset-0 z-[100] bg-background flex flex-col animate-in slide-in-from-right duration-200", children: [_jsx("div", { className: "flex-1 overflow-hidden", children: preview.contentType === 'application/pdf' ? (_jsx("iframe", { src: `${preview.url}#toolbar=0&navpanes=0`, title: preview.filename, className: "w-full h-full border-0 bg-white" })) : isImageType(preview.contentType) ? (_jsx("div", { className: "flex items-center justify-center h-full p-4 bg-muted/30", children: _jsx("img", { src: preview.url, alt: preview.filename, className: "max-h-full max-w-full rounded object-contain" }) })) : null }), _jsxs("div", { className: "flex items-center gap-2 px-4 py-3 border-t text-sm shrink-0", children: [_jsx("button", { type: "button", className: "p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer", onClick: () => handlePreviewChange(null), title: t('common.closePreview'), children: _jsx(ChevronLeft, { size: 18 }) }), _jsx("span", { className: "flex-1 truncate font-medium", children: preview.filename }), _jsx("button", { type: "button", className: "p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer", onClick: handleDownloadPreview, title: t('common.download'), children: _jsx(Download, { size: 16 }) })] })] }))] }) }), _jsx(Dialog, { open: !!pendingInstallmentEdit, onOpenChange: (scopeOpen) => {
                    if (!scopeOpen)
                        setPendingInstallmentEdit(null);
                }, children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('transactions.installmentScopeTitle') }) }), _jsx("p", { className: "text-sm text-muted-foreground", children: t('transactions.installmentScopeEditDesc') }), _jsxs(DialogFooter, { className: "flex-col sm:flex-row sm:justify-end gap-2", children: [_jsx(Button, { autoFocus: true, onClick: () => submitInstallmentEdit('this'), disabled: loading, className: "justify-center", children: loading ? t('common.loading') : t('transactions.installmentScopeThis') }), _jsx(Button, { variant: "outline", onClick: () => submitInstallmentEdit('future'), disabled: loading, className: "justify-center", children: t('transactions.installmentScopeFuture') }), _jsx(Button, { variant: "outline", onClick: () => submitInstallmentEdit('all'), disabled: loading, className: "justify-center", children: t('transactions.installmentScopeAll') })] })] }) })] }));
}
function TransactionForm({ transaction, duplicateDraft, defaultAccountId, categories, categoryGroups, accounts, recurringMatch, onSave, onDelete, onUnlinkTransfer, onIgnoreChanged, onCreateRule, onCancel, loading, error, isSynced, onPreviewChange, activePreviewId, hasPreview, }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { privacyMode, MASK } = usePrivacyMode();
    const userCurrency = user?.preferences?.currency_display ?? 'USD';
    const dateLocale = useDateLocale();
    const displayLocale = useDisplayLocale();
    const sortedAccounts = useMemo(() => sortAccountsByDisplayName(accounts), [accounts]);
    const { data: supportedCurrencies } = useQuery({
        queryKey: ['currencies'],
        queryFn: currenciesApi.list,
        staleTime: Infinity,
    });
    const { data: payeesList } = useQuery({
        queryKey: ['payees'],
        queryFn: payeesApi.list,
    });
    const seed = transaction ?? duplicateDraft;
    const [description, setDescription] = useState(seed?.description ?? '');
    // Amount fields hold display-locale strings (comma decimals on dot_comma),
    // so seeds from stored numbers go through formatAmountInput — a raw
    // toString() would read back through parseAmountInput with the dot taken
    // for a thousands separator.
    const [amount, setAmount] = useState(seed?.amount != null ? formatAmountInput(seed.amount, displayLocale, 8) : '');
    const [date, setDate] = useState(seed?.date ?? localDateString());
    const [type, setType] = useState(seed?.type ?? 'debit');
    const [status, setStatus] = useState(seed?.status ?? 'posted');
    // Opened from an account page, start in that account's currency.
    const [currency, setCurrency] = useState(seed?.currency
        ?? (defaultAccountId ? accounts.find(a => a.id === defaultAccountId)?.currency : undefined)
        ?? userCurrency);
    const [categoryId, setCategoryId] = useState(seed?.category_id ?? '');
    const [payeeId, setPayeeId] = useState(seed?.payee_id ?? '');
    const [accountId, setAccountId] = useState(seed?.account_id ?? defaultAccountId ?? sortedAccounts[0]?.id ?? '');
    const [notes, setNotes] = useState(seed?.notes ?? '');
    // Manual CC bucketing override (issue #92). Empty = auto. Visible only
    // when the selected account is a credit card.
    const [effectiveBillDate, setEffectiveBillDate] = useState(seed?.effective_bill_date ?? '');
    const [convertedAmount, setConvertedAmount] = useState(seed?.amount_primary != null ? formatAmountInput(seed.amount_primary, displayLocale, 8) : '');
    const [fxRate, setFxRate] = useState(seed?.fx_rate_used != null ? formatAmountInput(seed.fx_rate_used, displayLocale, 8) : '');
    const [hadInitialFx] = useState(!!transaction && (seed?.amount_primary != null || seed?.fx_rate_used != null));
    const [isRecurring, setIsRecurring] = useState(false);
    const [frequency, setFrequency] = useState('monthly');
    const [endDate, setEndDate] = useState('');
    // Manual installment series: when checked, the save handler
    // builds an InstallmentSeriesInput payload that repeats the transaction
    // as N parcels. Only count and frequency are asked for: each parcel uses
    // the transaction's own amount and status.
    const [isInstallment, setIsInstallment] = useState(false);
    const [installmentCount, setInstallmentCount] = useState('2');
    const [installmentFrequency, setInstallmentFrequency] = useState('monthly');
    // Optional split-with-group payload. `null` = leave splits as-is on
    // update, or no splits on create. The dedicated section component
    // owns its own UI state and surfaces a normalized payload here.
    // Seeded from the transaction's existing splits so the edit dialog
    // round-trips them rather than appearing empty.
    const [splitsValid, setSplitsValid] = useState(true);
    const [splits, setSplits] = useState(() => {
        const existing = seed?.splits;
        if (!existing || existing.length === 0)
            return null;
        return {
            share_type: existing[0].share_type ?? 'equal',
            splits: existing.map((s) => ({
                group_member_id: s.group_member_id,
                share_amount: s.share_amount,
                share_pct: s.share_pct,
            })),
        };
    });
    // Captured once at mount so we know whether to send an explicit clear
    // payload when the user toggles split off on a previously-split tx.
    const [hadInitialSplits] = useState(() => {
        const existing = seed?.splits;
        return !!(existing && existing.length > 0);
    });
    const isCreating = !transaction;
    const showConversion = currency !== userCurrency && !isSynced;
    // Privacy mode hides monetary values across the app, but the edit modal
    // surfaced the raw amount anyway (issue #323). Only existing transactions
    // carry a value worth hiding — when creating, the user must see what they
    // type. A reveal toggle keeps the field editable when needed.
    const [revealAmounts, setRevealAmounts] = useState(false);
    const canHideAmounts = privacyMode && !isCreating;
    const hideAmounts = canHideAmounts && !revealAmounts;
    const [pendingFiles, setPendingFiles] = useState([]);
    const [pendingDragOver, setPendingDragOver] = useState(false);
    const pendingFileInputRef = useRef(null);
    const pendingActionRef = useRef('save');
    const formRef = useRef(null);
    const descriptionRef = useRef(null);
    // Bank-synced descriptions are read-only and can be long; auto-grow the
    // textarea so the full text is always visible (issue #256).
    useEffect(() => {
        const el = descriptionRef.current;
        if (!el)
            return;
        el.style.height = 'auto';
        // border-box: add the border so scrollHeight content isn't clipped
        const border = el.offsetHeight - el.clientHeight;
        el.style.height = `${el.scrollHeight + border}px`;
    }, [description, isSynced]);
    const [isIgnored, setIsIgnored] = useState(seed?.is_ignored ?? false);
    const [excludeFromReports, setExcludeFromReports] = useState(seed?.exclude_from_pnl ?? false);
    const [togglingIgnore, setTogglingIgnore] = useState(false);
    const [recurringLinked, setRecurringLinked] = useState(seed?.recurring_transaction_id != null);
    const [unlinkingRecurring, setUnlinkingRecurring] = useState(false);
    const [addToRuleOpen, setAddToRuleOpen] = useState(false);
    const [extendRuleTarget, setExtendRuleTarget] = useState(null);
    const { data: rulesList, isLoading: rulesLoading } = useQuery({
        queryKey: ['rules'],
        queryFn: rulesApi.list,
        enabled: !!transaction && !!onCreateRule,
    });
    // Hidden categories can still be the target of an existing rule; the picker's
    // grouping and the rule editor's "current category" lookup both need them.
    const { data: allCategoriesList } = useQuery({
        queryKey: ['categories', 'management'],
        queryFn: categoriesApi.listIncludingHidden,
        enabled: !!transaction && !!onCreateRule,
    });
    const { data: allCategoryGroupsList } = useQuery({
        queryKey: ['categoryGroups', 'management'],
        queryFn: categoryGroupsApi.listIncludingHidden,
        enabled: !!transaction && !!onCreateRule,
    });
    const displayCategories = allCategoriesList ?? categories;
    const displayCategoryGroups = allCategoryGroupsList ?? categoryGroups;
    // Counterpart leg of a transfer. Fetched lazily so only transfer dialogs
    // pay for it — the list response carries just the shared pair id.
    const { data: transferPair } = useQuery({
        queryKey: ['transactions', transaction?.id, 'transfer-pair'],
        queryFn: () => transactionsApi.transferPair(transaction.id),
        enabled: !!transaction?.id && !!transaction?.transfer_pair_id,
    });
    const extendableRules = useMemo(() => (rulesList ?? []).filter(canExtendRuleFromTransaction), [rulesList]);
    // Picking an existing rule opens the same rich editor used for creating a
    // rule (RuleDialog), pre-filled with that rule's data plus the extra
    // "description contains" condition — instead of a separate, cut-down form.
    const extendRuleDialogProps = useMemo(() => {
        if (!extendRuleTarget || !transaction)
            return null;
        const { conditions, conditionsOp } = buildExtendedRuleConditions(extendRuleTarget, transaction.description);
        return {
            rule: { ...extendRuleTarget, conditions_op: conditionsOp },
            // The user is extending this rule specifically so it covers the
            // transaction they're editing right now, so default to applying the
            // rule's category to matching existing transactions (including this
            // one) instead of leaving it stuck on its old category.
            initialData: {
                conditions,
                applyToExisting: true,
                overwriteExistingCategories: true,
            },
        };
    }, [extendRuleTarget, transaction]);
    function handlePickRuleToExtend(rule) {
        if (transaction && buildExtendedRuleConditions(rule, transaction.description).isDuplicate) {
            toast.info(t('transactions.duplicateRuleCondition'));
        }
        setExtendRuleTarget(rule);
        setAddToRuleOpen(false);
    }
    const updateRuleMutation = useMutation({
        mutationFn: (data) => rulesApi.update(extendRuleTarget.id, data),
        onSuccess: (updatedRule) => {
            const targetCategoryId = getRuleCategoryId(updatedRule);
            if (targetCategoryId)
                setCategoryId(targetCategoryId);
            queryClient.invalidateQueries({ queryKey: ['rules'] });
            const applied = updatedRule.applied_count ?? 0;
            if (applied > 0) {
                invalidateFinancialQueries(queryClient);
            }
            setExtendRuleTarget(null);
            toast.success(applied > 0
                ? t('rules.updatedAndApplied', { count: applied })
                : t('transactions.addedToExistingRule'));
        },
        onError: () => {
            toast.error(t('common.error'));
        },
    });
    const handleToggleIgnore = async () => {
        if (!seed?.id || togglingIgnore)
            return;
        setTogglingIgnore(true);
        try {
            const updated = await transactionsApi.toggleIgnore(seed.id);
            setIsIgnored(updated.is_ignored);
            toast.success(updated.is_ignored
                ? t('transactions.ignoreSuccess')
                : t('transactions.unignoreSuccess'));
            onIgnoreChanged?.();
        }
        catch {
            toast.error(t('common.error'));
        }
        finally {
            setTogglingIgnore(false);
        }
    };
    const handleUnlinkRecurring = async () => {
        if (!seed?.id || unlinkingRecurring)
            return;
        setUnlinkingRecurring(true);
        try {
            await transactionsApi.unlinkRecurring(seed.id);
            setRecurringLinked(false);
            toast.success(t('transactions.recurringUnlinkSuccess'));
            onIgnoreChanged?.();
        }
        catch {
            toast.error(t('common.error'));
        }
        finally {
            setUnlinkingRecurring(false);
        }
    };
    const triggerSubmit = (action) => {
        pendingActionRef.current = action;
        formRef.current?.requestSubmit();
    };
    const showSaveVariants = isCreating && !isSynced;
    const { data: attachmentSettings } = useQuery({
        queryKey: ['settings', 'attachments'],
        queryFn: () => settingsApi.attachments(),
        staleTime: 5 * 60 * 1000,
        enabled: isCreating,
    });
    const allowedExtensions = useMemo(() => attachmentSettings?.allowed_extensions ?? ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'pdf'], [attachmentSettings?.allowed_extensions]);
    const maxFileSize = (attachmentSettings?.max_file_size_mb ?? 10) * 1024 * 1024;
    const maxAttachments = attachmentSettings?.max_attachments_per_transaction ?? 10;
    const addPendingFiles = useCallback((files) => {
        const fileArray = Array.from(files);
        setPendingFiles(prev => {
            let current = prev.length;
            const next = [...prev];
            for (const file of fileArray) {
                if (current >= maxAttachments) {
                    toast.error(t('transactions.attachmentMaxReached'));
                    break;
                }
                const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
                if (!allowedExtensions.includes(ext)) {
                    toast.error(t('transactions.attachmentTypeNotAllowed'));
                    continue;
                }
                if (file.size > maxFileSize) {
                    toast.error(t('transactions.attachmentTooLarge'));
                    continue;
                }
                next.push(file);
                current++;
            }
            return next;
        });
    }, [maxAttachments, allowedExtensions, maxFileSize, t]);
    const removePendingFile = (index) => {
        setPendingFiles(prev => prev.filter((_, i) => i !== index));
    };
    const handleConvertedAmountChange = (val) => {
        setConvertedAmount(val);
        const numVal = parseAmountInput(val, displayLocale);
        const numAmount = parseAmountInput(amount, displayLocale);
        // Zero is a valid converted amount; only the divisor must be non-zero.
        if (numVal != null && numAmount) {
            setFxRate(formatAmountInput(numVal / numAmount, displayLocale, 6));
        }
        else if (!val) {
            setFxRate('');
        }
    };
    const handleFxRateChange = (val) => {
        setFxRate(val);
        const numRate = parseAmountInput(val, displayLocale);
        const numAmount = parseAmountInput(amount, displayLocale);
        if (numRate != null && numAmount != null) {
            setConvertedAmount(formatAmountInput(numAmount * numRate, displayLocale));
        }
        else if (!val) {
            setConvertedAmount('');
        }
    };
    const handleAmountChange = (val) => {
        setAmount(val);
        const numAmount = parseAmountInput(val, displayLocale);
        const numRate = parseAmountInput(fxRate, displayLocale);
        if (numRate != null && numAmount != null) {
            setConvertedAmount(formatAmountInput(numAmount * numRate, displayLocale));
        }
    };
    const handleCurrencyChange = (val) => {
        setCurrency(val);
        if (val === userCurrency) {
            setConvertedAmount('');
            setFxRate('');
        }
    };
    return (_jsxs("form", { ref: formRef, onSubmit: (e) => {
            e.preventDefault();
            const action = pendingActionRef.current;
            pendingActionRef.current = 'save';
            // Amounts are typed under the display locale's separators (comma
            // decimals on dot_comma), so they must be read back the same way —
            // parseFloat would stop at the first comma and silently save the
            // wrong value.
            const parsedAmount = parseAmountInput(amount, displayLocale);
            if (!isSynced && parsedAmount == null) {
                toast.error(t('common.error'));
                return;
            }
            const fxFields = {};
            const parsedConverted = parseAmountInput(convertedAmount, displayLocale);
            const parsedFxRate = parseAmountInput(fxRate, displayLocale);
            // A conversion field left empty is optional, but a non-empty one
            // that doesn't parse must block the save like the amount does —
            // silently dropping it would persist a transaction missing the
            // conversion the user typed.
            if (showConversion &&
                ((convertedAmount && parsedConverted == null) || (fxRate && parsedFxRate == null))) {
                toast.error(t('common.error'));
                return;
            }
            if (showConversion && parsedConverted != null) {
                fxFields.amount_primary = parsedConverted;
            }
            if (showConversion && parsedFxRate != null) {
                fxFields.fx_rate_used = parsedFxRate;
            }
            if (showConversion && hadInitialFx && !convertedAmount && !fxRate) {
                fxFields.amount_primary = null;
                fxFields.fx_rate_used = null;
            }
            // Active CC account ⇒ surface effective_bill_date in the payload
            // (sent both for synced and manual edits since the user can hand-
            // correct the bucketing on either; null clears the override back to
            // auto bucketing).
            const selectedAcc = accounts.find(a => a.id === accountId);
            const isCcSelected = selectedAcc?.type === 'credit_card';
            const overridePayload = isCcSelected
                ? { effective_bill_date: effectiveBillDate || null }
                : {};
            // Splits ride along on the same payload — the backend treats a
            // missing `splits` field as untouched and a present payload as
            // full replacement. To clear existing splits when the user
            // toggles off, send an explicit empty payload.
            const splitsPayload = splits
                ? { splits }
                : hadInitialSplits
                    ? { splits: { share_type: 'equal', splits: [] } }
                    : {};
            const pnlExclusionPayload = transaction
                ? { exclude_from_pnl: excludeFromReports }
                : {};
            const txData = isSynced
                ? {
                    category_id: categoryId || null,
                    payee_id: payeeId || null,
                    notes: notes.trim() || null,
                    is_ignored: isIgnored,
                    ...pnlExclusionPayload,
                    ...overridePayload,
                    ...splitsPayload,
                }
                : {
                    description,
                    amount: parsedAmount ?? undefined,
                    date,
                    type,
                    currency,
                    category_id: categoryId || null,
                    payee_id: payeeId || null,
                    account_id: accountId || undefined,
                    notes: notes.trim() || null,
                    is_ignored: isIgnored,
                    ...pnlExclusionPayload,
                    // Creation defaults to "posted" server-side; the user can
                    // override to "pending" right in the form (date & status row).
                    status,
                    ...fxFields,
                    ...overridePayload,
                    ...splitsPayload,
                };
            const recurringData = isCreating && isRecurring
                ? { frequency, end_date: endDate || undefined }
                : undefined;
            const installmentData = isCreating && isInstallment && !isSynced
                ? buildInstallmentSeriesInput({
                    accountId,
                    categoryId,
                    payeeId,
                    description,
                    amount,
                    date,
                    type,
                    currency,
                    notes,
                    fxFields,
                    splits,
                    installmentCount,
                    installmentFrequency,
                    status,
                })
                : undefined;
            onSave(txData, recurringData, installmentData, isCreating && pendingFiles.length > 0 ? pendingFiles : undefined, action);
        }, className: cn(
        // Always a bounded flex column; the DialogContent caps the overall
        // height and this lets the body below scroll within it (issue #286).
        'flex flex-col flex-1 min-h-0', hasPreview && 'mt-4'), children: [_jsxs("div", { className: "space-y-4 overflow-y-auto flex-1 min-h-0 pb-2 sm:pr-3", children: [error && (_jsx("div", { className: "p-3 text-sm text-destructive bg-destructive/10 rounded-md", children: error })), isSynced && (_jsx("div", { className: "flex items-center gap-2 p-3 text-sm bg-amber-50 border border-amber-200 rounded-md text-amber-700", children: t('transactions.syncedInfo') })), !!transaction?.transfer_pair_id && (_jsx("div", { className: "p-3 text-sm bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md text-blue-700 dark:text-blue-300 space-y-2", children: _jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "space-y-1 min-w-0", children: [_jsx("p", { children: t('transactions.transferInfo') }), transferPair && (() => {
                                            const pairAccount = accounts.find(a => a.id === transferPair.account_id);
                                            const sign = transferPair.type === 'debit' ? '−' : '+';
                                            return (_jsxs("p", { className: "text-xs text-blue-600 dark:text-blue-300 truncate", children: [_jsx("span", { className: "font-medium", children: t('transactions.transferLinkedTo') }), ' ', pairAccount ? (_jsx(Link, { to: `/accounts/${pairAccount.id}`, onClick: (e) => {
                                                            // A modified click opens a new tab; keep the dialog and its edits.
                                                            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
                                                                return;
                                                            onCancel();
                                                        }, title: t('transactions.transferOpenAccount', { account: getAccountName(pairAccount) }), className: "underline underline-offset-2 hover:text-blue-800 dark:hover:text-blue-100", children: getAccountName(pairAccount) })) : '—', ' · ', new Date(transferPair.date + 'T00:00:00').toLocaleDateString(dateLocale), ' · ', sign, formatCurrency(Math.abs(Number(transferPair.amount)), transferPair.currency ?? undefined, displayLocale)] }));
                                        })(), _jsx("p", { className: "text-xs text-blue-500 dark:text-blue-400", children: t('transactions.transferTooltip') })] }), onUnlinkTransfer && transaction?.transfer_pair_id && (_jsxs("button", { type: "button", disabled: loading, onClick: () => {
                                        if (transaction?.transfer_pair_id) {
                                            onUnlinkTransfer(transaction.transfer_pair_id);
                                        }
                                    }, className: "shrink-0 inline-flex items-center gap-1.5 rounded-md border border-blue-200 dark:border-blue-800 bg-white/60 dark:bg-blue-900/40 px-2.5 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-200 hover:bg-white dark:hover:bg-blue-900/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors", title: t('transactions.unlinkTransferConfirm'), children: [_jsx(Unlink, { size: 12 }), t('transactions.unlinkTransfer')] }))] }) })), recurringMatch && (_jsx("div", { className: "flex items-center gap-2 p-3 text-sm bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md", children: _jsx("span", { children: t('transactions.recurringInfo', {
                                frequency: t(`recurring.${recurringMatch.frequency}`),
                                next: new Date(recurringMatch.next_occurrence).toLocaleDateString(dateLocale),
                            }) }) })), recurringLinked && !isCreating && (_jsxs("div", { className: "flex items-center justify-between gap-2 p-3 text-sm bg-muted/50 border border-border rounded-md", children: [_jsx("span", { className: "text-muted-foreground", children: t('transactions.recurringLinkedInfo') }), _jsxs(Button, { type: "button", variant: "outline", size: "sm", className: "gap-1.5 shrink-0", onClick: handleUnlinkRecurring, disabled: unlinkingRecurring, children: [_jsx(Unlink, { size: 14 }), t('transactions.recurringUnlinkAction')] })] })), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('transactions.description') }), isSynced ? (_jsx("textarea", { ref: descriptionRef, className: "w-full border border-input rounded-md px-3 py-2 text-sm bg-muted/40 text-muted-foreground resize-none overflow-hidden cursor-default outline-none focus:outline-none focus-visible:outline-none", value: description, readOnly: true, rows: 1 })) : (_jsx(Input, { value: description, onChange: (e) => setDescription(e.target.value), required: true, className: "bg-card" })), transaction?.original_description &&
                                transaction.original_description !== transaction.description && (_jsxs("p", { className: "text-xs text-muted-foreground", children: [t('transactions.originalDescription'), ": ", transaction.original_description] })), isSynced && transaction?.payee && transaction.payee !== transaction.description && (_jsx("p", { className: "text-xs text-muted-foreground", children: transaction.payee }))] }), _jsxs("div", { className: "grid grid-cols-2 gap-3 sm:gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between min-h-5", children: [_jsx(Label, { children: t('transactions.amount') }), canHideAmounts && (_jsx("button", { type: "button", onClick: () => setRevealAmounts((v) => !v), className: "text-muted-foreground hover:text-foreground transition-colors cursor-pointer", title: revealAmounts ? t('privacy.hide') : t('privacy.show'), "aria-label": revealAmounts ? t('privacy.hide') : t('privacy.show'), children: revealAmounts ? _jsx(EyeClosed, { size: 14 }) : _jsx(Eye, { size: 14 }) }))] }), hideAmounts ? (_jsx(Input, { type: "text", value: MASK, readOnly: true, tabIndex: -1, className: "bg-muted/40 text-muted-foreground cursor-default select-none" })) : (_jsx(Input, { type: "text", inputMode: "decimal", value: amount, onChange: (e) => handleAmountChange(e.target.value), required: true, disabled: isSynced, className: "bg-card" }))] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('transactions.currency') }), _jsx("select", { className: "w-full border border-border rounded-md px-3 py-2 text-sm bg-card h-9 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]", value: currency, onChange: (e) => handleCurrencyChange(e.target.value), disabled: isSynced, children: (supportedCurrencies ?? [{ code: userCurrency, symbol: userCurrency, name: userCurrency, flag: '' }]).map((c) => (_jsxs("option", { value: c.code, children: [c.flag, " ", c.name] }, c.code))) })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3 sm:gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('transactions.date') }), _jsx(DatePickerInput, { value: date, onChange: setDate, disabled: isSynced, className: "w-full justify-start" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('transactions.colStatus') }), _jsxs("select", { className: "w-full border border-border rounded-md px-3 py-2 text-sm bg-card h-9 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]", value: status, onChange: (e) => setStatus(e.target.value), disabled: isSynced, children: [_jsx("option", { value: "posted", children: t('transactions.statusPosted') }), _jsx("option", { value: "pending", children: t('transactions.statusPending') })] })] })] }), showConversion && (_jsxs("div", { className: "border border-border rounded-md p-3 space-y-2", children: [transaction?.fx_fallback && (_jsxs("div", { className: "flex items-start gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400", children: [_jsx(AlertTriangle, { size: 14, className: "mt-0.5 shrink-0" }), _jsx("span", { className: "text-xs", children: t('transactions.fxFallbackBanner') })] })), _jsxs("div", { children: [_jsx("span", { className: "text-sm font-medium", children: t('transactions.conversion') }), _jsxs("span", { className: "text-xs text-muted-foreground ml-2", children: ["(", t('transactions.conversionHint'), ")"] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsx(Label, { className: "text-xs", children: t('transactions.convertedAmount', { currency: userCurrency }) }), hideAmounts ? (_jsx(Input, { type: "text", value: MASK, readOnly: true, tabIndex: -1, className: "bg-muted/40 text-muted-foreground cursor-default select-none" })) : (_jsx(Input, { type: "text", inputMode: "decimal", value: convertedAmount, onChange: (e) => handleConvertedAmountChange(e.target.value), placeholder: t('transactions.autoCalculated'), className: "bg-card" }))] }), _jsxs("div", { className: "space-y-1", children: [_jsx(Label, { className: "text-xs", children: t('transactions.exchangeRate') }), _jsx(Input, { type: "text", inputMode: "decimal", value: fxRate, onChange: (e) => handleFxRateChange(e.target.value), placeholder: t('transactions.autoCalculated'), className: "bg-card" })] })] })] })), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('transactions.type') }), _jsxs("select", { className: "w-full border border-border rounded-md px-3 py-2 text-sm bg-card disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]", value: type, onChange: (e) => setType(e.target.value), disabled: isSynced, children: [_jsx("option", { value: "debit", children: t('transactions.expense') }), _jsx("option", { value: "credit", children: t('transactions.income') })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('transactions.category') }), _jsx(CategorySelect, { value: categoryId, onChange: setCategoryId, categories: displayCategories, groups: displayCategoryGroups, currentCategory: seed?.category, allowNone: true, creatable: true, className: "bg-card" })] })] }), _jsxs("div", { className: cn("grid gap-4", isSynced ? "grid-cols-1" : "grid-cols-2"), children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('payees.payee') }), _jsx(PayeeSelect, { value: payeeId, onChange: setPayeeId, payees: payeesList ?? [], creatable: true }), isSynced && transaction?.payee && (_jsxs("p", { className: "text-xs text-muted-foreground", children: [t('payees.rawPayee'), ": ", transaction.payee] }))] }), !isSynced && (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('transactions.account') }), _jsx("select", { className: "w-full border border-border rounded-md px-3 py-2 text-sm bg-card focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]", value: accountId, onChange: (e) => setAccountId(e.target.value), required: true, children: sortedAccounts.map((acc) => (_jsx("option", { value: acc.id, children: getAccountLabel(acc) }, acc.id))) })] }))] }), _jsxs("div", { className: "space-y-2", children: [_jsxs(Label, { children: [t('transactions.notes'), " ", _jsxs("span", { className: "text-muted-foreground font-normal text-xs", children: ["(", t('transactions.notesHint'), ")"] })] }), _jsx("textarea", { className: "w-full border border-input rounded-md px-3 py-2 text-sm bg-card resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0", rows: 2, value: notes, onChange: (e) => setNotes(e.target.value), placeholder: t('transactions.notesPlaceholder') })] }), transaction && (_jsxs("label", { className: "flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3", children: [_jsx("input", { type: "checkbox", className: "mt-0.5 h-4 w-4 rounded border-border accent-primary", checked: excludeFromReports, onChange: (event) => setExcludeFromReports(event.target.checked) }), _jsxs("span", { children: [_jsx("span", { className: "block text-sm font-medium", children: t('transactions.excludeFromReports') }), _jsx("span", { className: "block text-xs text-muted-foreground", children: t('transactions.excludeFromReportsHint') })] })] })), (() => {
                        const selectedAcc = accounts.find(a => a.id === accountId);
                        if (selectedAcc?.type !== 'credit_card')
                            return null;
                        return (_jsxs("div", { className: "space-y-2", children: [_jsxs(Label, { children: [t('transactions.effectiveBillDate', 'Effective bill date'), ' ', _jsxs("span", { className: "text-muted-foreground font-normal text-xs", children: ["(", t('transactions.effectiveBillDateHint', 'manual, overrides the automatic cycle'), ")"] })] }), _jsxs("div", { className: "inline-flex items-center gap-1", children: [_jsx(DatePickerInput, { value: effectiveBillDate, onChange: setEffectiveBillDate, placeholder: t('transactions.effectiveBillDatePlaceholder', 'Bill due date (optional)') }), effectiveBillDate && (_jsx("button", { type: "button", className: "h-9 w-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0", onClick: () => setEffectiveBillDate(''), title: t('transactions.clearOverride', 'Remover sobrescrição'), children: _jsx(X, { className: "h-4 w-4" }) }))] })] }));
                    })(), transaction?.source !== 'settlement' && (_jsx(TransactionSplitsSection, { amount: parseAmountInput(amount, displayLocale) ?? 0, currency: currency, value: splits, onChange: setSplits, onValidityChange: setSplitsValid })), !isCreating && transaction ? (_jsx(TransactionAttachments, { transactionId: transaction.id, onPreviewChange: onPreviewChange, activePreviewId: activePreviewId })) : isCreating && (_jsx(PendingAttachmentsSection, { files: pendingFiles, dragOver: pendingDragOver, maxAttachments: maxAttachments, allowedExtensions: allowedExtensions, fileInputRef: pendingFileInputRef, onDragOver: () => setPendingDragOver(true), onDragLeave: () => setPendingDragOver(false), onDrop: (e) => { e.preventDefault(); setPendingDragOver(false); if (e.dataTransfer.files?.length)
                            addPendingFiles(e.dataTransfer.files); }, onFileChange: (e) => { if (e.target.files?.length) {
                            addPendingFiles(e.target.files);
                            e.target.value = '';
                        } }, onRemove: removePendingFile })), isCreating && !isSynced && (_jsxs("div", { className: "space-y-3 border rounded-md p-3", children: [_jsxs("div", { className: "flex items-center gap-6", children: [_jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: isRecurring, onChange: (e) => {
                                                    setIsRecurring(e.target.checked);
                                                    if (e.target.checked)
                                                        setIsInstallment(false);
                                                }, className: "rounded border-gray-300" }), _jsx("span", { className: "text-sm font-medium", children: t('transactions.makeRecurring') })] }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: isInstallment, onChange: (e) => {
                                                    setIsInstallment(e.target.checked);
                                                    if (e.target.checked)
                                                        setIsRecurring(false);
                                                }, className: "rounded border-gray-300" }), _jsx("span", { className: "text-sm font-medium", children: t('transactions.makeInstallment') })] })] }), isRecurring && (_jsxs("div", { className: "grid grid-cols-2 gap-4 pt-1", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('recurring.frequency') }), _jsxs("select", { className: "w-full border border-border rounded-md px-3 py-2 text-sm bg-card focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]", value: frequency, onChange: (e) => setFrequency(e.target.value), children: [_jsx("option", { value: "monthly", children: t('recurring.monthly') }), _jsx("option", { value: "quarterly", children: t('recurring.quarterly') }), _jsx("option", { value: "semiannual", children: t('recurring.semiannual') }), _jsx("option", { value: "weekly", children: t('recurring.weekly') }), _jsx("option", { value: "biweekly", children: t('recurring.biweekly') }), _jsx("option", { value: "yearly", children: t('recurring.yearly') })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('recurring.endDate') }), _jsx(DatePickerInput, { value: endDate, onChange: setEndDate, placeholder: t('recurring.endDate'), className: "w-full justify-start" })] })] })), isInstallment && (_jsxs("div", { className: "grid grid-cols-2 gap-4 pt-1", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('transactions.installmentFrequency') }), _jsxs("select", { className: "w-full border border-border rounded-md px-3 py-2 text-sm bg-card focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]", value: installmentFrequency, onChange: (e) => setInstallmentFrequency(e.target.value), children: [_jsx("option", { value: "monthly", children: t('recurring.monthly') }), _jsx("option", { value: "quarterly", children: t('recurring.quarterly') }), _jsx("option", { value: "semiannual", children: t('recurring.semiannual') }), _jsx("option", { value: "weekly", children: t('recurring.weekly') }), _jsx("option", { value: "biweekly", children: t('recurring.biweekly') }), _jsx("option", { value: "yearly", children: t('recurring.yearly') })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('transactions.installmentCount') }), _jsx("input", { type: "number", min: 2, max: 360, className: "w-full border border-border rounded-md px-3 py-2 text-sm bg-card focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]", value: installmentCount, onChange: (e) => setInstallmentCount(e.target.value) })] })] }))] }))] }), _jsxs(DialogFooter, { className: cn('shrink-0 border-t pt-4 mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', !(onDelete || seed?.id) ? 'sm:justify-end' : ''), children: [_jsxs("div", { className: "flex min-w-0 flex-wrap gap-2 items-center", children: [onDelete && (_jsx(Button, { type: "button", variant: "destructive", onClick: onDelete, disabled: loading, className: "whitespace-nowrap text-xs sm:text-sm h-8 sm:h-9", children: t('common.delete') })), seed?.id && (_jsxs(Button, { type: "button", variant: isIgnored ? 'secondary' : 'outline', onClick: handleToggleIgnore, disabled: loading || togglingIgnore, title: t('transactions.ignoreTransferHint'), className: "gap-1.5 whitespace-nowrap text-xs sm:text-sm h-8 sm:h-9", children: [isIgnored ? _jsx(Eye, { size: 14 }) : _jsx(EyeClosed, { size: 14 }), isIgnored ? t('transactions.unignoreAction') : t('transactions.ignoreAction')] })), transaction && onCreateRule && (_jsxs("div", { className: "inline-flex", children: [_jsxs(Button, { type: "button", variant: "outline", onClick: () => onCreateRule(transaction), className: "gap-1.5 rounded-r-none whitespace-nowrap text-xs sm:text-sm h-8 sm:h-9", title: t('transactions.createRule'), children: [_jsx(SlidersHorizontal, { size: 14 }), t('transactions.createRule')] }), _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { type: "button", variant: "outline", "aria-label": t('transactions.ruleActions'), className: "rounded-l-none border-l-0 px-1.5 sm:px-2 has-[>svg]:px-1.5 sm:has-[>svg]:px-2 h-8 sm:h-9", disabled: updateRuleMutation.isPending, children: _jsx(ChevronDown, { size: 14 }) }) }), _jsx(DropdownMenuContent, { align: "start", className: "w-56", children: _jsxs(DropdownMenuItem, { onSelect: () => setAddToRuleOpen(true), children: [_jsx(ListPlus, { size: 16 }), t('transactions.addToExistingRule')] }) })] })] }))] }), _jsxs("div", { className: "flex flex-wrap gap-2 justify-end sm:ml-auto", children: [_jsx(Button, { type: "button", variant: "outline", onClick: onCancel, className: "whitespace-nowrap text-xs sm:text-sm h-8 sm:h-9", children: t('common.cancel') }), showSaveVariants ? (_jsxs("div", { className: "inline-flex", children: [_jsx(Button, { type: "submit", disabled: loading || !splitsValid, className: "rounded-r-none whitespace-nowrap text-xs sm:text-sm h-8 sm:h-9", children: loading ? t('common.loading') : t('common.save') }), _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { type: "button", disabled: loading || !splitsValid, "aria-label": t('transactions.moreSaveOptions'), className: "rounded-l-none border-l border-l-primary-foreground/20 px-1.5 sm:px-2 has-[>svg]:px-1.5 sm:has-[>svg]:px-2 h-8 sm:h-9", children: _jsx(ChevronDown, { size: 14 }) }) }), _jsxs(DropdownMenuContent, { align: "end", children: [_jsx(DropdownMenuItem, { onSelect: () => triggerSubmit('saveAndNew'), children: t('transactions.saveAndNew') }), _jsx(DropdownMenuItem, { onSelect: () => triggerSubmit('saveAndDuplicate'), children: t('transactions.saveAndDuplicate') })] })] })] })) : (_jsx(Button, { type: "submit", disabled: loading || !splitsValid, className: "whitespace-nowrap text-xs sm:text-sm h-8 sm:h-9", children: loading ? t('common.loading') : t('common.save') }))] })] }), transaction && addToRuleOpen && (_jsx(AddTransactionToRuleDialog, { open: true, onOpenChange: setAddToRuleOpen, rules: extendableRules, categories: displayCategories, categoryGroups: displayCategoryGroups, loadingRules: rulesLoading, onSubmit: handlePickRuleToExtend })), extendRuleDialogProps && (_jsx(RuleDialog, { open: true, onClose: () => setExtendRuleTarget(null), rule: extendRuleDialogProps.rule, categories: categories, categoryGroups: categoryGroups, currentCategories: displayCategories, accounts: sortedAccounts, payees: payeesList ?? [], onSave: (data) => updateRuleMutation.mutate(data), loading: updateRuleMutation.isPending, initialData: extendRuleDialogProps.initialData }))] }));
}
function AddTransactionToRuleDialog({ open, onOpenChange, rules, categories: displayCategories, categoryGroups: displayCategoryGroups, loadingRules, onSubmit, }) {
    const { t } = useTranslation();
    const [ruleId, setRuleId] = useState('');
    const [openCombobox, setOpenCombobox] = useState(false);
    const effectiveRuleId = ruleId && rules.some(rule => rule.id === ruleId)
        ? ruleId
        : rules[0]?.id ?? '';
    const selectedRule = rules.find(rule => rule.id === effectiveRuleId) ?? null;
    const groupedRules = useMemo(() => {
        const groupsMap = {};
        for (const rule of rules) {
            const categoryId = getRuleCategoryId(rule) ?? 'uncategorized';
            let categoryName = t('transactions.uncategorized');
            if (categoryId !== 'uncategorized') {
                const category = findCategoryReference(displayCategories, categoryId);
                if (category) {
                    categoryName = category.name;
                    if (category.group_id) {
                        const group = displayCategoryGroups.find(g => g.id === category.group_id);
                        if (group) {
                            categoryName = `${group.name} > ${category.name}`;
                        }
                    }
                }
                else {
                    categoryName = t('transactions.category');
                }
            }
            if (!groupsMap[categoryId]) {
                groupsMap[categoryId] = {
                    categoryName,
                    rules: [],
                };
            }
            groupsMap[categoryId].rules.push(rule);
        }
        return Object.entries(groupsMap).map(([categoryId, data]) => ({
            categoryId,
            ...data,
        }));
    }, [rules, displayCategories, displayCategoryGroups, t]);
    function handleSubmit(event) {
        event.preventDefault();
        // This dialog renders inside the transaction's <form>; without stopping
        // propagation the submit event bubbles up the React tree (portals preserve
        // it) and also triggers the parent transaction save.
        event.stopPropagation();
        if (!selectedRule)
            return;
        onSubmit(selectedRule);
    }
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('transactions.addToExistingRuleTitle') }), _jsx(DialogDescription, { children: t('transactions.addToExistingRuleDescription') })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('transactions.existingRule') }), _jsxs(Popover, { open: openCombobox, onOpenChange: setOpenCombobox, children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs("button", { type: "button", disabled: loadingRules || rules.length === 0, className: "flex w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm text-left shadow-xs transition-[color,box-shadow] outline-hidden focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50 h-9 cursor-pointer", children: [_jsx("span", { className: "flex-1 truncate text-left", children: loadingRules ? (t('common.loading')) : selectedRule ? (selectedRule.name) : (t('transactions.noExistingRules')) }), _jsx(ChevronDown, { className: "size-4 shrink-0 opacity-50" })] }) }), _jsx(PopoverContent, { align: "start", className: "w-[var(--radix-popover-trigger-width)] p-0 overflow-hidden", children: _jsxs(Command, { filter: (itemValue, search) => {
                                                    return normalizeText(itemValue).includes(normalizeText(search)) ? 1 : 0;
                                                }, children: [_jsx(CommandInput, { placeholder: t('transactions.searchRule', 'Search rule...') }), _jsxs(CommandList, { className: "max-h-[300px] overflow-y-auto", children: [_jsx(CommandEmpty, { children: t('transactions.noRulesFound', 'No rules found.') }), groupedRules.map((group) => (_jsxs(CommandGroup, { children: [_jsx("div", { className: "px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70", children: group.categoryName }), group.rules.map((rule) => (_jsxs(CommandItem, { value: `${group.categoryName} ${rule.name}`, onSelect: () => {
                                                                            setRuleId(rule.id);
                                                                            setOpenCombobox(false);
                                                                        }, className: "flex items-center justify-between gap-2 cursor-pointer", children: [_jsx("span", { className: "flex-1 truncate", children: rule.name }), effectiveRuleId === rule.id && _jsx(Check, { className: "size-4 shrink-0" })] }, rule.id)))] }, group.categoryId)))] })] }) })] }), !loadingRules && rules.length === 0 && (_jsx("p", { className: "text-xs text-muted-foreground", children: t('transactions.noExistingRules') }))] }), _jsxs(DialogFooter, { className: "pt-2", children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => onOpenChange(false), children: t('common.cancel') }), _jsx(Button, { type: "submit", disabled: !selectedRule, children: t('transactions.assignRule') })] })] })] }) }));
}
function formatFileSize(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function PendingAttachmentsSection({ files, dragOver, maxAttachments, allowedExtensions, fileInputRef, onDragOver, onDragLeave, onDrop, onFileChange, onRemove, }) {
    const { t } = useTranslation();
    const hasFiles = files.length > 0;
    const atMax = files.length >= maxAttachments;
    return (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm font-medium", children: [_jsx(Paperclip, { size: 14 }), t('transactions.attachments'), hasFiles && (_jsxs("span", { className: "text-xs text-muted-foreground font-normal", children: ["(", files.length, ")"] }))] }), hasFiles ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "grid grid-cols-3 gap-2", children: files.map((file, index) => {
                            const isImg = file.type.startsWith('image/');
                            const isPdf = file.type === 'application/pdf';
                            const ext = file.name.includes('.') ? file.name.split('.').pop().toUpperCase() : 'FILE';
                            return (_jsxs("div", { className: "group relative rounded-xl overflow-hidden ring-1 ring-border hover:ring-border/80 hover:shadow-md hover:shadow-black/5", children: [_jsx("div", { className: "aspect-square bg-muted/50 flex items-center justify-center overflow-hidden relative", children: isImg ? (_jsx("img", { src: URL.createObjectURL(file), alt: file.name, className: "w-full h-full object-cover", onLoad: (e) => URL.revokeObjectURL(e.target.src) })) : (_jsxs("div", { className: "flex flex-col items-center gap-2", children: [_jsx("div", { className: `w-12 h-14 rounded-lg flex items-center justify-center ${isPdf ? 'bg-red-500/10' : 'bg-muted'}`, children: _jsx(FileText, { size: 24, className: isPdf ? 'text-red-500' : 'text-muted-foreground' }) }), _jsx("span", { className: "text-[10px] font-semibold tracking-widest text-muted-foreground/70 uppercase", children: ext })] })) }), _jsx("div", { className: "absolute left-0 right-0 bottom-[44px] flex items-center justify-center gap-1 px-2 py-1.5 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200", children: _jsx("div", { className: "flex items-center gap-1 bg-background/90 dark:bg-card/90 backdrop-blur-sm rounded-lg ring-1 ring-border/50 shadow-lg shadow-black/10 px-1 py-0.5", children: _jsx("button", { type: "button", className: "p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-colors", onClick: () => onRemove(index), title: t('common.delete'), children: _jsx(X, { size: 14 }) }) }) }), _jsxs("div", { className: "px-3 py-2.5 bg-card", children: [_jsx("p", { className: "text-[12px] font-medium truncate leading-tight", title: file.name, children: file.name }), _jsx("p", { className: "text-[10px] text-muted-foreground mt-1 leading-tight", children: formatFileSize(file.size) })] })] }, `${file.name}-${index}`));
                        }) }), !atMax && (_jsxs("button", { type: "button", className: `w-full mt-2 rounded-lg border-2 border-dashed py-3 flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 ${dragOver
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30'}`, onDragOver: (e) => { e.preventDefault(); onDragOver(); }, onDragLeave: onDragLeave, onDrop: onDrop, onClick: () => fileInputRef.current?.click(), children: [_jsx(Plus, { size: 14, className: "text-muted-foreground" }), _jsx("span", { className: "text-xs text-muted-foreground", children: t('transactions.attachmentsUpload') })] }))] })) : (_jsx("div", { className: `rounded-xl border-2 border-dashed py-6 px-4 text-center transition-all cursor-pointer ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'}`, onDragOver: (e) => { e.preventDefault(); onDragOver(); }, onDragLeave: onDragLeave, onDrop: onDrop, onClick: () => fileInputRef.current?.click(), children: _jsxs("div", { className: "flex flex-col items-center gap-2", children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-muted flex items-center justify-center", children: _jsx(Upload, { size: 14, className: "text-muted-foreground" }) }), _jsx("span", { className: "text-xs text-muted-foreground", children: t('transactions.attachmentsUpload') })] }) })), _jsx("input", { ref: fileInputRef, type: "file", multiple: true, accept: allowedExtensions.map(ext => `.${ext}`).join(','), onChange: onFileChange, className: "hidden" })] }));
}
