import { jsx as _jsx } from "react/jsx-runtime";
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Switch } from './switch.js';
import { renderWithProviders } from '../../test/utils.js';
describe('Switch', () => {
    it('exposes its state to assistive tech', () => {
        renderWithProviders(_jsx(Switch, { checked: true, onCheckedChange: vi.fn(), "aria-labelledby": "lbl" }));
        expect(screen.getByRole('switch')).toBeChecked();
    });
    it('reports the flipped value, not the current one', async () => {
        const onCheckedChange = vi.fn();
        const { user } = renderWithProviders(_jsx(Switch, { checked: false, onCheckedChange: onCheckedChange }));
        await user.click(screen.getByRole('switch'));
        expect(onCheckedChange).toHaveBeenCalledWith(true);
    });
    it('flips back off from on', async () => {
        const onCheckedChange = vi.fn();
        const { user } = renderWithProviders(_jsx(Switch, { checked: true, onCheckedChange: onCheckedChange }));
        await user.click(screen.getByRole('switch'));
        expect(onCheckedChange).toHaveBeenCalledWith(false);
    });
    it('stays silent while disabled', async () => {
        const onCheckedChange = vi.fn();
        const { user } = renderWithProviders(_jsx(Switch, { checked: false, onCheckedChange: onCheckedChange, disabled: true }));
        const toggle = screen.getByRole('switch');
        expect(toggle).toBeDisabled();
        await user.click(toggle);
        expect(onCheckedChange).not.toHaveBeenCalled();
    });
    it('is type=button so it cannot submit the form around it', () => {
        // A settings switch inside a form that submits on click would save
        // half-filled state.
        renderWithProviders(_jsx(Switch, { checked: false, onCheckedChange: vi.fn() }));
        expect(screen.getByRole('switch')).toHaveAttribute('type', 'button');
    });
});
