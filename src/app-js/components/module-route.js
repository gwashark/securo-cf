import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { Navigate } from 'react-router-dom';
import { useWorkspace } from '../contexts/workspace-context.js';
/** Wraps a module's pages so navigating straight to the URL when the
 *  active workspace doesn't show that module lands on home instead of
 *  rendering it. Hiding the nav link alone leaves the page reachable.
 *  Mirrors AdminRoute / AgentsRoute. */
export function ModuleRoute({ module, children, }) {
    const { hasModule, isLoading } = useWorkspace();
    if (isLoading) {
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen", children: _jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-primary" }) }));
    }
    if (!hasModule(module))
        return _jsx(Navigate, { to: "/", replace: true });
    return _jsx(_Fragment, { children: children });
}
