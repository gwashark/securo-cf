import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils.js';
/**
 * Shared chrome for the invoicing screens.
 *
 * Everything here mirrors patterns already established elsewhere in
 * Securo (recurring, accounts, dashboard) rather than inventing a
 * parallel vocabulary. A module that looks like its own product inside
 * the product is the thing to avoid.
 */
/** The card every section sits in. Same shell as `recurring`. */
export function SectionCard({ children, className = '', }) {
    return (_jsx("div", { className: cn('bg-card rounded-xl border border-border shadow-sm overflow-hidden', className), children: children }));
}
export function SectionHeader({ title, description, action, }) {
    return (_jsxs("div", { className: "px-4 sm:px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: title }), description && _jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: description })] }), action] }));
}
/** Table header cell. Byte-identical to the constant in `recurring`. */
export const TH = 'text-xs font-medium text-muted-foreground py-3';
/**
 * State pill, in the app's badge shape.
 *
 * The tones carry meaning and only three of them are loud: overdue is
 * the one thing on this screen a person has to act on, paid is the one
 * that closes a loop, and everything else stays quiet. A palette where
 * every row shouts is a palette where nothing does.
 */
const STATE_TONE = {
    draft: 'bg-muted text-muted-foreground border-border',
    open: 'bg-muted text-foreground border-border',
    partial: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    paid: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    overdue: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
    void: 'bg-muted text-muted-foreground border-border line-through',
    uncollectible: 'bg-muted text-muted-foreground border-border',
};
export function StateBadge({ state }) {
    const { t } = useTranslation();
    return (_jsx("span", { "data-testid": `invoice-state-${state}`, className: cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap', STATE_TONE[state]), children: t(`invoices.state.${state}`) }));
}
/**
 * Segmented control, the shape `account-detail` already uses for its
 * currency switch. Serves both the state filter and the detail tabs, so
 * the two read as the same control doing the same job.
 */
export function Segmented({ value, onChange, options, testIdPrefix, }) {
    return (_jsx("div", { className: "inline-flex rounded-lg border border-border bg-muted p-0.5 text-xs font-medium", children: options.map((option) => {
            const active = value === option.value;
            return (_jsxs("button", { onClick: () => onChange(option.value), "data-testid": `${testIdPrefix}-${option.value}`, className: cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap', active
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'), children: [option.label, option.count !== undefined && (_jsx("span", { "data-testid": `${testIdPrefix}-${option.value}-count`, className: cn('tabular-nums text-[11px]', active ? 'text-muted-foreground' : 'text-muted-foreground/70'), children: option.count }))] }, option.value));
        }) }));
}
/** Icon-only row action, same affordance as the one in `recurring`. */
export function IconAction({ onClick, label, children, destructive = false, }) {
    return (_jsx("button", { onClick: onClick, "aria-label": label, title: label, className: cn('p-1.5 rounded-md text-muted-foreground transition-colors', destructive
            ? 'hover:text-destructive hover:bg-destructive/5'
            : 'hover:text-primary hover:bg-primary/5'), children: children }));
}
