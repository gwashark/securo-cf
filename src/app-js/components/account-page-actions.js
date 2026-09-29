import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Layers, MoreHorizontal, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button.js';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from './ui/dropdown-menu.js';
function DesktopSecondaryActions(props) {
    const { t } = useTranslation();
    return (_jsxs(_Fragment, { children: [_jsxs(Button, { variant: "outline", className: "hidden gap-1.5 sm:inline-flex", onClick: props.onOpenCollections, children: [_jsx(Layers, { size: 16 }), t('collections.title')] }), props.canWrite && (_jsxs(Button, { variant: "outline", className: "hidden gap-1.5 sm:inline-flex", onClick: props.onConnectBank, children: [_jsx(Plus, { size: 16 }), t('accounts.connectBank')] }))] }));
}
function MobileSecondaryMenu(props) {
    const { t } = useTranslation();
    return (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { variant: "outline", size: "icon", className: "size-9 shrink-0 sm:hidden", "aria-label": t('common.more'), children: _jsx(MoreHorizontal, { size: 18 }) }) }), _jsxs(DropdownMenuContent, { align: "end", children: [_jsxs(DropdownMenuItem, { onSelect: props.onOpenCollections, children: [_jsx(Layers, { size: 16 }), t('collections.title')] }), props.canWrite && _jsxs(DropdownMenuItem, { onSelect: props.onConnectBank, children: [_jsx(Plus, { size: 16 }), t('accounts.connectBank')] })] })] }));
}
/**
 * Preserves the primary Add Account action while moving secondary mobile actions into a menu.
 * @example `<AccountPageActions canWrite onAddAccount={openForm} onConnectBank={connect} onOpenCollections={openCollections} />`
 */
export function AccountPageActions(props) {
    const { t } = useTranslation();
    return (_jsxs("div", { className: "flex w-full items-center gap-2 sm:w-auto", "data-testid": props.testId, children: [_jsx(DesktopSecondaryActions, { ...props }), props.canWrite && _jsxs(Button, { onClick: props.onAddAccount, className: "flex-1 gap-1.5 sm:flex-none", children: [_jsx(Plus, { size: 16 }), t('accounts.addManual')] }), _jsx(MobileSecondaryMenu, { ...props })] }));
}
