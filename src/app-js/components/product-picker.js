import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { PackageSearch } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover.js';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, } from './ui/command.js';
import { products as productsApi } from '../lib/api.js';
import { formatCurrency } from '../lib/format.js';
import { priceFor } from '../lib/product-utils.js';
import { useDisplayLocale } from '../hooks/use-display-locale.js';
import { cn, normalizeText } from '../lib/utils.js';
/**
 * The catalog, as a button beside a line's description.
 *
 * A button rather than a combobox replacing the description field: the
 * field has to stay a plain input, because most lines are typed and a
 * dropdown that opens on every keystroke would get in the way of the
 * common case. The catalog is one click away for the lines that come
 * from it, and invisible to a workspace that never made a product.
 */
export function ProductPicker({ currency, onPick, disabled = false, className, }) {
    const { t } = useTranslation();
    const locale = useDisplayLocale();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    // Only once opened: a workspace without a catalog never asks for one.
    const { data: products = [] } = useQuery({
        queryKey: ['products', 'active'],
        queryFn: () => productsApi.list({ active: true }),
        enabled: open,
    });
    const rows = useMemo(() => [...products]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((product) => ({ product, price: priceFor(product, currency) })), [products, currency]);
    return (_jsxs(Popover, { open: open, onOpenChange: (next) => {
            setOpen(next);
            if (!next)
                setSearch('');
        }, children: [_jsx(PopoverTrigger, { asChild: true, children: _jsx("button", { type: "button", disabled: disabled, "aria-label": t('invoices.products.pick'), title: t('invoices.products.pick'), "data-testid": "invoice-line-pick-product", className: cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50', className), children: _jsx(PackageSearch, { className: "h-4 w-4" }) }) }), _jsx(PopoverContent, { align: "start", className: "w-[340px] p-0 overflow-hidden", children: _jsxs(Command, { filter: (itemValue, query, keywords) => {
                        const text = keywords?.length ? keywords.join(' ') : itemValue;
                        return normalizeText(text).includes(normalizeText(query)) ? 1 : 0;
                    }, children: [_jsx(CommandInput, { placeholder: t('invoices.products.searchPlaceholder'), value: search, onValueChange: setSearch }), _jsxs(CommandList, { children: [_jsx(CommandEmpty, { children: products.length === 0
                                        ? t('invoices.products.emptyPicker')
                                        : t('invoices.products.noneFound') }), _jsx(CommandGroup, { children: rows.map(({ product, price }) => (_jsxs(CommandItem, { value: product.id, keywords: [product.name, product.description ?? ''], onSelect: () => {
                                            onPick(product, price);
                                            setOpen(false);
                                            setSearch('');
                                        }, className: "cursor-pointer", "data-testid": `product-option-${product.id}`, children: [_jsxs("span", { className: "flex-1 min-w-0", children: [_jsx("span", { className: "block truncate", children: product.name }), product.description && (_jsx("span", { className: "block truncate text-[11px] text-muted-foreground", children: product.description }))] }), _jsx("span", { className: "shrink-0 text-xs tabular-nums text-muted-foreground", children: price
                                                    ? formatCurrency(Number(price.unit_price), price.currency, locale) +
                                                        (price.interval ? ` / ${t(`invoices.products.per.${price.interval}`)}` : '')
                                                    : t('invoices.products.noPriceIn', { currency }) })] }, product.id))) })] })] }) })] }));
}
