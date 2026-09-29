import { jsx as _jsx } from "react/jsx-runtime";
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Badge } from './badge.js';
import { renderWithProviders } from '../../test/utils.js';
describe('Badge', () => {
    it('renders its content', () => {
        renderWithProviders(_jsx(Badge, { children: "Pending" }));
        expect(screen.getByText('Pending')).toBeInTheDocument();
    });
    it('defaults to the default variant', () => {
        renderWithProviders(_jsx(Badge, { children: "Cleared" }));
        expect(screen.getByText('Cleared')).toHaveAttribute('data-variant', 'default');
    });
    it('records the requested variant', () => {
        renderWithProviders(_jsx(Badge, { variant: "destructive", children: "Overdue" }));
        expect(screen.getByText('Overdue')).toHaveAttribute('data-variant', 'destructive');
    });
    it('renders as a link when asChild is set', () => {
        renderWithProviders(_jsx(Badge, { asChild: true, children: _jsx("a", { href: "/rules", children: "3 rules" }) }));
        expect(screen.getByRole('link', { name: '3 rules' })).toHaveAttribute('href', '/rules');
    });
    it('keeps whitespace-nowrap so a long label cannot wrap mid-badge', () => {
        // #693 was a label wrapping inside its container. The class is the
        // contract that prevents it.
        renderWithProviders(_jsx(Badge, { children: "Starts with" }));
        expect(screen.getByText('Starts with')).toHaveClass('whitespace-nowrap');
    });
});
