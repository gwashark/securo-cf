import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { AgentsRoute } from './agents-route.js';
import { renderWithProviders } from '../test/utils.js';
const useFeatureFlags = vi.hoisted(() => vi.fn());
vi.mock('../hooks/use-feature-flags.js', () => ({ useFeatureFlags }));
function renderGuard() {
    return renderWithProviders(_jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx("div", { children: "home" }) }), _jsx(Route, { path: "/agents", element: _jsx(AgentsRoute, { children: _jsx("div", { children: "agents page" }) }) })] }), { route: '/agents' });
}
describe('AgentsRoute', () => {
    it('renders the page when the server has agents enabled', () => {
        useFeatureFlags.mockReturnValue({ agentsEnabled: true, isLoading: false });
        renderGuard();
        expect(screen.getByText('agents page')).toBeInTheDocument();
    });
    it('sends the user home when AGENTS_ENABLED is off', () => {
        // Agents is opt-in. A deployment that never enabled it must not render a
        // management page whose every API call would 404.
        useFeatureFlags.mockReturnValue({ agentsEnabled: false, isLoading: false });
        renderGuard();
        expect(screen.getByText('home')).toBeInTheDocument();
        expect(screen.queryByText('agents page')).not.toBeInTheDocument();
    });
    it('shows a loading indicator rather than assuming the flag is off', () => {
        useFeatureFlags.mockReturnValue({ agentsEnabled: false, isLoading: true });
        const { container } = renderGuard();
        // Without the spinner assertion this passes on a guard that renders
        // nothing, which is a blank screen rather than a wait.
        expect(container.querySelector('.animate-spin')).toBeInTheDocument();
        expect(screen.queryByText('home')).not.toBeInTheDocument();
        expect(screen.queryByText('agents page')).not.toBeInTheDocument();
    });
});
