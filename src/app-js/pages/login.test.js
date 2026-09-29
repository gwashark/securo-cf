import { jsx as _jsx } from "react/jsx-runtime";
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import LoginPage from './login.js';
import { renderWithProviders, t } from '../test/utils.js';
const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => ({
    ...(await importOriginal()),
    useNavigate: () => navigate,
}));
const authContext = vi.hoisted(() => ({
    login: vi.fn(),
    verify2fa: vi.fn(),
    loginWithToken: vi.fn(),
    token: null,
}));
vi.mock('../contexts/auth-context.js', () => ({ useAuth: () => authContext }));
const api = vi.hoisted(() => ({
    setup: { status: vi.fn() },
    auth: {
        oidcConfig: vi.fn(),
        passkeyAuthenticationOptions: vi.fn(),
        verifyPasskeyAuthentication: vi.fn(),
    },
    admin: { registrationStatus: vi.fn(), defaultColors: vi.fn() },
}));
vi.mock('../lib/api.js', () => ({
    setup: api.setup,
    auth: api.auth,
    admin: api.admin,
}));
const webauthn = vi.hoisted(() => ({
    isPasskeySupported: vi.fn(),
    isConditionalPasskeySupported: vi.fn(),
    passkeyFailure: vi.fn(),
    startPasskeyAuthentication: vi.fn(),
    startConditionalPasskeyAuthentication: vi.fn(),
}));
vi.mock('../lib/webauthn.js', () => webauthn);
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
/** Build the axios-shaped rejection the page branches on. */
function httpError(status) {
    return (status === undefined
        ? { isAxiosError: true, response: undefined }
        : { isAxiosError: true, response: { status } });
}
beforeEach(() => {
    vi.clearAllMocks();
    authContext.token = null;
    api.setup.status.mockResolvedValue({ has_users: true });
    api.auth.oidcConfig.mockResolvedValue({
        enabled: false,
        provider_name: 'OIDC',
        local_auth_enabled: true,
    });
    api.admin.registrationStatus.mockResolvedValue({ enabled: true });
    api.admin.defaultColors.mockResolvedValue({ light: null, dark: null });
    webauthn.isPasskeySupported.mockReturnValue(false);
    webauthn.isConditionalPasskeySupported.mockResolvedValue(false);
    webauthn.passkeyFailure.mockReturnValue('unknown');
});
async function renderLogin() {
    const rendered = renderWithProviders(_jsx(LoginPage, {}), { route: '/login' });
    await screen.findByLabelText(t('auth.email'));
    return rendered;
}
describe('LoginPage', () => {
    it('renders the credentials form', async () => {
        await renderLogin();
        expect(screen.getByLabelText(t('auth.email'))).toBeInTheDocument();
        expect(screen.getByLabelText(t('auth.password'))).toBeInTheDocument();
        expect(screen.getByRole('button', { name: t('auth.login') })).toBeInTheDocument();
    });
    it('signs in and lands on the dashboard', async () => {
        authContext.login.mockResolvedValue({ requires_2fa: false });
        const { user } = await renderLogin();
        await user.type(screen.getByLabelText(t('auth.email')), 'tassio@example.com');
        await user.type(screen.getByLabelText(t('auth.password')), 'secret');
        await user.click(screen.getByRole('button', { name: t('auth.login') }));
        await waitFor(() => expect(authContext.login).toHaveBeenCalledWith('tassio@example.com', 'secret'));
        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
    });
    it('asks for the second factor instead of navigating when 2FA is on', async () => {
        authContext.login.mockResolvedValue({
            requires_2fa: true,
            temp_token: 'temp',
            available_methods: ['totp'],
        });
        const { user } = await renderLogin();
        await user.type(screen.getByLabelText(t('auth.email')), 'tassio@example.com');
        await user.type(screen.getByLabelText(t('auth.password')), 'secret');
        await user.click(screen.getByRole('button', { name: t('auth.login') }));
        expect(await screen.findByText(t('auth.twoFactorTitle'))).toBeInTheDocument();
        expect(navigate).not.toHaveBeenCalledWith('/');
    });
    it('tells the user their credentials were rejected', async () => {
        authContext.login.mockRejectedValue(httpError(401));
        const { user } = await renderLogin();
        await user.type(screen.getByLabelText(t('auth.email')), 'a@b.com');
        await user.type(screen.getByLabelText(t('auth.password')), 'wrong');
        await user.click(screen.getByRole('button', { name: t('auth.login') }));
        expect(await screen.findByText(t('auth.invalidCredentials'))).toBeInTheDocument();
    });
    it('distinguishes an outage from a wrong password', async () => {
        // Issue #318: collapsing every failure into "invalid credentials" made a
        // stopped backend look like the user's own mistake.
        authContext.login.mockRejectedValue(httpError());
        const { user } = await renderLogin();
        await user.type(screen.getByLabelText(t('auth.email')), 'a@b.com');
        await user.type(screen.getByLabelText(t('auth.password')), 'right');
        await user.click(screen.getByRole('button', { name: t('auth.login') }));
        expect(await screen.findByText(t('auth.serverError'))).toBeInTheDocument();
        expect(screen.queryByText(t('auth.invalidCredentials'))).not.toBeInTheDocument();
    });
    it('reports a 5xx as an outage too', async () => {
        authContext.login.mockRejectedValue(httpError(502));
        const { user } = await renderLogin();
        await user.type(screen.getByLabelText(t('auth.email')), 'a@b.com');
        await user.type(screen.getByLabelText(t('auth.password')), 'right');
        await user.click(screen.getByRole('button', { name: t('auth.login') }));
        expect(await screen.findByText(t('auth.serverError'))).toBeInTheDocument();
    });
    it('names rate limiting rather than blaming the password', async () => {
        authContext.login.mockRejectedValue(httpError(429));
        const { user } = await renderLogin();
        await user.type(screen.getByLabelText(t('auth.email')), 'a@b.com');
        await user.type(screen.getByLabelText(t('auth.password')), 'right');
        await user.click(screen.getByRole('button', { name: t('auth.login') }));
        expect(await screen.findByText(t('auth.tooManyAttempts'))).toBeInTheDocument();
    });
    it('sends an already-signed-in visitor away from the login screen', async () => {
        authContext.token = 'jwt';
        renderWithProviders(_jsx(LoginPage, {}), { route: '/login' });
        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }));
    });
    it('redirects a fresh install to the setup wizard', async () => {
        // No users yet: sending someone to a login form they cannot pass is a
        // dead end.
        api.setup.status.mockResolvedValue({ has_users: false });
        renderWithProviders(_jsx(LoginPage, {}), { route: '/login' });
        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/setup', { replace: true }));
    });
    it('offers registration when the server allows it', async () => {
        await renderLogin();
        expect(await screen.findByRole('link', { name: t('auth.register') })).toBeInTheDocument();
    });
    it('does not spend the challenge when the conditional ceremony is aborted', async () => {
        // The challenge is one-shot on the server (Redis `getdel`). Verifying one
        // the user walked away from burns it, and the next attempt gets nothing.
        webauthn.isPasskeySupported.mockReturnValue(true);
        webauthn.isConditionalPasskeySupported.mockResolvedValue(true);
        api.auth.passkeyAuthenticationOptions.mockResolvedValue({
            options: {},
            challenge_id: 'challenge-1',
        });
        let handBackCredential = () => { };
        webauthn.startConditionalPasskeyAuthentication.mockReturnValue(new Promise((resolve) => {
            handBackCredential = resolve;
        }));
        const { unmount } = renderWithProviders(_jsx(LoginPage, {}), { route: '/login' });
        await waitFor(() => expect(webauthn.startConditionalPasskeyAuthentication).toHaveBeenCalled());
        // Leaving the page aborts the ceremony, but the pending browser promise
        // can still settle afterwards.
        unmount();
        handBackCredential({ id: 'credential' });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(api.auth.verifyPasskeyAuthentication).not.toHaveBeenCalled();
    });
    it('survives the optional config calls failing', async () => {
        // A reverse proxy that blocks /api/admin must not blank the login form.
        api.admin.registrationStatus.mockRejectedValue(new Error('403'));
        api.admin.defaultColors.mockRejectedValue(new Error('403'));
        api.auth.oidcConfig.mockRejectedValue(new Error('500'));
        await renderLogin();
        expect(screen.getByLabelText(t('auth.email'))).toBeInTheDocument();
        expect(screen.getByRole('button', { name: t('auth.login') })).toBeInTheDocument();
    });
});
