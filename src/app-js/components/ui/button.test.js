import { jsx as _jsx } from "react/jsx-runtime";
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Button } from './button.js';
import { renderWithProviders } from '../../test/utils.js';
describe('Button', () => {
    it('renders its label as a real button element', () => {
        renderWithProviders(_jsx(Button, { children: "Save changes" }));
        const button = screen.getByRole('button', { name: 'Save changes' });
        expect(button).toBeInTheDocument();
        expect(button.tagName).toBe('BUTTON');
    });
    it('calls onClick when pressed', async () => {
        const onClick = vi.fn();
        const { user } = renderWithProviders(_jsx(Button, { onClick: onClick, children: "Confirm" }));
        await user.click(screen.getByRole('button', { name: 'Confirm' }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });
    it('does not fire onClick while disabled', async () => {
        const onClick = vi.fn();
        const { user } = renderWithProviders(_jsx(Button, { disabled: true, onClick: onClick, children: "Delete" }));
        const button = screen.getByRole('button', { name: 'Delete' });
        expect(button).toBeDisabled();
        await user.click(button);
        expect(onClick).not.toHaveBeenCalled();
    });
    it('exposes variant and size so styling regressions stay assertable', () => {
        renderWithProviders(_jsx(Button, { variant: "destructive", size: "sm", children: "Remove" }));
        const button = screen.getByRole('button', { name: 'Remove' });
        expect(button).toHaveAttribute('data-variant', 'destructive');
        expect(button).toHaveAttribute('data-size', 'sm');
    });
    it('renders as the child element when asChild is set', () => {
        renderWithProviders(_jsx(Button, { asChild: true, children: _jsx("a", { href: "/accounts", children: "Go to accounts" }) }));
        const link = screen.getByRole('link', { name: 'Go to accounts' });
        expect(link).toHaveAttribute('href', '/accounts');
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
    it('keeps a caller className alongside the variant classes', () => {
        renderWithProviders(_jsx(Button, { className: "w-full", children: "Wide" }));
        expect(screen.getByRole('button', { name: 'Wide' })).toHaveClass('w-full');
    });
});
