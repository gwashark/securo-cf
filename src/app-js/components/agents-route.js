import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { Navigate } from 'react-router-dom';
import { useFeatureFlags } from '../hooks/use-feature-flags.js';
/** Wraps every /agents/* page so navigating directly to the URL when
 *  AGENTS_ENABLED is false on the server kicks the user back to home
 *  instead of rendering a broken management page that would 404 on
 *  every API call. Mirrors AdminRoute's pattern. */
export function AgentsRoute({ children }) {
    const { agentsEnabled, isLoading } = useFeatureFlags();
    if (isLoading) {
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen", children: _jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-primary" }) }));
    }
    if (!agentsEnabled)
        return _jsx(Navigate, { to: "/", replace: true });
    return _jsx(_Fragment, { children: children });
}
