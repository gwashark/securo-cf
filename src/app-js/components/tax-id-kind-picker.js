import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from './ui/button.js';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, } from './ui/command.js';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover.js';
import { countryFlag } from '../lib/country-flag.js';
import { countryName } from '../lib/country-name.js';
import { taxIdCountry, taxIdFlag } from '../lib/tax-id-country.js';
/** Accent-insensitive, so "italia" finds "Itália" and "franca" finds "França". */
function normalise(value) {
    return value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
}
/**
 * Picks which fiscal document a row holds.
 *
 * Grouped by country and searchable, because the flat list it replaced asked
 * the user to already know that Partita IVA is Italian and SIRET is French.
 * Typing "Itália" now surfaces that country's documents, and typing "CNPJ"
 * finds it directly.
 *
 * The grouping is not hardcoded here: which documents a country uses comes
 * from the jurisdiction packs on the server. A copy in the browser would be a
 * second source of truth for the same fact.
 */
export function TaxIdKindPicker({ kinds, jurisdictions, activeJurisdiction, value, documentValue, used, onChange, }) {
    const { t, i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    const locale = i18n.language;
    const byKind = useMemo(() => new Map(kinds.map((k) => [k.kind, k])), [kinds]);
    const label = (kind) => {
        const option = byKind.get(kind);
        return option ? t(option.label_key, kind.toUpperCase()) : kind.toUpperCase();
    };
    // From the platform's own locale data rather than the translation files:
    // forty-odd country names across ten locales would be pure restatement, and
    // every new pack would add ten more strings to keep in sync.
    const country = (code) => countryName(code, locale);
    const selectedCountry = taxIdCountry(value, documentValue, jurisdictions);
    const selectedFlag = taxIdFlag(value, documentValue, jurisdictions);
    /**
     * Where the tick goes. A kind is listed under every country that asks for
     * it, so a Greek VAT id used to show as selected under Germany too, which
     * reads as though Germany were the choice. When the value tells us the
     * country, only that country is ticked; while the field is still empty
     * nothing has narrowed it down, so every instance is.
     */
    const isSelected = (kind, jurisdiction) => kind === value && (!selectedCountry || selectedCountry === jurisdiction);
    // JSX rather than a string so the flag can be given room: the group's own
    // padding puts it flush against the edge otherwise.
    const groupHeading = (label, flag) => (_jsxs("span", { className: "flex items-center gap-2 pl-1.5", children: [flag ? _jsx("span", { "aria-hidden": true, children: flag }) : null, _jsx("span", { children: label })] }));
    // Scoped to this picker rather than to CommandGroup itself: the global search
    // palette uses the same primitive and its headings are spaced as they are on
    // purpose. Without this the country name sits flush against the first
    // document under it, so the two read as one line.
    const groupClass = '[&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:pt-1';
    // The workspace's own country first: it is what the overwhelming majority of
    // rows will use, and scrolling past seven other countries to reach it would
    // be the same mistake in a different shape.
    const groups = useMemo(() => {
        const ordered = [...jurisdictions].sort((a, b) => {
            if (a.code === activeJurisdiction)
                return -1;
            if (b.code === activeJurisdiction)
                return 1;
            // Locale-aware, so the accented names sort where a reader expects them
            // rather than after Z.
            return country(a.code).localeCompare(country(b.code), locale);
        });
        return ordered.filter((j) => j.kinds.length > 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jurisdictions, activeJurisdiction, locale]);
    return (_jsxs(Popover, { open: open, onOpenChange: setOpen, children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs(Button, { variant: "outline", role: "combobox", "aria-expanded": open, className: "w-48 shrink-0 justify-between font-normal", 
                    // The longest labels ("Número de IVA") still truncate once the flag
                    // takes its share of the width, so the full one stays reachable.
                    title: label(value), children: [_jsxs("span", { className: "flex min-w-0 items-center gap-1.5", children: [selectedFlag ? (_jsx("span", { "aria-hidden": true, className: "shrink-0", children: selectedFlag })) : null, _jsx("span", { className: "truncate", children: label(value) })] }), _jsx(ChevronsUpDown, { size: 13, className: "ml-1 shrink-0 opacity-50" })] }) }), _jsx(PopoverContent, { className: "w-64 p-0", align: "start", children: _jsxs(Command, { filter: (value, search, keywords) => {
                        const query = normalise(search);
                        if (!query)
                            return 1;
                        const haystack = normalise([value, ...(keywords ?? [])].join(' '));
                        return haystack.includes(query) ? 1 : 0;
                    }, children: [_jsx(CommandInput, { placeholder: t('payees.searchTaxIdKind', 'Search document or country…') }), _jsxs(CommandList, { className: "max-h-[280px]", children: [_jsx(CommandEmpty, { children: t('common.noResults', 'No results') }), groups.map((jurisdiction) => (_jsx(CommandGroup, { className: groupClass, heading: groupHeading(country(jurisdiction.code), countryFlag(jurisdiction.code)), children: jurisdiction.kinds.map((kind) => (_jsxs(CommandItem, { value: `${jurisdiction.code}-${kind}`, keywords: [label(kind), country(jurisdiction.code)], disabled: kind !== value && used.has(kind), onSelect: () => {
                                            onChange(kind);
                                            setOpen(false);
                                        }, children: [_jsx("span", { className: "flex-1", children: label(kind) }), isSelected(kind, jurisdiction.code) && (_jsx(Check, { size: 13, className: "text-primary" }))] }, `${jurisdiction.code}-${kind}`))) }, jurisdiction.code))), _jsx(CommandGroup, { className: groupClass, heading: groupHeading(t('fiscal.anyCountry', 'Anywhere else')), children: _jsxs(CommandItem, { value: "other", keywords: [label('other')], disabled: value !== 'other' && used.has('other'), onSelect: () => {
                                            onChange('other');
                                            setOpen(false);
                                        }, children: [_jsx("span", { className: "flex-1", children: label('other') }), value === 'other' && _jsx(Check, { size: 13, className: "text-primary" })] }) })] })] }) })] }));
}
