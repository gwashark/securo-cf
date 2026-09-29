import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Wrench } from 'lucide-react';
import { cn } from '../../lib/utils.js';
/**
 * Expandable tool-call inspector. Compact by default (status, name, brief
 * summary). Clicking reveals the raw JSON arguments and result — same
 * "show your work" affordance anything-llm uses for agent skills.
 */
export function ToolDebugChip({ name, args, result, pending, defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen);
    const status = pending ? 'pending' : result?.ok === false ? 'error' : result ? 'ok' : 'pending';
    const summary = result?.text || (result?.data && typeof result.data === 'object'
        ? summarizeData(result.data)
        : null);
    return (_jsxs("div", { className: cn('rounded-md border text-xs', status === 'error' ? 'border-rose-300/50 bg-rose-50/40 dark:bg-rose-950/20'
            : status === 'pending' ? 'border-border bg-muted/40'
                : 'border-emerald-300/40 bg-emerald-50/30 dark:bg-emerald-950/15'), children: [_jsxs("button", { type: "button", onClick: () => setOpen((v) => !v), className: "w-full flex items-center gap-2 px-2.5 py-1.5 text-left", children: [status === 'pending' ? (_jsx(Loader2, { className: "h-3 w-3 animate-spin text-muted-foreground shrink-0" })) : status === 'error' ? (_jsx("span", { className: "text-rose-600 font-mono text-[11px] shrink-0", children: "\u2717" })) : (_jsx("span", { className: "text-emerald-600 font-mono text-[11px] shrink-0", children: "\u2713" })), _jsx(Wrench, { className: "h-3 w-3 text-muted-foreground shrink-0" }), _jsx("span", { className: "font-mono truncate", children: name }), summary && (_jsxs("span", { className: "text-muted-foreground truncate flex-1 min-w-0", children: ["\u2014 ", summary] })), open ? (_jsx(ChevronDown, { className: "h-3.5 w-3.5 text-muted-foreground/70 shrink-0" })) : (_jsx(ChevronRight, { className: "h-3.5 w-3.5 text-muted-foreground/70 shrink-0" }))] }), open && (_jsxs("div", { className: "border-t px-2.5 py-2 space-y-2", children: [_jsx(Block, { label: "Arguments", payload: args ?? {} }), result && _jsx(Block, { label: "Result", payload: result.data, fallback: result.text })] }))] }));
}
function Block({ label, payload, fallback }) {
    const json = (() => {
        if (payload === undefined || payload === null) {
            return fallback || '(empty)';
        }
        try {
            return JSON.stringify(payload, null, 2);
        }
        catch {
            return String(payload);
        }
    })();
    return (_jsxs("div", { children: [_jsx("div", { className: "text-[10px] uppercase tracking-wider text-muted-foreground mb-1", children: label }), _jsx("pre", { className: "rounded bg-background/70 border border-border/60 p-2 overflow-x-auto text-[11px] leading-snug font-mono", children: json })] }));
}
function summarizeData(data) {
    if (Array.isArray(data.items)) {
        const n = (data.items).length;
        const total = data.total;
        return `${total ?? n} item${(total ?? n) === 1 ? '' : 's'}`;
    }
    if ('error' in data) {
        return String(data.error);
    }
    if ('kind' in data) {
        return String(data.kind);
    }
    return null;
}
