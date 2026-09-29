/** Heuristic: a tool result is a proposal if its data has a known kind. */
export function isProposalData(data) {
    if (!data || typeof data !== 'object')
        return false;
    const k = data.kind;
    return typeof k === 'string' && [
        'categorize', 'create_category', 'create_budget', 'create_payee_rule',
        'create_rule', 'update_rule', 'delete_rule',
        'create_transaction', 'create_recurring_transaction',
        'update_recurring_transaction', 'cancel_recurring_transaction',
        'create_goal',
    ].includes(k);
}
/** Treat the data as a proposal even when only `error` is present, since
 * a proposal that failed validation should still render a small error card
 * instead of a generic tool-debug chip. */
export function isProposalToolName(name) {
    return name.includes('propose_');
}
