import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Input } from './input.js';
import { Label } from './label.js';
import { renderWithProviders } from '../../test/utils.js';
describe('Label', () => {
    it('renders its text', () => {
        renderWithProviders(_jsx(Label, { children: "Category" }));
        expect(screen.getByText('Category')).toBeInTheDocument();
    });
    it('associates with the control it names, so the field is reachable by label', async () => {
        const { user } = renderWithProviders(_jsxs(_Fragment, { children: [_jsx(Label, { htmlFor: "payee", children: "Payee" }), _jsx(Input, { id: "payee" })] }));
        const input = screen.getByLabelText('Payee');
        expect(input).toBeInTheDocument();
        // Clicking the label must focus the input, which is the whole point of
        // the association.
        await user.click(screen.getByText('Payee'));
        expect(input).toHaveFocus();
    });
});
