import { jsx as _jsx } from "react/jsx-runtime";
import { describe, expect, it } from 'vitest';
import { Separator } from './separator.js';
import { renderWithProviders } from '../../test/utils.js';
describe('Separator', () => {
    it('defaults to a horizontal decorative rule', () => {
        const { container } = renderWithProviders(_jsx(Separator, {}));
        const separator = container.querySelector('[data-slot="separator"]');
        expect(separator).toHaveAttribute('data-orientation', 'horizontal');
        // Decorative separators are hidden from the accessibility tree, which is
        // what we want for pure visual dividers.
        expect(separator).toHaveAttribute('role', 'none');
    });
    it('supports a vertical orientation', () => {
        const { container } = renderWithProviders(_jsx(Separator, { orientation: "vertical" }));
        expect(container.querySelector('[data-slot="separator"]')).toHaveAttribute('data-orientation', 'vertical');
    });
    it('becomes a real separator for assistive tech when not decorative', () => {
        const { container } = renderWithProviders(_jsx(Separator, { decorative: false }));
        expect(container.querySelector('[data-slot="separator"]')).toHaveAttribute('role', 'separator');
    });
});
