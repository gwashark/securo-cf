import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function PageHeader({ section, title, action }) {
    return (_jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium text-muted-foreground mb-0.5", children: section }), _jsx("h1", { className: "text-2xl font-semibold text-foreground tracking-tight", children: title })] }), action] }));
}
