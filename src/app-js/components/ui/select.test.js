import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from './select.js';
import { renderWithProviders } from '../../test/utils.js';
function Example({ onValueChange, defaultValue, disabled, } = {}) {
    return (_jsxs(Select, { defaultValue: defaultValue, onValueChange: onValueChange, disabled: disabled, children: [_jsx(SelectTrigger, { "aria-label": "Currency", children: _jsx(SelectValue, { placeholder: "Pick a currency" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "BRL", children: "Brazilian Real" }), _jsx(SelectItem, { value: "USD", children: "US Dollar" }), _jsx(SelectItem, { value: "EUR", children: "Euro" })] })] }));
}
describe('Select', () => {
    it('shows the placeholder until something is chosen', () => {
        renderWithProviders(_jsx(Example, {}));
        expect(screen.getByText('Pick a currency')).toBeInTheDocument();
    });
    it('shows the default value instead of the placeholder', () => {
        renderWithProviders(_jsx(Example, { defaultValue: "USD" }));
        expect(screen.getByText('US Dollar')).toBeInTheDocument();
        expect(screen.queryByText('Pick a currency')).not.toBeInTheDocument();
    });
    it('keeps its options closed until opened', () => {
        renderWithProviders(_jsx(Example, {}));
        expect(screen.queryByRole('option', { name: 'Euro' })).not.toBeInTheDocument();
    });
    it('opens on click and lists every option', async () => {
        const { user } = renderWithProviders(_jsx(Example, {}));
        await user.click(screen.getByRole('combobox', { name: 'Currency' }));
        expect(await screen.findByRole('option', { name: 'Brazilian Real' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'US Dollar' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Euro' })).toBeInTheDocument();
    });
    it('reports the chosen value', async () => {
        const onValueChange = vi.fn();
        const { user } = renderWithProviders(_jsx(Example, { onValueChange: onValueChange }));
        await user.click(screen.getByRole('combobox', { name: 'Currency' }));
        await user.click(await screen.findByRole('option', { name: 'Euro' }));
        expect(onValueChange).toHaveBeenCalledWith('EUR');
        // The trigger has to follow. Reporting the value while still showing the
        // placeholder is a real Radix misconfiguration and the mock cannot see it.
        expect(screen.getByRole('combobox', { name: 'Currency' })).toHaveTextContent('Euro');
        expect(screen.queryByText('Pick a currency')).not.toBeInTheDocument();
    });
    it('does not open while disabled', async () => {
        const { user } = renderWithProviders(_jsx(Example, { disabled: true }));
        const trigger = screen.getByRole('combobox', { name: 'Currency' });
        expect(trigger).toBeDisabled();
        await user.click(trigger);
        expect(screen.queryByRole('option', { name: 'Euro' })).not.toBeInTheDocument();
    });
});
