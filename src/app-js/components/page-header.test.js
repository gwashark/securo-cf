import { jsx as _jsx } from "react/jsx-runtime";
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { PageHeader } from './page-header.js';
import { renderWithProviders } from '../test/utils.js';
describe('PageHeader', () => {
    it('renders the section and the title', () => {
        renderWithProviders(_jsx(PageHeader, { section: "Money", title: "Transactions" }));
        expect(screen.getByText('Money')).toBeInTheDocument();
        expect(screen.getByText('Transactions')).toBeInTheDocument();
    });
    it('renders the title as the page heading', () => {
        // One h1 per screen is what lets a screen-reader user jump to the
        // content; the section line above it is not a heading.
        renderWithProviders(_jsx(PageHeader, { section: "Money", title: "Transactions" }));
        expect(screen.getByRole('heading', { level: 1, name: 'Transactions' })).toBeInTheDocument();
        expect(screen.getAllByRole('heading')).toHaveLength(1);
    });
    it('renders the optional action', () => {
        renderWithProviders(_jsx(PageHeader, { section: "Money", title: "Transactions", action: _jsx("button", { type: "button", children: "New transaction" }) }));
        expect(screen.getByRole('button', { name: 'New transaction' })).toBeInTheDocument();
    });
    it('renders without an action', () => {
        renderWithProviders(_jsx(PageHeader, { section: "Money", title: "Transactions" }));
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});
