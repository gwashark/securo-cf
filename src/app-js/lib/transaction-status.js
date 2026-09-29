/** Bank-sync pending state already matches the provider and needs no UI badge. */
export function shouldShowPendingBadge(transaction) {
    return transaction.status === 'pending' && transaction.source !== 'sync';
}
