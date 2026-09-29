/** Return the usable amount in the selected currency, or null if FX is unknown. */
export function transactionAmountForBalance(transaction, usePrimary, displayCurrency) {
    if (usePrimary
        && transaction.amount_primary == null
        && transaction.currency !== displayCurrency)
        return null;
    return usePrimary && transaction.amount_primary != null
        ? Number(transaction.amount_primary)
        : Number(transaction.amount);
}
/** Apply one transaction to a running balance using Account Detail semantics. */
export function applyTransactionToBalance(balance, transaction, usePrimary, displayCurrency) {
    if (transaction.is_ignored)
        return balance;
    // A missing cross-currency conversion is unknown, not a 1:1 rate. Keep the
    // running balance unchanged until the transaction has a real FX stamp.
    const amount = transactionAmountForBalance(transaction, usePrimary, displayCurrency);
    if (amount == null)
        return balance;
    return balance + (transaction.type === 'credit' ? amount : -amount);
}
/**
 * Hide virtual occurrences that already have a materialized transaction.
 * The recurring link plus the effective occurrence date is authoritative;
 * description and amount can legitimately change after materialization.
 */
export function excludeMaterializedProjections(projections, transactions) {
    const materialized = new Set(transactions
        .filter((transaction) => transaction.recurring_transaction_id != null)
        .map((transaction) => `${transaction.recurring_transaction_id}:${transaction.date}`));
    return projections.filter((projection) => !materialized.has(`${projection.recurring_id}:${projection.date}`));
}
