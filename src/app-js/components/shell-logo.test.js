import { jsx as _jsx } from "react/jsx-runtime";
import { describe, expect, it } from 'vitest';
import { ShellLogo } from './shell-logo.js';
import { renderWithProviders } from '../test/utils.js';
describe('ShellLogo', () => {
    it('renders an svg at the default size', () => {
        const { container } = renderWithProviders(_jsx(ShellLogo, {}));
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
        expect(svg).toHaveAttribute('width', '24');
        expect(svg).toHaveAttribute('height', '24');
    });
    it('honours an explicit size on both axes', () => {
        const { container } = renderWithProviders(_jsx(ShellLogo, { size: 64 }));
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('width', '64');
        expect(svg).toHaveAttribute('height', '64');
    });
    it('keeps the viewBox fixed so the mark never distorts', () => {
        const { container } = renderWithProviders(_jsx(ShellLogo, { size: 120 }));
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('viewBox', '0 0 460 460');
        expect(svg).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
    });
    it('fills from currentColor, so it follows the theme', () => {
        const { container } = renderWithProviders(_jsx(ShellLogo, {}));
        expect(container.querySelector('g')).toHaveAttribute('fill', 'currentColor');
    });
    it('accepts a className', () => {
        const { container } = renderWithProviders(_jsx(ShellLogo, { className: "text-primary" }));
        expect(container.querySelector('svg')).toHaveClass('text-primary');
    });
});
