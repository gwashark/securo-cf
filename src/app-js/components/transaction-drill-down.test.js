import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { TransactionDrillDown } from './transaction-drill-down.js';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog.js';
import { admin, dashboard, transactions } from '../lib/api.js';
import { renderWithProviders } from '../test/utils.js';
vi.mock('../contexts/auth-context.js', () => ({
    useAuth: () => ({ user: { preferences: { currency_display: 'USD' } } }),
}));
vi.mock('../lib/api.js', () => ({
    transactions: { list: vi.fn() },
    dashboard: { projectedTransactions: vi.fn() },
    admin: { accountingMode: vi.fn() },
}));
const filter = { title: 'Uncategorized', uncategorized: true };
function renderPanel({ dialogOpen }) {
    const onClose = vi.fn();
    const result = renderWithProviders(_jsxs(_Fragment, { children: [_jsx(TransactionDrillDown, { filter: filter, onClose: onClose }), _jsx(Dialog, { open: dialogOpen, children: _jsxs(DialogContent, { children: [_jsx(DialogTitle, { children: "Edit transaction" }), _jsx("button", { type: "button", children: "Category" })] }) })] }));
    return { ...result, onClose };
}
// The outside-click listener is attached after a short delay so the click
// that opened the panel does not close it.
async function waitForOutsideClickListener() {
    await new Promise(resolve => setTimeout(resolve, 150));
}
describe('TransactionDrillDown', () => {
    beforeEach(() => {
        vi.mocked(transactions.list).mockResolvedValue({ items: [], total: 0 });
        vi.mocked(dashboard.projectedTransactions).mockResolvedValue([]);
        vi.mocked(admin.accountingMode).mockResolvedValue({ mode: 'cash' });
    });
    afterEach(() => {
        vi.resetAllMocks();
    });
    it('closes on a click outside the panel', async () => {
        const { onClose } = renderPanel({ dialogOpen: false });
        await waitForOutsideClickListener();
        fireEvent.mouseDown(document.body);
        expect(onClose).toHaveBeenCalledTimes(1);
    });
    it('stays open while the user clicks inside a dialog opened from it', async () => {
        const { onClose } = renderPanel({ dialogOpen: true });
        await waitForOutsideClickListener();
        fireEvent.mouseDown(await screen.findByRole('button', { name: 'Category' }));
        expect(onClose).not.toHaveBeenCalled();
    });
    it('leaves Escape to the open dialog', async () => {
        const { onClose } = renderPanel({ dialogOpen: true });
        await screen.findByRole('dialog');
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).not.toHaveBeenCalled();
    });
    it('closes on Escape when no dialog is open', async () => {
        const { onClose } = renderPanel({ dialogOpen: false });
        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });
});
