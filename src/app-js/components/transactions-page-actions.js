import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowLeftRight, CalendarDays, Copy, Download, List, MoreHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MonthStepper } from './month-stepper.js';
import { TransactionsViewSwitcher } from './transactions-view-switcher.js';
import { Button } from './ui/button.js';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger, } from './ui/dropdown-menu.js';
function HeaderMonthStepper({ month }) {
    return (_jsx("div", { className: "min-w-0 flex-1 sm:flex-none", children: _jsx(MonthStepper, { ...month }) }));
}
function DesktopSecondaryActions(props) {
    const { t } = useTranslation();
    return (_jsxs("div", { className: "hidden sm:contents", children: [_jsx(TransactionsViewSwitcher, { ...props.view }), props.columnPicker, _jsxs(Button, { variant: "outline", disabled: props.exporting, onClick: props.onExport, children: [_jsx(Download, { size: 16, className: "mr-1.5" }), props.exportLabel] }), props.onDuplicate && _jsxs(Button, { variant: "outline", onClick: props.onDuplicate, children: [_jsx(Copy, { size: 16, className: "mr-1.5" }), t('transactions.duplicate')] }), props.onTransfer && _jsxs(Button, { variant: "outline", onClick: props.onTransfer, children: [_jsx(ArrowLeftRight, { size: 16, className: "mr-1.5" }), t('transactions.transfer')] })] }));
}
function PrimaryAddAction({ onAdd }) {
    const { t } = useTranslation();
    if (!onAdd)
        return null;
    return (_jsxs(Button, { className: "shrink-0 px-3", onClick: onAdd, children: ["+ ", _jsx("span", { className: "sm:hidden", children: t('common.add') }), _jsx("span", { className: "hidden sm:inline", children: t('transactions.addManual') })] }));
}
function MobileSecondaryMenu(props) {
    const { t } = useTranslation();
    const changeView = (value) => {
        if (value === 'list' || value === 'calendar')
            props.view.onChange(value);
    };
    return (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { variant: "outline", size: "icon", className: "!size-9 sm:hidden", "aria-label": t('common.more'), children: _jsx(MoreHorizontal, { size: 18 }) }) }), _jsxs(DropdownMenuContent, { align: "end", children: [_jsxs(DropdownMenuRadioGroup, { value: props.view.value, onValueChange: changeView, children: [_jsxs(DropdownMenuRadioItem, { value: "list", children: [_jsx(List, {}), props.view.listLabel] }), _jsxs(DropdownMenuRadioItem, { value: "calendar", children: [_jsx(CalendarDays, {}), props.view.calendarLabel] })] }), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { disabled: props.exporting, onClick: props.onExport, children: [_jsx(Download, { size: 16, className: "mr-2" }), props.exportLabel] }), props.onDuplicate && _jsxs(DropdownMenuItem, { onClick: props.onDuplicate, children: [_jsx(Copy, { size: 16, className: "mr-2" }), t('transactions.duplicate')] }), props.onTransfer && _jsxs(DropdownMenuItem, { onClick: props.onTransfer, children: [_jsx(ArrowLeftRight, { size: 16, className: "mr-2" }), t('transactions.transfer')] })] })] }));
}
/**
 * Keeps month, primary transaction action, and mobile overflow on one compact row.
 * @example `<TransactionsPageActions month={month} view={view} columnPicker={picker} exportLabel="Export" exporting={false} onExport={exportCsv} />`
 */
export function TransactionsPageActions(props) {
    // Secondary actions stay labelled on desktop and collapse only where width is scarce.
    return (_jsxs("div", { className: "flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-wrap sm:justify-end", "data-testid": props.testId, children: [_jsx(HeaderMonthStepper, { month: props.month }), _jsx(DesktopSecondaryActions, { ...props }), _jsx(PrimaryAddAction, { onAdd: props.onAdd }), _jsx(MobileSecondaryMenu, { ...props })] }));
}
