import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from '../../lib/utils.js';
export function Switch({ checked, onCheckedChange, disabled, id, className, ...rest }) {
    return (_jsx("button", { type: "button", role: "switch", id: id, "aria-checked": checked, "aria-labelledby": rest['aria-labelledby'], disabled: disabled, onClick: () => onCheckedChange(!checked), className: cn('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent transition-colors', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background', 'disabled:cursor-not-allowed disabled:opacity-50', checked ? 'bg-primary' : 'bg-input', className), children: _jsx("span", { "aria-hidden": "true", className: cn('pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-sm ring-0 transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5') }) }));
}
