import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Archive, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from './ui/dropdown-menu.js';
function buildAccountActions(t, props) {
    const actions = [
        { label: t('common.edit'), icon: Pencil, run: props.onEdit, tone: 'default' },
        { label: t('accounts.close'), icon: Archive, run: props.onClose, tone: 'warning' },
    ];
    if (!props.onDelete)
        return actions;
    actions.push({
        label: t('common.delete'),
        icon: Trash2,
        run: props.onDelete,
        tone: 'destructive',
    });
    return actions;
}
function accountActionClass(tone) {
    if (tone === 'destructive')
        return 'rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-500';
    if (tone === 'warning')
        return 'rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-amber-50 hover:text-amber-600';
    return 'rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';
}
function DesktopActionButton({ action, deletePending }) {
    const runAction = (event) => {
        event.preventDefault();
        action.run();
    };
    return (_jsx("button", { type: "button", className: accountActionClass(action.tone), onClick: runAction, disabled: action.tone === 'destructive' && deletePending, title: action.label, "aria-label": action.label, children: _jsx(action.icon, { size: 13 }) }));
}
function DesktopAccountActions({ actions, deletePending }) {
    return (_jsx("div", { className: "ml-2 hidden items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 sm:flex", children: actions.map((action) => (_jsx(DesktopActionButton, { action: action, deletePending: deletePending }, action.label))) }));
}
function MobileActionItem({ action, deletePending }) {
    return (_jsxs(DropdownMenuItem, { variant: action.tone === 'destructive' ? 'destructive' : 'default', disabled: action.tone === 'destructive' && deletePending, onSelect: action.run, children: [_jsx(action.icon, { size: 14 }), action.label] }));
}
function MobileAccountActions({ accountName, actions, deletePending }) {
    const { t } = useTranslation();
    return (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx("button", { type: "button", className: "ml-1 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden", "aria-label": `${t('common.more')}: ${accountName}`, children: _jsx(MoreHorizontal, { size: 16 }) }) }), _jsx(DropdownMenuContent, { align: "end", children: actions.map((action) => (_jsx(MobileActionItem, { action: action, deletePending: deletePending }, action.label))) })] }));
}
/**
 * Keeps account edit/close/delete actions available on pointer and touch layouts.
 * @example `<AccountRowActions accountName="Cash" onEdit={edit} onClose={close} deletePending={false} />`
 */
export function AccountRowActions(props) {
    const { t } = useTranslation();
    const actions = buildAccountActions(t, props);
    return (_jsxs(_Fragment, { children: [_jsx(DesktopAccountActions, { actions: actions, deletePending: props.deletePending }), _jsx(MobileAccountActions, { ...props, actions: actions })] }));
}
