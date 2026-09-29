import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { formatAccountMask, getAccountLabel, getAccountName } from '../lib/account-utils.js';
import { getConnectionName } from '../lib/connection-utils.js';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDisplayLocale, useDateLocale } from '../hooks/use-display-locale.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { accounts, connections, currencies } from '../lib/api.js';
import { localDateString } from '../lib/date-utils.js';
import { invalidateFinancialQueries } from '../lib/invalidate-queries.js';
import { toast } from 'sonner';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from '../components/ui/dialog.js';
import { DatePickerInput } from '../components/ui/date-picker-input.js';
import { Badge } from '../components/ui/badge.js';
import { Skeleton } from '../components/ui/skeleton.js';
import { RefreshCw, TriangleAlert, Unlink, Settings } from 'lucide-react';
import { AccountIcon, ConnectionLogo } from '../components/account-icon.js';
import { getAccountTypeConfig } from '../lib/account-type-config.js';
import { AccountPageActions } from '../components/account-page-actions.js';
import { AccountRowActions } from '../components/account-row-actions.js';
import { PageHeader } from '../components/page-header.js';
import { BankConnectDialog } from '../components/bank-connect-dialog.js';
import { ConnectorSelectDialog } from '../components/connector-select-dialog.js';
import { OAuthConnectDialog } from '../components/oauth-connect-dialog.js';
import { TokenConnectDialog } from '../components/token-connect-dialog.js';
import { ConnectionSettingsDialog } from '../components/connection-settings-dialog.js';
import { usePrivacyMode } from '../hooks/use-privacy-mode.js';
import { useAuth } from '../contexts/auth-context.js';
import { useWorkspace } from '../contexts/workspace-context.js';
import { formatCurrency } from '../lib/format.js';
// Account types offered in the create/edit dialog. Shared between the manual
// type selector and the connected-account override selector so the list stays
// in one place.
const ACCOUNT_TYPE_OPTIONS = [
    { value: 'checking', labelKey: 'accounts.typeChecking' },
    { value: 'savings', labelKey: 'accounts.typeSavings' },
    { value: 'credit_card', labelKey: 'accounts.typeCreditCard' },
    { value: 'investment', labelKey: 'accounts.typeInvestment' },
    { value: 'wallet', labelKey: 'accounts.typeWallet' },
];
function daysUntil(dateStr) {
    if (!dateStr)
        return null;
    const due = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
export default function AccountsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const { mask } = usePrivacyMode();
    const { user } = useAuth();
    const { canWrite } = useWorkspace();
    const userCurrency = user?.preferences?.currency_display ?? 'USD';
    const queryClient = useQueryClient();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [connectorSelectOpen, setConnectorSelectOpen] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [settingsConnection, setSettingsConnection] = useState(null);
    const [disconnectingConnection, setDisconnectingConnection] = useState(null);
    const [closingAccountId, setClosingAccountId] = useState(null);
    const [reconnectConnId, setReconnectConnId] = useState(null);
    const [reconnectItemId, setReconnectItemId] = useState(null);
    const [tokenReconnectConnection, setTokenReconnectConnection] = useState(null);
    const { data: accountsList, isLoading: accountsLoading } = useQuery({
        queryKey: ['accounts'],
        queryFn: () => accounts.list(),
    });
    const { data: connectionsList, isLoading: connectionsLoading } = useQuery({
        queryKey: ['connections'],
        queryFn: connections.list,
    });
    const { data: providersList } = useQuery({
        queryKey: ['connections', 'providers'],
        queryFn: connections.getProviders,
        staleTime: 1000 * 60 * 10,
    });
    const providersByName = useMemo(() => {
        const map = new Map();
        for (const p of providersList ?? [])
            map.set(p.name, p);
        return map;
    }, [providersList]);
    const handleReconnectClick = async (conn) => {
        const providerInfo = providersByName.get(conn.provider);
        if (providerInfo?.flow_type === 'oauth') {
            try {
                const url = await connections.getReauthUrl(conn.id);
                window.location.assign(url);
            }
            catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                toast.error(message || t('accounts.connectError'));
            }
            return;
        }
        if (providerInfo?.flow_type === 'token') {
            setTokenReconnectConnection(conn);
            return;
        }
        // Widget flow (Pluggy): re-open the widget with the existing item_id.
        setReconnectConnId(conn.id);
        setReconnectItemId(conn.external_id);
    };
    const { data: closedAccountsList } = useQuery({
        queryKey: ['accounts', 'closed'],
        queryFn: () => accounts.list(true),
    });
    const closedAccounts = closedAccountsList?.filter((a) => a.is_closed) ?? [];
    const syncMutation = useMutation({
        mutationFn: (id) => connections.sync(id),
        onSuccess: (result) => {
            invalidateFinancialQueries(queryClient);
            queryClient.invalidateQueries({ queryKey: ['connections'] });
            toast.success(t('accounts.syncDone'));
            const merged = result?.merged_count;
            if (merged && merged > 0) {
                toast.info(t('accounts.mergedCount', { count: merged }));
            }
        },
        onError: (err) => {
            queryClient.invalidateQueries({ queryKey: ['connections'] });
            const detail = axios.isAxiosError(err)
                ? err.response?.data?.detail
                : null;
            const message = typeof detail === 'string' ? detail : detail?.message;
            toast.error(message || t('accounts.syncError'));
        },
    });
    const disconnectMutation = useMutation({
        mutationFn: (id) => connections.delete(id),
        onSuccess: () => {
            invalidateFinancialQueries(queryClient);
            queryClient.invalidateQueries({ queryKey: ['connections'] });
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            queryClient.invalidateQueries({ queryKey: ['asset-groups'] });
            queryClient.invalidateQueries({ queryKey: ['portfolio-trend'] });
            setDisconnectingConnection(null);
            toast.success(t('accounts.disconnected'));
        },
    });
    const createMutation = useMutation({
        mutationFn: (data) => accounts.create(data),
        onSuccess: () => {
            invalidateFinancialQueries(queryClient);
            setDialogOpen(false);
            toast.success(t('accounts.created'));
        },
        onError: () => toast.error(t('common.error')),
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }) => accounts.update(id, data),
        onSuccess: () => {
            invalidateFinancialQueries(queryClient);
            setDialogOpen(false);
            setEditingAccount(null);
            toast.success(t('accounts.updated'));
        },
        onError: () => toast.error(t('common.error')),
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => accounts.delete(id),
        onSuccess: () => {
            invalidateFinancialQueries(queryClient);
            queryClient.invalidateQueries({ queryKey: ['import-logs'] });
            setDeletingId(null);
            toast.success(t('accounts.deleted'));
        },
        onError: () => toast.error(t('common.error')),
    });
    const closeMutation = useMutation({
        mutationFn: (id) => accounts.close(id),
        onSuccess: () => {
            invalidateFinancialQueries(queryClient);
            setClosingAccountId(null);
            toast.success(t('accounts.accountClosed'));
        },
        onError: () => toast.error(t('common.error')),
    });
    const reopenMutation = useMutation({
        mutationFn: (id) => accounts.reopen(id),
        onSuccess: () => {
            invalidateFinancialQueries(queryClient);
            toast.success(t('accounts.accountReopened'));
        },
        onError: () => toast.error(t('common.error')),
    });
    const isLoading = accountsLoading || connectionsLoading;
    const manualAccounts = accountsList?.filter((a) => a.connection_id === null) ?? [];
    const bankAccounts = accountsList?.filter((a) => a.connection_id !== null) ?? [];
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(PageHeader, { section: t('accounts.title'), title: t('accounts.title'), action: _jsx(AccountPageActions, { canWrite: canWrite, onAddAccount: () => { setEditingAccount(null); setDialogOpen(true); }, onConnectBank: () => setConnectorSelectOpen(true), onOpenCollections: () => navigate('/collections') }) }), isLoading ? (_jsx("div", { className: "space-y-3", children: Array.from({ length: 3 }).map((_, i) => _jsx(Skeleton, { className: "h-16 rounded-xl" }, i)) })) : (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-card rounded-xl border border-border shadow-sm", children: [_jsx("div", { className: "flex items-center justify-between px-5 py-3.5 border-b border-border", children: _jsx("h2", { className: "text-sm font-medium text-muted-foreground", children: t('accounts.manualAccounts') }) }), manualAccounts.length > 0 ? (_jsx("div", { className: "divide-y divide-muted", children: manualAccounts.map((acc) => {
                                    const cfg = getAccountTypeConfig(acc.type);
                                    const bal = Number(acc.current_balance);
                                    const isCC = acc.type === 'credit_card';
                                    const dueIn = isCC ? daysUntil(acc.next_due_date) : null;
                                    const dueText = dueIn == null ? null
                                        : dueIn < 0 ? t('accounts.overdue')
                                            : dueIn === 0 ? t('accounts.dueToday')
                                                : t('accounts.dueIn', { count: dueIn });
                                    const dueClass = dueIn != null && dueIn <= 3 ? 'text-amber-600' : 'text-muted-foreground';
                                    const accountMask = formatAccountMask(acc);
                                    return (_jsxs("div", { className: "group flex items-center px-5 py-3 hover:bg-muted/50 transition-colors", children: [_jsxs(Link, { to: `/accounts/${acc.id}`, className: "flex items-center gap-3 flex-1 min-w-0", children: [_jsx(AccountIcon, { account: acc }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-sm font-medium text-foreground truncate", children: getAccountName(acc) }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [t(cfg.label), accountMask && _jsxs(_Fragment, { children: [" \u00B7 ", _jsx("span", { className: "tabular-nums", children: accountMask })] }), acc.shared_balance_group && _jsxs(_Fragment, { children: [" \u00B7 ", _jsx("span", { children: t('accounts.sharedCreditBalance') })] }), dueText && _jsxs(_Fragment, { children: [" \u00B7 ", _jsx("span", { className: dueClass, children: dueText })] })] })] })] }), _jsxs("div", { className: "shrink-0 text-right", children: [_jsx("p", { className: `text-xs sm:text-sm font-semibold tabular-nums ${(acc.type === 'credit_card' ? bal > 0 : bal < 0) ? 'text-rose-500' : 'text-foreground'}`, children: mask(formatCurrency(bal, acc.currency, locale)) }), isCC && acc.available_credit != null ? (_jsxs("p", { className: "text-[10px] text-muted-foreground tabular-nums", children: [t('accounts.availableCredit'), ": ", mask(formatCurrency(Number(acc.available_credit), acc.currency, locale))] })) : acc.balance_primary != null && acc.currency !== userCurrency && (_jsx("p", { className: "text-[10px] text-muted-foreground tabular-nums", children: mask(formatCurrency(acc.balance_primary, userCurrency, locale)) }))] }), canWrite && (_jsx(AccountRowActions, { accountName: getAccountName(acc), onEdit: () => { setEditingAccount(acc); setDialogOpen(true); }, onClose: () => setClosingAccountId(acc.id), onDelete: () => setDeletingId(acc.id), deletePending: deleteMutation.isPending }))] }, acc.id));
                                }) })) : (_jsx("div", { className: "px-5 py-8 text-center", children: _jsx("p", { className: "text-sm text-muted-foreground", children: t('accounts.noManualAccounts') }) }))] }), connectionsList && connectionsList.length > 0 ? (_jsx("div", { className: "space-y-3", children: connectionsList.map((conn) => {
                            const connAccounts = bankAccounts.filter((a) => a.connection_id === conn.id);
                            const needsReconnect = conn.status !== 'active';
                            const syncPending = syncMutation.isPending && syncMutation.variables === conn.id;
                            return (_jsxs("div", { className: "bg-card rounded-xl border border-border shadow-sm", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-3.5 border-b border-border", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(ConnectionLogo, { logoUrl: (conn.institutions?.length ?? 0) > 1 ? null : conn.logo_url }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: getConnectionName(conn, t) }), _jsx(Badge, { variant: conn.status === 'active' ? 'default' : 'secondary', className: conn.status === 'active'
                                                                            ? 'text-[10px] px-1.5 py-0 h-4'
                                                                            : 'text-[10px] px-1.5 py-0 h-4 border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300', children: t(`accounts.connectionStatus.${conn.status}`, conn.status) })] }), conn.last_sync_at && (_jsxs("p", { className: "text-[11px] text-muted-foreground mt-0.5", children: [t('accounts.lastSync'), ": ", new Date(conn.last_sync_at).toLocaleString(dateLocale)] }))] })] }), canWrite && (_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(Button, { variant: "ghost", size: "sm", className: "h-8 w-8 p-0 text-muted-foreground hover:text-foreground", onClick: () => setSettingsConnection(conn), title: t('connections.settings'), children: _jsx(Settings, { size: 14 }) }), _jsxs(Button, { variant: "ghost", size: "sm", className: needsReconnect
                                                            ? 'relative h-8 w-8 p-0 text-amber-500 hover:bg-amber-500/10 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300'
                                                            : 'h-8 w-8 p-0 text-muted-foreground hover:text-foreground', onClick: () => needsReconnect ? handleReconnectClick(conn) : syncMutation.mutate(conn.id), disabled: syncPending, title: needsReconnect
                                                            ? conn.status === 'expired'
                                                                ? t('accounts.connectionExpired')
                                                                : t('accounts.connectionError')
                                                            : t('accounts.sync'), "aria-label": needsReconnect ? t('accounts.reconnect') : t('accounts.sync'), children: [_jsx(RefreshCw, { size: 14, className: syncPending ? 'animate-spin' : '' }), needsReconnect && (_jsx(TriangleAlert, { size: 10, className: "absolute -right-0.5 -top-0.5 rounded-full bg-card text-amber-500" }))] }), _jsx(Button, { variant: "ghost", size: "sm", className: "h-8 w-8 p-0 text-muted-foreground hover:text-rose-500", onClick: () => setDisconnectingConnection(conn), disabled: disconnectMutation.isPending, title: t('accounts.disconnect'), children: _jsx(Unlink, { size: 14 }) })] }))] }), connAccounts.length > 0 ? (_jsx("div", { className: "divide-y divide-muted", children: connAccounts.map((acc) => {
                                            const cfg = getAccountTypeConfig(acc.type);
                                            const bal = Number(acc.current_balance);
                                            const isCC = acc.type === 'credit_card';
                                            const dueIn = isCC ? daysUntil(acc.next_due_date) : null;
                                            const dueText = dueIn == null ? null
                                                : dueIn < 0 ? t('accounts.overdue')
                                                    : dueIn === 0 ? t('accounts.dueToday')
                                                        : t('accounts.dueIn', { count: dueIn });
                                            const dueClass = dueIn != null && dueIn <= 3 ? 'text-amber-600' : 'text-muted-foreground';
                                            const accountMask = formatAccountMask(acc);
                                            return (_jsxs("div", { className: "group flex items-center px-5 py-3 hover:bg-muted/50 transition-colors", children: [_jsxs(Link, { to: `/accounts/${acc.id}`, className: "flex items-center gap-3 flex-1 min-w-0", children: [_jsx(AccountIcon, { account: acc }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-sm font-medium text-foreground truncate", children: getAccountName(acc) }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [t(cfg.label), accountMask && _jsxs(_Fragment, { children: [" \u00B7 ", _jsx("span", { className: "tabular-nums", children: accountMask })] }), acc.shared_balance_group && _jsxs(_Fragment, { children: [" \u00B7 ", _jsx("span", { children: t('accounts.sharedCreditBalance') })] }), dueText && _jsxs(_Fragment, { children: [" \u00B7 ", _jsx("span", { className: dueClass, children: dueText })] })] })] })] }), _jsxs("div", { className: "shrink-0 text-right", children: [_jsx("p", { className: `text-xs sm:text-sm font-semibold tabular-nums ${(acc.type === 'credit_card' ? bal > 0 : bal < 0) ? 'text-rose-500' : 'text-foreground'}`, children: mask(formatCurrency(bal, acc.currency, locale)) }), isCC && acc.available_credit != null ? (_jsxs("p", { className: "text-[10px] text-muted-foreground tabular-nums", children: [t('accounts.availableCredit'), ": ", mask(formatCurrency(Number(acc.available_credit), acc.currency, locale))] })) : acc.balance_primary != null && acc.currency !== userCurrency && (_jsx("p", { className: "text-[10px] text-muted-foreground tabular-nums", children: mask(formatCurrency(acc.balance_primary, userCurrency, locale)) }))] }), canWrite && (_jsx(AccountRowActions, { accountName: getAccountName(acc), onEdit: () => { setEditingAccount(acc); setDialogOpen(true); }, onClose: () => setClosingAccountId(acc.id), deletePending: deleteMutation.isPending }))] }, acc.id));
                                        }) })) : (_jsx("div", { className: "px-5 py-4", children: _jsx("p", { className: "text-sm text-muted-foreground", children: t('accounts.noAccountsFound') }) }))] }, conn.id));
                        }) })) : (_jsx("div", { className: "bg-card rounded-xl border border-dashed border-border p-8 text-center", children: _jsx("p", { className: "text-sm text-muted-foreground", children: t('accounts.noBankConnections') }) })), closedAccounts.length > 0 && (_jsxs("div", { className: "bg-card rounded-xl border border-border shadow-sm opacity-60", children: [_jsx("div", { className: "flex items-center justify-between px-5 py-3.5 border-b border-border", children: _jsx("h2", { className: "text-sm font-medium text-muted-foreground", children: t('accounts.closedAccounts') }) }), _jsx("div", { className: "divide-y divide-muted", children: closedAccounts.map((acc) => {
                                    return (_jsxs("div", { className: "flex items-center px-5 py-3", children: [_jsxs("div", { className: "flex items-center gap-3 flex-1 min-w-0", children: [_jsx(AccountIcon, { account: acc }), _jsx("p", { className: "text-sm font-medium text-muted-foreground truncate", children: getAccountLabel(acc) })] }), canWrite && (_jsx(Button, { variant: "ghost", size: "sm", className: "text-xs text-muted-foreground hover:text-foreground h-7 px-2 mr-3", onClick: () => reopenMutation.mutate(acc.id), disabled: reopenMutation.isPending, children: t('accounts.reopen') })), _jsx("p", { className: "text-sm font-semibold tabular-nums text-muted-foreground w-32 text-right", children: mask(formatCurrency(Number(acc.current_balance), acc.currency, locale)) })] }, acc.id));
                                }) })] }))] })), _jsx(Dialog, { open: !!deletingId, onOpenChange: () => setDeletingId(null), children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('accounts.confirmDeleteTitle') }) }), _jsx("p", { className: "text-sm text-muted-foreground", children: t('accounts.confirmDeleteDesc') }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setDeletingId(null), children: t('common.cancel') }), _jsx(Button, { variant: "destructive", onClick: () => deletingId && deleteMutation.mutate(deletingId), disabled: deleteMutation.isPending, children: deleteMutation.isPending ? t('common.loading') : t('common.delete') })] })] }) }), _jsx(Dialog, { open: !!disconnectingConnection, onOpenChange: () => setDisconnectingConnection(null), children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('accounts.confirmDisconnectTitle') }) }), _jsx("p", { className: "text-sm text-muted-foreground", children: t('accounts.confirmDisconnectDesc', { institution: disconnectingConnection ? getConnectionName(disconnectingConnection, t) : '' }) }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setDisconnectingConnection(null), children: t('common.cancel') }), _jsx(Button, { variant: "destructive", onClick: () => disconnectingConnection && disconnectMutation.mutate(disconnectingConnection.id), disabled: disconnectMutation.isPending, children: disconnectMutation.isPending ? t('common.loading') : t('accounts.disconnect') })] })] }) }), _jsx(Dialog, { open: !!closingAccountId, onOpenChange: () => setClosingAccountId(null), children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('accounts.close') }) }), _jsx("p", { className: "text-sm text-muted-foreground", children: t('accounts.confirmClose') }), accountsList?.find(a => a.id === closingAccountId)?.connection_id && (_jsx("p", { className: "text-sm text-amber-600 font-medium", children: t('accounts.confirmCloseBank') })), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setClosingAccountId(null), children: t('common.cancel') }), _jsx(Button, { variant: "default", onClick: () => closingAccountId && closeMutation.mutate(closingAccountId), disabled: closeMutation.isPending, children: closeMutation.isPending ? t('common.loading') : t('accounts.close') })] })] }) }), _jsx(ConnectorSelectDialog, { open: connectorSelectOpen, onClose: () => setConnectorSelectOpen(false), onSelect: (provider) => setSelectedProvider(provider) }), _jsx(BankConnectDialog, { open: !!selectedProvider && selectedProvider.flow_type === 'widget', onClose: () => setSelectedProvider(null), provider: selectedProvider?.name, supportsAssetSync: selectedProvider?.supports_asset_sync ?? false }), _jsx(OAuthConnectDialog, { open: !!selectedProvider && selectedProvider.flow_type === 'oauth', onClose: () => setSelectedProvider(null), provider: selectedProvider?.name ?? '', supportsAssetSync: selectedProvider?.supports_asset_sync ?? false }), _jsx(TokenConnectDialog, { open: !!selectedProvider && selectedProvider.flow_type === 'token', onClose: () => setSelectedProvider(null), provider: selectedProvider?.name ?? '', supportsAssetSync: selectedProvider?.supports_asset_sync ?? false }), _jsx(BankConnectDialog, { open: !!reconnectConnId, onClose: () => { setReconnectConnId(null); setReconnectItemId(null); }, reconnectConnectionId: reconnectConnId ?? undefined, updateItemId: reconnectItemId ?? undefined }), _jsx(TokenConnectDialog, { open: !!tokenReconnectConnection, onClose: () => setTokenReconnectConnection(null), provider: tokenReconnectConnection?.provider ?? '', reconnectConnectionId: tokenReconnectConnection?.id }), _jsx(ConnectionSettingsDialog, { open: !!settingsConnection, onClose: () => setSettingsConnection(null), connection: settingsConnection, supportsAssetSync: settingsConnection
                    ? providersByName.get(settingsConnection.provider)?.supports_asset_sync ?? false
                    : false }), _jsx(AccountDialog, { open: dialogOpen, onClose: () => { setDialogOpen(false); setEditingAccount(null); }, account: editingAccount, onSave: (data) => {
                    if (editingAccount) {
                        updateMutation.mutate({ id: editingAccount.id, ...data });
                    }
                    else {
                        createMutation.mutate(data);
                    }
                }, loading: createMutation.isPending || updateMutation.isPending })] }));
}
function AccountDialog({ open, onClose, account, onSave, loading, }) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const userCurrency = user?.preferences?.currency_display ?? 'USD';
    const { data: supportedCurrencies } = useQuery({
        queryKey: ['currencies'],
        queryFn: currencies.list,
        staleTime: Infinity,
    });
    const [name, setName] = useState(account?.name ?? '');
    const [displayName, setDisplayName] = useState(account?.display_name ?? '');
    const [type, setType] = useState(account?.type ?? 'checking');
    const [balance, setBalance] = useState(account?.balance?.toString() ?? '0');
    const [currency, setCurrency] = useState(account?.currency ?? userCurrency);
    const [balanceDate, setBalanceDate] = useState(localDateString);
    const [creditLimit, setCreditLimit] = useState(account?.credit_limit?.toString() ?? '');
    const [statementCloseDay, setStatementCloseDay] = useState(account?.statement_close_day?.toString() ?? '');
    const [paymentDueDay, setPaymentDueDay] = useState(account?.payment_due_day?.toString() ?? '');
    const [formSource, setFormSource] = useState(null);
    if (!formSource || formSource.account !== account) {
        setFormSource({ account });
        setName(account?.name ?? '');
        setDisplayName(account?.display_name ?? '');
        setType(account?.type ?? 'checking');
        setBalance(account?.balance?.toString() ?? '0');
        setCurrency(account?.currency ?? userCurrency);
        setBalanceDate(localDateString());
        setCreditLimit(account?.credit_limit?.toString() ?? '');
        setStatementCloseDay(account?.statement_close_day?.toString() ?? '');
        setPaymentDueDay(account?.payment_due_day?.toString() ?? '');
    }
    return (_jsx(Dialog, { open: open, onOpenChange: onClose, children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: account ? t('accounts.editAccount') : t('accounts.addManual') }) }), _jsxs("form", { onSubmit: (e) => {
                        e.preventDefault();
                        const isCC = type === 'credit_card';
                        const parseDay = (v) => {
                            const n = parseInt(v, 10);
                            return Number.isFinite(n) && n >= 1 && n <= 31 ? n : null;
                        };
                        const isConnected = !!account?.connection_id;
                        onSave({
                            ...(!isConnected && { name, balance: parseFloat(balance), balance_date: balanceDate, currency }),
                            type,
                            display_name: displayName.trim() || null,
                            ...(isCC && {
                                credit_limit: creditLimit !== '' ? parseFloat(creditLimit) : null,
                                statement_close_day: parseDay(statementCloseDay),
                                payment_due_day: parseDay(paymentDueDay),
                            }),
                        });
                    }, className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('accounts.accountName') }), _jsx(Input, { value: name, onChange: (e) => setName(e.target.value), required: true, disabled: !!account?.connection_id })] }), account?.connection_id && (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('accounts.displayName') }), _jsx(Input, { value: displayName, onChange: (e) => setDisplayName(e.target.value), placeholder: name }), _jsx("p", { className: "text-xs text-muted-foreground", children: t('accounts.displayNameHint') })] })), account?.connection_id && (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('accounts.accountType') }), _jsx("select", { className: "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary", value: type, onChange: (e) => setType(e.target.value), children: ACCOUNT_TYPE_OPTIONS.map((o) => (_jsx("option", { value: o.value, children: t(o.labelKey) }, o.value))) }), _jsx("p", { className: "text-xs text-muted-foreground", children: t('accounts.typeOverrideHint') })] })), !account?.connection_id && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('accounts.accountType') }), _jsx("select", { className: "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary", value: type, onChange: (e) => setType(e.target.value), children: ACCOUNT_TYPE_OPTIONS.map((o) => (_jsx("option", { value: o.value, children: t(o.labelKey) }, o.value))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('accounts.currency') }), _jsx("select", { className: "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary", value: currency, onChange: (e) => setCurrency(e.target.value), children: (supportedCurrencies ?? [{ code: userCurrency, symbol: userCurrency, name: userCurrency, flag: '' }]).map((c) => (_jsxs("option", { value: c.code, children: [c.flag, " ", c.name] }, c.code))) })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: type === 'credit_card'
                                                        ? t('accounts.balanceCreditCard')
                                                        : t('accounts.balance') }), _jsx(Input, { type: "number", step: "0.01", min: type === 'credit_card' ? '0' : undefined, value: balance, onChange: (e) => setBalance(e.target.value) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('accounts.balanceDate') }), _jsx(DatePickerInput, { value: balanceDate, onChange: setBalanceDate, className: "w-full justify-start" })] })] }), type === 'credit_card' && (_jsx("p", { className: "text-xs text-muted-foreground -mt-2", children: t('accounts.balanceCreditCardHint') }))] })), type === 'credit_card' && (_jsxs("div", { className: "space-y-4 rounded-lg border border-border bg-muted/30 p-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('accounts.creditLimit') }), _jsx(Input, { type: "number", step: "0.01", min: "0", value: creditLimit, onChange: (e) => setCreditLimit(e.target.value), placeholder: "0.00" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('accounts.statementCloseDay') }), _jsx(Input, { type: "number", min: "1", max: "31", value: statementCloseDay, onChange: (e) => setStatementCloseDay(e.target.value), placeholder: t('accounts.dayOfMonthHint') })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('accounts.paymentDueDay') }), _jsx(Input, { type: "number", min: "1", max: "31", value: paymentDueDay, onChange: (e) => setPaymentDueDay(e.target.value), placeholder: t('accounts.dayOfMonthHint') })] })] })] })), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: onClose, children: t('common.cancel') }), _jsx(Button, { type: "submit", disabled: loading, children: loading ? t('common.loading') : t('common.save') })] })] }, account?.id ?? 'new')] }) }));
}
