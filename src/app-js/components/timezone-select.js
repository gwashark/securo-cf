import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover.js';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command.js';
import { timezoneCityLabel, timezoneOffsetLabel, timezoneRegion } from '../lib/timezone-utils.js';
import { cn, normalizeText } from '../lib/utils.js';
/**
 * A searchable timezone picker, grouped by region the way the category
 * picker groups by category group. Typing "sao paulo", "America/Sao" or
 * "gmt-3" all find America/Sao_Paulo; the flat 600-row dropdown it replaces
 * asked the user to scroll.
 */
export function TimezoneSelect({ value, onChange, options, emptyOption, id, disabled = false, className, 'aria-describedby': describedBy, }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const groups = useMemo(() => {
        const byRegion = new Map();
        for (const name of options) {
            const region = timezoneRegion(name);
            byRegion.set(region, [...(byRegion.get(region) ?? []), name]);
        }
        // Regions in alphabetical order; the few names without a region (UTC,
        // GMT and the legacy aliases) close the list.
        return [...byRegion.entries()]
            .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
            .map(([region, names]) => ({ region, names: [...names].sort() }));
    }, [options]);
    // Offsets are computed once per open, not once per keystroke.
    const offsets = useMemo(() => {
        if (!open)
            return new Map();
        const now = new Date();
        return new Map(options.map((name) => [name, timezoneOffsetLabel(name, now)]));
    }, [open, options]);
    function handleOpenChange(next) {
        setOpen(next);
        if (!next)
            setSearch('');
    }
    function choose(next) {
        onChange(next);
        handleOpenChange(false);
    }
    const selectedOffset = value ? timezoneOffsetLabel(value) : null;
    return (_jsxs(Popover, { open: open, onOpenChange: handleOpenChange, children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs("button", { type: "button", id: id, role: "combobox", "aria-expanded": open, "aria-describedby": describedBy, disabled: disabled, className: cn('flex w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm text-left shadow-xs transition-[color,box-shadow] outline-hidden focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50 h-9 cursor-pointer', className), children: [_jsx("span", { className: "flex items-center gap-2 min-w-0 truncate", children: value ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "truncate", children: value }), selectedOffset && (_jsx("span", { className: "shrink-0 text-xs tabular-nums text-muted-foreground", children: selectedOffset }))] })) : (_jsx("span", { className: cn('truncate', emptyOption ? 'italic text-muted-foreground' : 'text-muted-foreground'), children: emptyOption ?? t('common.selectTimezone') })) }), _jsx(ChevronDownIcon, { className: "size-4 shrink-0 opacity-50" })] }) }), _jsx(PopoverContent, { align: "start", className: "w-[var(--radix-popover-trigger-width)] min-w-72 p-0 overflow-hidden", children: _jsxs(Command, { filter: (itemValue, query) => (normalizeText(itemValue).includes(normalizeText(query)) ? 1 : 0), children: [_jsx(CommandInput, { placeholder: t('common.searchTimezone'), value: search, onValueChange: setSearch }), _jsxs(CommandList, { children: [_jsx(CommandEmpty, { children: t('common.noTimezoneFound') }), emptyOption && (_jsx(CommandGroup, { children: _jsxs(CommandItem, { value: `default ${emptyOption}`, onSelect: () => choose(''), className: "italic text-muted-foreground cursor-pointer", children: [_jsx("span", { className: "flex-1 truncate", children: emptyOption }), value === '' && _jsx(CheckIcon, { className: "size-4 shrink-0" })] }) })), groups.map(({ region, names }) => (_jsxs(CommandGroup, { children: [region && (_jsx("div", { className: "px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70", children: region })), names.map((name) => {
                                            const offset = offsets.get(name);
                                            return (_jsxs(CommandItem, { value: `${name} ${timezoneCityLabel(name)} ${offset ?? ''}`, onSelect: () => choose(name), className: "cursor-pointer", children: [_jsxs("span", { className: "flex items-baseline gap-2 min-w-0 truncate flex-1", children: [_jsx("span", { className: "truncate", children: timezoneCityLabel(name) }), _jsx("span", { className: "truncate text-xs text-muted-foreground", children: name })] }), offset && (_jsx("span", { className: "shrink-0 text-xs tabular-nums text-muted-foreground", children: offset })), value === name && _jsx(CheckIcon, { className: "size-4 shrink-0" })] }, name));
                                        })] }, region || 'other')))] })] }) })] }));
}
