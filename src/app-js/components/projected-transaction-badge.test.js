import { jsx as _jsx } from "react/jsx-runtime";
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { ProjectedTransactionBadge } from './projected-transaction-badge.js';
import { i18n, renderWithProviders, t } from '../test/utils.js';
describe('ProjectedTransactionBadge', () => {
    it('labels a projected transaction from the bundle', () => {
        renderWithProviders(_jsx(ProjectedTransactionBadge, {}));
        expect(screen.getByText(t('transactions.projected'))).toBeInTheDocument();
    });
    it('renders translated copy, not the raw key', () => {
        // A missing key renders as "transactions.projected" in the UI, which is
        // the shape the Dutch locale regression took (#653).
        renderWithProviders(_jsx(ProjectedTransactionBadge, {}));
        expect(screen.queryByText('transactions.projected')).not.toBeInTheDocument();
    });
    it('follows the active language', async () => {
        await i18n.changeLanguage('pt-BR');
        try {
            renderWithProviders(_jsx(ProjectedTransactionBadge, {}));
            expect(screen.getByText(t('transactions.projected'))).toBeInTheDocument();
        }
        finally {
            await i18n.changeLanguage('en');
        }
    });
});
