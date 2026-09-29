import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckIcon, ChevronDownIcon, PlusIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover.js';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command.js';
import { WorkspaceContext } from '../contexts/workspace-context.js';
import { payees as payeesApi } from '../lib/api.js';
import { inlineCreateItemValue, inlineCreateName } from '../lib/inline-create.js';
import { payeeErrorMessage } from '../lib/payee-error-message.js';
import { cn, normalizeText } from '../lib/utils.js';
/** Searchable payee picker. An empty value means "no payee". */
export function PayeeSelect({ value, onChange, payees, disabled = false, className, creatable = false, }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    // The payee just created here, shown until the refetched list has it.
    const [created, setCreated] = useState(null);
    const canWrite = useContext(WorkspaceContext)?.canWrite ?? false;
    const canCreate = creatable && canWrite;
    const sortedPayees = useMemo(() => [...(payees ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [payees]);
    const selected = useMemo(() => sortedPayees.find((p) => p.id === value)
        ?? (created && created.id === value ? created : undefined), [sortedPayees, created, value]);
    function handleOpenChange(next) {
        setOpen(next);
        if (!next)
            setSearch('');
    }
    const createMutation = useMutation({
        mutationFn: (name) => payeesApi.create({ name }),
        onSuccess: (payee) => {
            queryClient.invalidateQueries({ queryKey: ['payees'] });
            setCreated(payee);
            onChange(payee.id);
            handleOpenChange(false);
            toast.success(t('payees.created'));
        },
        onError: (err) => toast.error(payeeErrorMessage(err, t) ?? t('common.error')),
    });
    const createName = canCreate
        ? inlineCreateName(search, sortedPayees.map((p) => p.name))
        : null;
    return (_jsxs(Popover, { open: open, onOpenChange: handleOpenChange, children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs("button", { type: "button", disabled: disabled, className: cn("flex w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm text-left shadow-xs transition-[color,box-shadow] outline-hidden focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50 h-9 cursor-pointer", className), children: [_jsx("span", { className: "min-w-0 truncate", children: selected ? (selected.name) : (_jsx("span", { className: "text-muted-foreground", children: t('payees.noPayee') })) }), _jsx(ChevronDownIcon, { className: "size-4 shrink-0 opacity-50" })] }) }), _jsx(PopoverContent, { align: "start", className: "w-[var(--radix-popover-trigger-width)] p-0 overflow-hidden", children: _jsxs(Command, { filter: (itemValue, query, keywords) => {
                        // Payee rows match on their name (keywords), never on the id
                        // that only keeps their cmdk value unique.
                        const text = keywords?.length ? keywords.join(' ') : itemValue;
                        return normalizeText(text).includes(normalizeText(query)) ? 1 : 0;
                    }, children: [_jsx(CommandInput, { placeholder: t('payees.searchPlaceholder'), value: search, onValueChange: setSearch }), _jsxs(CommandList, { children: [_jsx(CommandEmpty, { children: t('payees.noPayeeFound') }), _jsxs(CommandGroup, { children: [_jsxs(CommandItem, { value: `__none__ ${t('payees.noPayee')}`, onSelect: () => {
                                                onChange('');
                                                handleOpenChange(false);
                                            }, className: "italic text-muted-foreground cursor-pointer", children: [_jsx("span", { className: "flex-1", children: t('payees.noPayee') }), value === '' && _jsx(CheckIcon, { className: "size-4 shrink-0" })] }), sortedPayees.map((payee) => (_jsxs(CommandItem, { value: payee.id, keywords: [payee.name], onSelect: () => {
                                                onChange(payee.id);
                                                handleOpenChange(false);
                                            }, className: "cursor-pointer", children: [_jsx("span", { className: "flex-1 truncate", children: payee.name }), value === payee.id && _jsx(CheckIcon, { className: "size-4 shrink-0" })] }, payee.id)))] }), createName && (_jsx(CommandGroup, { children: _jsxs(CommandItem, { value: inlineCreateItemValue(search), disabled: createMutation.isPending, onSelect: () => createMutation.mutate(createName), className: "cursor-pointer", children: [_jsx(PlusIcon, { className: "size-4 shrink-0 text-muted-foreground" }), _jsx("span", { className: "truncate", children: t('common.createNamed', { name: createName }) })] }) }))] })] }) })] }));
}
