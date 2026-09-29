import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CATEGORY_ICONS } from '../lib/category-icons.js';
import { cn } from '../lib/utils.js';
export function IconPicker({ value, color, onChange }) {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const filtered = useMemo(() => {
        if (!search.trim())
            return CATEGORY_ICONS;
        const q = search.toLowerCase();
        return CATEGORY_ICONS.filter((entry) => entry.name.includes(q) ||
            entry.label.toLowerCase().includes(q));
    }, [search]);
    return (_jsxs("div", { className: "space-y-2", children: [_jsx("input", { type: "text", placeholder: t('common.searchIcon'), className: "w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary", value: search, onChange: (e) => setSearch(e.target.value) }), _jsxs("div", { className: "grid grid-cols-8 gap-1.5 max-h-48 overflow-y-auto p-1", children: [filtered.map((entry) => {
                        const isSelected = value === entry.name;
                        const Icon = entry.icon;
                        return (_jsx("button", { type: "button", title: entry.label, className: cn('w-9 h-9 rounded-lg flex items-center justify-center transition-all', isSelected
                                ? 'ring-2 ring-offset-1 ring-primary'
                                : 'hover:bg-muted'), style: isSelected ? { backgroundColor: color || '#6B7280' } : undefined, onClick: () => onChange(entry.name), children: _jsx(Icon, { size: 18, className: isSelected ? 'text-white' : 'text-muted-foreground', strokeWidth: 2 }) }, entry.name));
                    }), filtered.length === 0 && (_jsx("p", { className: "col-span-8 text-xs text-muted-foreground text-center py-4", children: t('common.noIconsFound') }))] })] }));
}
