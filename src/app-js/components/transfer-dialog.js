import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { getAccountLabel, sortAccountsByDisplayName } from '../lib/account-utils.js';
import { useTranslation } from 'react-i18next';
import { localDateString } from '../lib/date-utils.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { DatePickerInput } from './ui/date-picker-input.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from './ui/dialog.js';
import { ArrowRight, Info } from 'lucide-react';
export function TransferDialog({ open, onClose, accounts, onSave, loading, defaultFromAccountId, }) {
    const { t } = useTranslation();
    const sortedAccounts = useMemo(() => sortAccountsByDisplayName(accounts), [accounts]);
    const firstAccountId = sortedAccounts[0]?.id ?? '';
    const [fromAccountId, setFromAccountId] = useState(defaultFromAccountId || firstAccountId);
    const [toAccountId, setToAccountId] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(localDateString);
    const [description, setDescription] = useState('');
    const [notes, setNotes] = useState('');
    const [destinationAmount, setDestinationAmount] = useState('');
    const [formSource, setFormSource] = useState(null);
    if (!formSource || formSource.open !== open || formSource.defaultFromAccountId !== defaultFromAccountId || formSource.firstAccountId !== firstAccountId) {
        setFormSource({ open, defaultFromAccountId, firstAccountId });
        if (open) {
            setFromAccountId(defaultFromAccountId || firstAccountId);
            setToAccountId('');
            setAmount('');
            setDate(localDateString());
            setDescription('');
            setNotes('');
            setDestinationAmount('');
        }
    }
    const fromAccount = accounts.find((a) => a.id === fromAccountId);
    const toAccount = accounts.find((a) => a.id === toAccountId);
    const isCrossCurrency = fromAccount && toAccount && fromAccount.currency !== toAccount.currency;
    const isSameAccount = fromAccountId && toAccountId && fromAccountId === toAccountId;
    const availableToAccounts = sortedAccounts.filter((a) => a.id !== fromAccountId);
    return (_jsx(Dialog, { open: open, onOpenChange: onClose, children: _jsxs(DialogContent, { className: "sm:max-w-lg", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('transactions.transferTitle') }) }), _jsxs("form", { onSubmit: (e) => {
                        e.preventDefault();
                        onSave({
                            from_account_id: fromAccountId,
                            to_account_id: toAccountId,
                            amount: parseFloat(amount),
                            date,
                            description,
                            notes: notes.trim() || undefined,
                            destination_amount: isCrossCurrency && destinationAmount
                                ? parseFloat(destinationAmount)
                                : undefined,
                        });
                    }, className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-[1fr,auto,1fr] items-end gap-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('transactions.transferFromAccount') }), _jsxs("select", { className: "w-full border border-border rounded-md px-3 py-2 text-sm bg-card focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]", value: fromAccountId, onChange: (e) => {
                                                setFromAccountId(e.target.value);
                                                if (e.target.value === toAccountId)
                                                    setToAccountId('');
                                                setDestinationAmount('');
                                            }, required: true, children: [_jsx("option", { value: "", disabled: true, children: t('transactions.account') }), sortedAccounts.map((acc) => (_jsxs("option", { value: acc.id, children: [getAccountLabel(acc), " (", acc.currency, ")"] }, acc.id)))] })] }), _jsx("div", { className: "pb-2", children: _jsx(ArrowRight, { size: 18, className: "text-muted-foreground" }) }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('transactions.transferToAccount') }), _jsxs("select", { className: "w-full border border-border rounded-md px-3 py-2 text-sm bg-card focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]", value: toAccountId, onChange: (e) => {
                                                setToAccountId(e.target.value);
                                                setDestinationAmount('');
                                            }, required: true, children: [_jsx("option", { value: "", disabled: true, children: t('transactions.account') }), availableToAccounts.map((acc) => (_jsxs("option", { value: acc.id, children: [getAccountLabel(acc), " (", acc.currency, ")"] }, acc.id)))] })] })] }), isSameAccount && (_jsx("div", { className: "flex items-center gap-2 p-3 text-sm bg-destructive/10 text-destructive rounded-md", children: t('transactions.transferSameAccount') })), isCrossCurrency && (_jsxs("div", { className: "flex items-center gap-2 p-3 text-sm bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md text-blue-700 dark:text-blue-300", children: [_jsx(Info, { size: 14, className: "shrink-0" }), t('transactions.transferCrossCurrency')] })), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsxs(Label, { children: [t('transactions.transferAmount'), fromAccount && _jsxs("span", { className: "text-muted-foreground ml-1", children: ["(", fromAccount.currency, ")"] })] }), _jsx(Input, { type: "number", step: "0.01", min: "0.01", value: amount, onChange: (e) => setAmount(e.target.value), required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('transactions.date') }), _jsx(DatePickerInput, { value: date, onChange: setDate, className: "w-full justify-start" })] })] }), isCrossCurrency && (_jsxs("div", { className: "space-y-2 p-3 bg-muted/50 border border-border rounded-md", children: [_jsx(Label, { className: "text-xs", children: t('transactions.convertedAmount', { currency: toAccount?.currency }) }), _jsx(Input, { type: "number", step: "0.01", min: "0.01", value: destinationAmount, onChange: (e) => setDestinationAmount(e.target.value), placeholder: t('transactions.autoCalculated') })] })), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('transactions.transferDescription') }), _jsx(Input, { value: description, onChange: (e) => setDescription(e.target.value), required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs(Label, { children: [t('transactions.transferNotes'), ' ', _jsxs("span", { className: "text-muted-foreground font-normal text-xs", children: ["(", t('transactions.notesHint'), ")"] })] }), _jsx("textarea", { className: "w-full border border-input rounded-md px-3 py-2 text-sm bg-card resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0", rows: 2, value: notes, onChange: (e) => setNotes(e.target.value) })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: onClose, children: t('common.cancel') }), _jsx(Button, { type: "submit", disabled: loading || !fromAccountId || !toAccountId || !!isSameAccount, children: loading ? t('common.loading') : t('common.save') })] })] })] }) }));
}
