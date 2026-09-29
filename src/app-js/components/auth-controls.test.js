import { jsx as _jsx } from "react/jsx-runtime";
/**
 * A server can switch to OIDC-only after users have already enrolled TOTP or a
 * passkey. There are no recovery codes, so if the menu hides those entries the
 * enrolled factor becomes unremovable. These tests assert the removal paths stay
 * reachable on both menu surfaces while enrollment stays hidden.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AppLayout } from './app-layout';
import { TwoFactorSetup } from './two-factor-setup';
import { renderWithProviders, t } from '../test/utils.js';
const state = vi.hoisted(() => ({
    user: {
        email: 'synthetic@example.com',
        is_2fa_enabled: true,
        is_superuser: false,
        preferences: { onboarding_completed: true },
    },
    workspace: { id: 'synthetic', name: 'Synthetic workspace', kind: 'personal', role: 'owner' },
    auth: {
        oidcConfig: vi.fn(),
        listPasskeys: vi.fn(),
        deletePasskey: vi.fn(),
        disable2fa: vi.fn(),
        setup2fa: vi.fn(),
        enable2fa: vi.fn(),
        registerPasskeyOptions: vi.fn(),
        verifyPasskeyRegistration: vi.fn(),
    },
}));
vi.mock('../contexts/auth-context.js', () => ({
    useAuth: () => ({
        user: state.user,
        logout: vi.fn(),
        updateUser: (user) => {
            state.user = user;
        },
    }),
}));
vi.mock('../contexts/workspace-context.js', () => ({
    useWorkspace: () => ({
        current: state.workspace,
        workspaces: [state.workspace],
        switchWorkspace: vi.fn(),
        refresh: vi.fn(),
        hasModule: () => false,
        canWrite: false,
        isLoading: false,
    }),
}));
vi.mock('../contexts/collection-filter-context.js', () => ({
    useCollectionFilter: () => ({ activeAccountIds: null }),
}));
vi.mock('../hooks/use-feature-flags.js', () => ({
    useFeatureFlags: () => ({ isLoading: false, agentsEnabled: false }),
}));
vi.mock('../lib/api.js', () => ({
    auth: state.auth,
    admin: {
        defaultColors: async () => ({ light: null, dark: null }),
        numberFormat: async () => ({ format: 'auto' }),
    },
    accounts: { list: async () => [] },
    workspaces: { create: vi.fn() },
    info: { get: async () => ({ features: {} }) },
}));
vi.mock('../lib/webauthn.js', () => ({
    passkeyBlocker: () => null,
    passkeyFailure: () => 'unknown',
    startPasskeyRegistration: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }));
vi.mock('./collection-selector.js', () => ({ CollectionSelector: () => null }));
vi.mock('./command-palette.js', () => ({ CommandPalette: () => null }));
vi.mock('./global-chat-panel.js', () => ({ GlobalChatPanel: () => null }));
vi.mock('./update-available-banner.js', () => ({ UpdateAvailableBanner: () => null }));
vi.mock('./update-available-dialog.js', () => ({ UpdateAvailableDialog: () => null }));
vi.mock('./backup-dialog.js', () => ({ BackupDialog: () => null }));
/** The sidebar switcher (desktop) and the header avatar (mobile) are separate menus. */
function openMenu(surface) {
    return surface === 'mobile'
        ? screen.getByRole('button', { name: t('common.userMenu') })
        : screen.getByRole('button', { name: /Synthetic workspace/ });
}
beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('securo.sidebar.collapsed');
    state.user = { ...state.user, is_2fa_enabled: true };
    state.auth.oidcConfig.mockResolvedValue({
        enabled: true,
        local_auth_enabled: false,
        provider_name: 'SSO',
    });
    state.auth.listPasskeys.mockResolvedValue([
        { id: 'synthetic-key', name: 'Saved key', created_at: '2026-01-01T00:00:00Z', last_used_at: null },
    ]);
    state.auth.disable2fa.mockResolvedValue({});
    state.auth.deletePasskey.mockResolvedValue(undefined);
});
it('collapses the desktop sidebar and persists the preference', async () => {
    const { user } = renderWithProviders(_jsx(AppLayout, {}));
    const toggle = screen.getByRole('button', { name: t('nav.collapseSidebar') });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    expect(localStorage.getItem('securo.sidebar.collapsed')).toBe('true');
    expect(screen.getByRole('button', { name: t('nav.expandSidebar') })).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('aside')).toHaveAttribute('data-collapsed', 'true');
    expect(document.querySelector('main')).toHaveClass('lg:ml-16');
    await user.click(screen.getByRole('button', { name: /Synthetic workspace/ }));
    expect(screen.getByRole('menuitem', { name: /Workspace settings/ })).toBeInTheDocument();
});
it('restores a collapsed desktop sidebar from local storage', () => {
    localStorage.setItem('securo.sidebar.collapsed', 'true');
    renderWithProviders(_jsx(AppLayout, {}));
    expect(screen.getByRole('button', { name: t('nav.expandSidebar') })).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('main')).toHaveClass('lg:ml-16');
});
it.each(['desktop', 'mobile'])('keeps 2FA and passkey removal reachable from the %s menu in OIDC-only mode', async (surface) => {
    const { user } = renderWithProviders(_jsx(AppLayout, {}));
    await waitFor(() => expect(state.auth.oidcConfig).toHaveBeenCalled());
    await user.click(openMenu(surface));
    expect(screen.queryByRole('menuitem', { name: t('auth.changePassword') })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: t('auth.disable2fa') }));
    const twoFactorDialog = screen.getByRole('dialog');
    await user.type(within(twoFactorDialog).getByLabelText(t('auth.password')), 'synthetic-password');
    await user.type(within(twoFactorDialog).getByLabelText(t('auth.twoFactor')), '123456');
    await user.click(within(twoFactorDialog).getByRole('button', { name: t('auth.disable2fa') }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(state.auth.disable2fa).toHaveBeenCalledWith('synthetic-password', '123456');
    // The entry retires with the factor it removed.
    await user.click(openMenu(surface));
    expect(screen.queryByRole('menuitem', { name: t('auth.disable2fa') })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: t('auth.passkeysTitle') }));
    await screen.findByText('Saved key');
    expect(screen.getByText(t('auth.passkeysCleanupDescription'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('auth.addPasskey') })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('auth.deletePasskey') }));
    await user.click(screen.getByRole('button', { name: t('common.delete') }));
    expect(await screen.findByText(t('auth.noPasskeys'))).toBeInTheDocument();
    expect(state.auth.deletePasskey).toHaveBeenCalledWith('synthetic-key');
    expect(state.auth.setup2fa).not.toHaveBeenCalled();
    expect(state.auth.enable2fa).not.toHaveBeenCalled();
    expect(state.auth.registerPasskeyOptions).not.toHaveBeenCalled();
});
it.each(['desktop', 'mobile'])('still offers the full local credential menu on the %s surface', async (surface) => {
    state.auth.oidcConfig.mockResolvedValue({ enabled: false, local_auth_enabled: true });
    state.user = { ...state.user, is_2fa_enabled: false };
    const { user } = renderWithProviders(_jsx(AppLayout, {}));
    await waitFor(() => expect(state.auth.oidcConfig).toHaveBeenCalled());
    await user.click(openMenu(surface));
    expect(screen.getByRole('menuitem', { name: t('auth.changePassword') })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: t('auth.twoFactorTitle') })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: t('auth.passkeysTitle') }));
    await screen.findByText('Saved key');
    expect(screen.getByRole('button', { name: t('auth.addPasskey') })).toBeInTheDocument();
});
it('never offers TOTP enrollment once the enrolled factor is gone', () => {
    state.user = { ...state.user, is_2fa_enabled: false };
    renderWithProviders(_jsx(TwoFactorSetup, { open: true, localAuthEnabled: false, onClose: vi.fn() }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(state.auth.setup2fa).not.toHaveBeenCalled();
});
