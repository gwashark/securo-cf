import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CalendarDays, List } from 'lucide-react';
import { Button } from './ui/button.js';
/**
 * Segmented List/Calendar switch, shared by the transactions page header and
 * the dashboard's transactions section so both read as the same control.
 * @example `<TransactionsViewSwitcher value={view} onChange={setView} listLabel="List" calendarLabel="Calendar" />`
 */
export function TransactionsViewSwitcher({ value, onChange, listLabel, calendarLabel }) {
    return (_jsxs("div", { className: "inline-flex rounded-lg border border-border bg-card p-0.5", children: [_jsxs(Button, { variant: value === 'list' ? 'secondary' : 'ghost', size: "sm", className: "h-8 gap-1.5 px-2.5", "aria-pressed": value === 'list', onClick: () => onChange('list'), children: [_jsx(List, { size: 14 }), listLabel] }), _jsxs(Button, { variant: value === 'calendar' ? 'secondary' : 'ghost', size: "sm", className: "h-8 gap-1.5 px-2.5", "aria-pressed": value === 'calendar', onClick: () => onChange('calendar'), children: [_jsx(CalendarDays, { size: 14 }), calendarLabel] })] }));
}
