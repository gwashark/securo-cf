import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, } from './avatar.js';
import { renderWithProviders } from '../../test/utils.js';
describe('Avatar', () => {
    it('renders the fallback when no image resolves', () => {
        // jsdom never loads images, which is also what a member with no avatar
        // looks like in the app.
        renderWithProviders(_jsx(Avatar, { children: _jsx(AvatarFallback, { children: "TN" }) }));
        expect(screen.getByText('TN')).toBeInTheDocument();
    });
    it('defaults to the default size', () => {
        const { container } = renderWithProviders(_jsx(Avatar, { children: _jsx(AvatarFallback, { children: "TN" }) }));
        expect(container.querySelector('[data-slot="avatar"]')).toHaveAttribute('data-size', 'default');
    });
    it('records the requested size, which the child styling keys off', () => {
        const { container } = renderWithProviders(_jsx(Avatar, { size: "lg", children: _jsx(AvatarFallback, { children: "TN" }) }));
        expect(container.querySelector('[data-slot="avatar"]')).toHaveAttribute('data-size', 'lg');
    });
    it('renders a group with an overflow count', () => {
        renderWithProviders(_jsxs(AvatarGroup, { children: [_jsx(Avatar, { children: _jsx(AvatarFallback, { children: "A" }) }), _jsx(Avatar, { children: _jsx(AvatarFallback, { children: "B" }) }), _jsx(AvatarGroupCount, { children: "+3" })] }));
        expect(screen.getByText('A')).toBeInTheDocument();
        expect(screen.getByText('B')).toBeInTheDocument();
        expect(screen.getByText('+3')).toBeInTheDocument();
    });
});
