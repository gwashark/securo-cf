import { jsx as _jsx } from "react/jsx-runtime";
import { describe, expect, it } from 'vitest';
import { Skeleton } from './skeleton.js';
import { renderWithProviders } from '../../test/utils.js';
describe('Skeleton', () => {
    it('renders a pulsing placeholder', () => {
        const { container } = renderWithProviders(_jsx(Skeleton, {}));
        const skeleton = container.querySelector('[data-slot="skeleton"]');
        expect(skeleton).toBeInTheDocument();
        expect(skeleton).toHaveClass('animate-pulse');
    });
    it('keeps the caller sizing classes', () => {
        const { container } = renderWithProviders(_jsx(Skeleton, { className: "h-8 w-32" }));
        expect(container.querySelector('[data-slot="skeleton"]')).toHaveClass('h-8', 'w-32');
    });
    it('carries no text, so a loading card announces nothing misleading', () => {
        const { container } = renderWithProviders(_jsx(Skeleton, { className: "h-4" }));
        expect(container.textContent).toBe('');
    });
});
