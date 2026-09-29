import { jsx as _jsx } from "react/jsx-runtime";
import { act, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/utils.js';
import { ConnectorSelectDialog } from './connector-select-dialog';
import { OAuthConnectDialog } from './oauth-connect-dialog';
import { BankConnectDialog } from './bank-connect-dialog';
const api = vi.hoisted(() => ({ getProviders: vi.fn(), listInstitutions: vi.fn(), getReconnectToken: vi.fn(), getConnectToken: vi.fn(), toastError: vi.fn() }));
vi.mock('../lib/api.js', () => ({ connections: api, auth: api }));
vi.mock('sonner', () => ({ toast: { error: api.toastError } }));
vi.mock('react-pluggy-connect', () => ({ PluggyConnect: ({ connectToken }) => _jsx("div", { children: connectToken }) }));
beforeEach(() => { vi.resetAllMocks(); });
it('ignores provider responses from a closed session when reopened', async () => {
    let finish;
    api.getProviders.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }))
        .mockResolvedValueOnce([{ name: 'new', display_name: 'New provider', description: 'Synthetic', configured: true }]);
    const props = { onClose: vi.fn(), onSelect: vi.fn() };
    const { rerender } = renderWithProviders(_jsx(ConnectorSelectDialog, { open: true, ...props }));
    rerender(_jsx(ConnectorSelectDialog, { open: false, ...props }));
    rerender(_jsx(ConnectorSelectDialog, { open: true, ...props }));
    await screen.findByText('New provider');
    await act(async () => { finish([{ name: 'old', display_name: 'Old provider', configured: true }]); });
    expect(screen.queryByText('Old provider')).not.toBeInTheDocument();
    expect(screen.getByText('New provider')).toBeInTheDocument();
});
it('ignores an earlier country request after back navigation and another selection', async () => {
    let finish;
    api.listInstitutions.mockResolvedValueOnce({ countries: ['DE', 'GB'] })
        .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }))
        .mockResolvedValueOnce({ institutions: [{ country: 'GB', name: 'new', display_name: 'New bank' }] });
    const { user } = renderWithProviders(_jsx(OAuthConnectDialog, { open: true, provider: "synthetic", onClose: vi.fn() }));
    await user.click(await screen.findByText('DE'));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByText('GB'));
    await screen.findByText('New bank');
    await act(async () => { finish({ institutions: [{ country: 'DE', name: 'old', display_name: 'Old bank' }] }); });
    expect(screen.queryByText('Old bank')).not.toBeInTheDocument();
    expect(screen.getByText('New bank')).toBeInTheDocument();
});
it('waits for banks in the remembered country instead of showing an empty result', async () => {
    localStorage.setItem('securo:lastOAuthCountry', 'DE');
    let finish;
    api.listInstitutions.mockResolvedValueOnce({ countries: ['DE'] })
        .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    renderWithProviders(_jsx(OAuthConnectDialog, { open: true, provider: "synthetic", onClose: vi.fn() }));
    await screen.findByRole('button', { name: 'Back' });
    expect(screen.queryByText('No institutions found.')).not.toBeInTheDocument();
    await act(async () => { finish({ institutions: [{ country: 'DE', name: 'bank', display_name: 'Remembered bank' }] }); });
    expect(screen.getByText('Remembered bank')).toBeInTheDocument();
});
it('uses the latest close callback without restarting a bank token request', async () => {
    let reject;
    api.getReconnectToken.mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
    const firstClose = vi.fn();
    const latestClose = vi.fn();
    const { rerender } = renderWithProviders(_jsx(BankConnectDialog, { open: true, reconnectConnectionId: "synthetic", onClose: firstClose }));
    rerender(_jsx(BankConnectDialog, { open: true, reconnectConnectionId: "synthetic", onClose: latestClose }));
    expect(api.getReconnectToken).toHaveBeenCalledTimes(1);
    await act(async () => { reject(new Error('synthetic failure')); });
    expect(firstClose).not.toHaveBeenCalled();
    expect(latestClose).toHaveBeenCalledOnce();
    expect(api.toastError).toHaveBeenCalledOnce();
});
it('ignores token failures after the bank dialog closes', async () => {
    let reject;
    api.getReconnectToken.mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
    const onClose = vi.fn();
    const { rerender } = renderWithProviders(_jsx(BankConnectDialog, { open: true, reconnectConnectionId: "synthetic", onClose: onClose }));
    rerender(_jsx(BankConnectDialog, { open: false, reconnectConnectionId: "synthetic", onClose: onClose }));
    await act(async () => { reject(new Error('late failure')); });
    expect(onClose).not.toHaveBeenCalled();
    expect(api.toastError).not.toHaveBeenCalled();
});
