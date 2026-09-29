import { jsx as _jsx } from "react/jsx-runtime";
import { fireEvent, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { TransferDialog } from './transfer-dialog';
import { renderWithProviders } from '../test/utils.js';
vi.mock('../contexts/auth-context.js', () => ({ useAuth: () => ({ user: null }) }));
it('preserves a transfer draft on rerender and resets all amounts and accounts on reopen', () => {
    const accounts = [
        { id: 'a', name: 'Source', type: 'checking', currency: 'USD' },
        { id: 'b', name: 'Destination', type: 'checking', currency: 'EUR' },
    ];
    const props = { accounts, onClose: vi.fn(), onSave: vi.fn(), loading: false, defaultFromAccountId: 'a' };
    const { rerender } = renderWithProviders(_jsx(TransferDialog, { ...props, open: true }));
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'b' } });
    const amounts = screen.getAllByRole('spinbutton');
    fireEvent.change(amounts[0], { target: { value: '23' } });
    fireEvent.change(amounts[1], { target: { value: '21' } });
    rerender(_jsx(TransferDialog, { ...props, open: true }));
    expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(23);
    expect(screen.getAllByRole('spinbutton')[1]).toHaveValue(21);
    rerender(_jsx(TransferDialog, { ...props, open: false }));
    rerender(_jsx(TransferDialog, { ...props, open: true }));
    expect(screen.getAllByRole('combobox')[0]).toHaveValue('a');
    expect(screen.getAllByRole('combobox')[1]).toHaveValue('');
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
    expect(screen.getByRole('spinbutton')).toHaveValue(null);
});
