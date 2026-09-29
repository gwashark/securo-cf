import { jsx as _jsx } from "react/jsx-runtime";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../lib/i18n.js';
/**
 * Retries and caching are useful in the app and only add flake in a test: a
 * failed query would be retried past the assertion, and a cached one would
 * leak into the next test. Both are off.
 */
export function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0, staleTime: 0 },
            mutations: { retry: false },
        },
    });
}
export function renderWithProviders(ui, options = {}) {
    const { route = '/', path, queryClient = createTestQueryClient(), ...renderOptions } = options;
    function Wrapper({ children }) {
        return (_jsx(I18nextProvider, { i18n: i18n, children: _jsx(QueryClientProvider, { client: queryClient, children: _jsx(MemoryRouter, { initialEntries: [route], children: path ? (_jsx(Routes, { children: _jsx(Route, { path: path, element: children }) })) : (children) }) }) }));
    }
    return {
        ...render(ui, { wrapper: Wrapper, ...renderOptions }),
        queryClient,
        user: userEvent.setup(),
    };
}
/** Translate through the real bundle, so tests assert on the shipped copy. */
export function t(key, options) {
    return i18n.t(key, options);
}
export { i18n };
