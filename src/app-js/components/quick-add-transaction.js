import { jsx as _jsx } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { TransactionDialog } from './transaction-dialog.js';
import { useCreateTransaction } from '../hooks/use-create-transaction.js';
import { accounts as accountsApi, categories as categoriesApi, categoryGroups as categoryGroupsApi } from '../lib/api.js';
import { extractApiError } from '../lib/api-errors.js';
/**
 * Create-transaction dialog reachable from anywhere in the app (the "+" next
 * to Transactions in the sidebar). Loaded lazily by the layout, and it only
 * fetches its lists while open, so pages that never use it pay nothing.
 */
export default function QuickAddTransaction({ open, onClose }) {
    const { mutation: createMutation, create: createTransaction, duplicateDraft, setDuplicateDraft, formResetKey, } = useCreateTransaction({ onDone: onClose });
    const { data: accountsList } = useQuery({
        queryKey: ['accounts'],
        queryFn: () => accountsApi.list(),
        enabled: open,
    });
    const { data: categoriesList } = useQuery({
        queryKey: ['categories'],
        queryFn: categoriesApi.list,
        enabled: open,
    });
    const { data: categoryGroupsList } = useQuery({
        queryKey: ['categoryGroups'],
        queryFn: categoryGroupsApi.list,
        enabled: open,
    });
    return (_jsx(TransactionDialog, { open: open, onClose: () => {
            onClose();
            setDuplicateDraft(null);
            createMutation.reset();
        }, transaction: null, duplicateDraft: duplicateDraft, formResetKey: formResetKey, categories: categoriesList ?? [], categoryGroups: categoryGroupsList ?? [], accounts: (accountsList ?? []).filter(a => !a.is_closed), onSave: (data, recurringData, installmentData, pendingFiles, action) => {
            createTransaction(data, recurringData, installmentData, pendingFiles, action);
        }, loading: createMutation.isPending, error: createMutation.error ? extractApiError(createMutation.error) : null }));
}
