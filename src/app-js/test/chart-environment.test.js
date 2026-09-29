import { jsx as _jsx } from "react/jsx-runtime";
import { render, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
it('measures a real responsive chart without hiding console warnings', async () => {
    const warn = vi.spyOn(console, 'warn');
    try {
        const { container } = render(_jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsx(LineChart, { data: [{ value: 1 }, { value: 2 }], children: _jsx(Line, { dataKey: "value", isAnimationActive: false }) }) }));
        await waitFor(() => expect(container.querySelector('svg')).toHaveAttribute('width', '800'));
        expect(container.querySelector('svg')).toHaveAttribute('height', '300');
        expect(warn).not.toHaveBeenCalled();
    }
    finally {
        warn.mockRestore();
    }
});
