import { jsx as _jsx } from "react/jsx-runtime";
import { ICON_MAP, isEmoji } from '../lib/category-icons.js';
import { CircleHelp } from 'lucide-react';
import { cn } from '../lib/utils.js';
const SIZES = {
    xs: { box: 'w-4 h-4 rounded', icon: 10 },
    sm: { box: 'w-6 h-6 rounded-md', icon: 14 },
    md: { box: 'w-8 h-8 rounded-lg', icon: 16 },
    lg: { box: 'w-10 h-10 rounded-xl', icon: 20 },
    xl: { box: 'w-11 h-11 rounded-xl', icon: 22 },
};
export function CategoryIcon({ icon, color, size = 'md', className }) {
    const { box, icon: iconSize } = SIZES[size];
    const bgColor = color || '#6B7280';
    const iconStr = icon || 'circle-help';
    // Emoji fallback for backward compatibility
    if (isEmoji(iconStr)) {
        return (_jsx("div", { className: cn(box, 'flex items-center justify-center shrink-0', className), style: { backgroundColor: bgColor }, children: _jsx("span", { style: { fontSize: iconSize - 2, lineHeight: 1 }, children: iconStr }) }));
    }
    const LucideIcon = ICON_MAP[iconStr] ?? CircleHelp;
    return (_jsx("div", { className: cn(box, 'flex items-center justify-center shrink-0', className), style: { backgroundColor: bgColor }, children: _jsx(LucideIcon, { size: iconSize, className: "text-white", strokeWidth: 2 }) }));
}
