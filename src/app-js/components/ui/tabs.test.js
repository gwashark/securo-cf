import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs.js';
import { renderWithProviders } from '../../test/utils.js';
function Example({ onValueChange, } = {}) {
    return (_jsxs(Tabs, { defaultValue: "expenses", onValueChange: onValueChange, children: [_jsxs(TabsList, { children: [_jsx(TabsTrigger, { value: "expenses", children: "Expenses" }), _jsx(TabsTrigger, { value: "income", children: "Income" }), _jsx(TabsTrigger, { value: "transfers", disabled: true, children: "Transfers" })] }), _jsx(TabsContent, { value: "expenses", children: "expenses panel" }), _jsx(TabsContent, { value: "income", children: "income panel" }), _jsx(TabsContent, { value: "transfers", children: "transfers panel" })] }));
}
describe('Tabs', () => {
    it('shows the default panel and hides the others', () => {
        renderWithProviders(_jsx(Example, {}));
        expect(screen.getByText('expenses panel')).toBeInTheDocument();
        expect(screen.queryByText('income panel')).not.toBeInTheDocument();
    });
    it('marks the active trigger as selected', () => {
        renderWithProviders(_jsx(Example, {}));
        expect(screen.getByRole('tab', { name: 'Expenses' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: 'Income' })).toHaveAttribute('aria-selected', 'false');
    });
    it('switches panels on click', async () => {
        const { user } = renderWithProviders(_jsx(Example, {}));
        await user.click(screen.getByRole('tab', { name: 'Income' }));
        expect(await screen.findByText('income panel')).toBeInTheDocument();
        expect(screen.queryByText('expenses panel')).not.toBeInTheDocument();
    });
    it('reports the newly selected value', async () => {
        const onValueChange = vi.fn();
        const { user } = renderWithProviders(_jsx(Example, { onValueChange: onValueChange }));
        await user.click(screen.getByRole('tab', { name: 'Income' }));
        expect(onValueChange).toHaveBeenCalledWith('income');
    });
    it('ignores a disabled tab', async () => {
        const onValueChange = vi.fn();
        const { user } = renderWithProviders(_jsx(Example, { onValueChange: onValueChange }));
        await user.click(screen.getByRole('tab', { name: 'Transfers' }));
        expect(onValueChange).not.toHaveBeenCalled();
        expect(screen.getByText('expenses panel')).toBeInTheDocument();
    });
    it('exposes the list variant so line styling stays assertable', () => {
        const { container } = renderWithProviders(_jsxs(Tabs, { defaultValue: "a", children: [_jsx(TabsList, { variant: "line", children: _jsx(TabsTrigger, { value: "a", children: "A" }) }), _jsx(TabsContent, { value: "a", children: "panel" })] }));
        expect(container.querySelector('[data-slot="tabs-list"]')).toHaveAttribute('data-variant', 'line');
    });
});
