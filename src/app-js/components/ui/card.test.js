import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, } from './card.js';
import { renderWithProviders } from '../../test/utils.js';
describe('Card', () => {
    it('renders every slot it is given', () => {
        renderWithProviders(_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Net worth" }), _jsx(CardDescription, { children: "Across all accounts" }), _jsx(CardAction, { children: _jsx("button", { type: "button", children: "Refresh" }) })] }), _jsx(CardContent, { children: "R$ 12.480,00" }), _jsx(CardFooter, { children: "Updated a minute ago" })] }));
        expect(screen.getByText('Net worth')).toBeInTheDocument();
        expect(screen.getByText('Across all accounts')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
        expect(screen.getByText('R$ 12.480,00')).toBeInTheDocument();
        expect(screen.getByText('Updated a minute ago')).toBeInTheDocument();
    });
    it('tags each slot so layout rules stay addressable', () => {
        const { container } = renderWithProviders(_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Title" }) }), _jsx(CardContent, { children: "Body" })] }));
        expect(container.querySelector('[data-slot="card"]')).toBeInTheDocument();
        expect(container.querySelector('[data-slot="card-header"]')).toBeInTheDocument();
        expect(container.querySelector('[data-slot="card-title"]')).toBeInTheDocument();
        expect(container.querySelector('[data-slot="card-content"]')).toBeInTheDocument();
    });
    it('renders a card with no optional slots', () => {
        renderWithProviders(_jsx(Card, { children: "Bare" }));
        expect(screen.getByText('Bare')).toBeInTheDocument();
    });
});
