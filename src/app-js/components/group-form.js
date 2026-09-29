import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { currencies as currenciesApi } from '../lib/api.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
const KIND_OPTIONS = [
    { value: 'social', tKey: 'splitGroups.kind.social' },
    { value: 'cost_center', tKey: 'splitGroups.kind.cost_center' },
    { value: 'project', tKey: 'splitGroups.kind.project' },
    { value: 'client', tKey: 'splitGroups.kind.client' },
    { value: 'other', tKey: 'splitGroups.kind.other' },
];
export function GroupForm({ name, onChangeName, kind, onChangeKind, defaultCurrency, onChangeDefaultCurrency, notes, onChangeNotes, }) {
    const { t } = useTranslation();
    const { data: supportedCurrencies } = useQuery({
        queryKey: ['currencies'],
        queryFn: currenciesApi.list,
        staleTime: Infinity,
    });
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('splitGroups.name') }), _jsx(Input, { placeholder: t('splitGroups.name'), value: name, onChange: (e) => onChangeName(e.target.value) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('splitGroups.kindLabel') }), _jsx("select", { className: "w-full border border-border rounded-md px-3 py-2 text-sm bg-card h-9 focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]", value: kind, onChange: (e) => onChangeKind(e.target.value), children: KIND_OPTIONS.map((opt) => (_jsx("option", { value: opt.value, children: t(opt.tKey) }, opt.value))) }), _jsx("p", { className: "text-xs text-muted-foreground", children: t('splitGroups.kindHint') })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('splitGroups.defaultCurrency') }), _jsx("select", { className: "w-full border border-border rounded-md px-3 py-2 text-sm bg-card h-9 focus:outline-none focus-visible:ring-ring/30 focus-visible:ring-[2px]", value: defaultCurrency, onChange: (e) => onChangeDefaultCurrency(e.target.value), children: (supportedCurrencies ?? [
                            { code: defaultCurrency, symbol: defaultCurrency, name: defaultCurrency, flag: '' },
                        ]).map((c) => (_jsxs("option", { value: c.code, children: [c.flag, " ", c.name] }, c.code))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('splitGroups.notes') }), _jsx("textarea", { className: "w-full border border-input rounded-md px-3 py-2 text-sm bg-card resize-none h-20", value: notes, onChange: (e) => onChangeNotes(e.target.value) })] })] }));
}
