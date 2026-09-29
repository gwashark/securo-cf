import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
import { Columns3 } from 'lucide-react';
import { Button } from './ui/button.js';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover.js';
import { COLUMN_REGISTRY } from './transactions-grid-columns';
export function TransactionsColumnPicker({ state }) {
    const { t } = useTranslation();
    return (_jsxs(Popover, { children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs(Button, { variant: "outline", title: t('transactions.columnsTooltip'), children: [_jsx(Columns3, { size: 16, className: "mr-1.5" }), t('transactions.columns')] }) }), _jsxs(PopoverContent, { align: "end", className: "w-56 p-2", children: [_jsx("div", { className: "px-2 py-1.5 text-xs font-medium text-muted-foreground", children: t('transactions.columns') }), _jsx("ul", { className: "max-h-72 overflow-y-auto", children: COLUMN_REGISTRY.map(col => {
                            const checked = state.isVisible(col.id);
                            const disabled = !!col.alwaysOn;
                            return (_jsx("li", { children: _jsxs("label", { className: `flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`, children: [_jsx("input", { type: "checkbox", checked: checked, disabled: disabled, onChange: () => state.toggleColumn(col.id), className: "h-4 w-4 rounded border-border accent-primary" }), _jsx("span", { className: "flex-1", children: t(col.labelKey) })] }) }, col.id));
                        }) }), _jsx("div", { className: "mt-1 border-t border-border pt-2", children: _jsx("button", { type: "button", onClick: () => state.resetColumns(), className: "w-full rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground", children: t('transactions.resetColumns') }) })] })] }));
}
