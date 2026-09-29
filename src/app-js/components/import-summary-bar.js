import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../lib/format.js';
export function ImportSummaryBar({ transactions, userCurrency, locale }) {
    const { t } = useTranslation();
    const total = transactions.length;
    const included = transactions.filter(t => !t.excluded).length;
    const excluded = total - included;
    const balanceImpact = transactions
        .filter(t => !t.excluded)
        .reduce((sum, t) => sum + (t.type === 'credit' ? Number(t.amount) : -Number(t.amount)), 0);
    return (_jsxs("div", { className: "sticky top-0 z-10 bg-card border border-border px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm", children: [_jsxs("span", { className: "text-muted-foreground", children: [total, " ", t('import.transactionsFound')] }), _jsxs("span", { className: "text-foreground font-medium", children: [included, " ", t('import.willBeImported')] }), excluded > 0 && (_jsxs("span", { className: "text-muted-foreground line-through", children: [excluded, " ", t('import.excluded').toLowerCase()] })), _jsxs("span", { className: "ml-auto text-xs text-muted-foreground", children: [t('import.balanceImpact'), ": ", ' ', _jsx("span", { className: balanceImpact >= 0 ? 'text-emerald-600 font-medium' : 'text-rose-500 font-medium', children: formatCurrency(balanceImpact, userCurrency, locale) })] })] }));
}
