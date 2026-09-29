import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Button } from './ui/button.js';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from './ui/dialog.js';
export function DeleteConfirmationDialog({ open, title, description, isPending, onClose, onCancel = onClose, onConfirm, }) {
    const { t } = useTranslation();
    return (_jsx(Dialog, { open: open, onOpenChange: (nextOpen) => {
            if (!nextOpen && !isPending)
                onClose();
        }, children: _jsxs(DialogContent, { className: "sm:max-w-md", showCloseButton: !isPending, children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: title }), _jsx(DialogDescription, { children: description })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: onCancel, disabled: isPending, children: t('common.cancel') }), _jsxs(Button, { variant: "destructive", onClick: onConfirm, disabled: isPending, children: [_jsx(Trash2, { size: 14, className: "mr-1" }), t('common.delete')] })] })] }) }));
}
