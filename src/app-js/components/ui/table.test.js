import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow, } from './table.js';
import { renderWithProviders } from '../../test/utils.js';
function Example() {
    return (_jsxs(Table, { children: [_jsx(TableCaption, { children: "June transactions" }), _jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Date" }), _jsx(TableHead, { children: "Payee" }), _jsx(TableHead, { children: "Amount" })] }) }), _jsxs(TableBody, { children: [_jsxs(TableRow, { children: [_jsx(TableCell, { children: "04/06" }), _jsx(TableCell, { children: "Padaria" }), _jsx(TableCell, { children: "R$ 18,00" })] }), _jsxs(TableRow, { children: [_jsx(TableCell, { children: "05/06" }), _jsx(TableCell, { children: "Uber" }), _jsx(TableCell, { children: "R$ 32,40" })] })] }), _jsx(TableFooter, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: "Total" }), _jsx(TableCell, {}), _jsx(TableCell, { children: "R$ 50,40" })] }) })] }));
}
describe('Table', () => {
    it('renders a semantic table so screen readers can navigate it', () => {
        renderWithProviders(_jsx(Example, {}));
        expect(screen.getByRole('table')).toBeInTheDocument();
    });
    it('exposes its column headers', () => {
        renderWithProviders(_jsx(Example, {}));
        const headers = screen.getAllByRole('columnheader');
        expect(headers.map((h) => h.textContent)).toEqual([
            'Date',
            'Payee',
            'Amount',
        ]);
    });
    it('renders one row per record plus the header and footer rows', () => {
        renderWithProviders(_jsx(Example, {}));
        expect(screen.getAllByRole('row')).toHaveLength(4);
    });
    it('keeps cells in their row', () => {
        renderWithProviders(_jsx(Example, {}));
        const row = screen.getByText('Padaria').closest('tr');
        expect(within(row).getByText('R$ 18,00')).toBeInTheDocument();
        expect(within(row).queryByText('R$ 32,40')).not.toBeInTheDocument();
    });
    it('renders the caption', () => {
        renderWithProviders(_jsx(Example, {}));
        expect(screen.getByText('June transactions')).toBeInTheDocument();
    });
    it('renders an empty body without crashing', () => {
        renderWithProviders(_jsx(Table, { children: _jsx(TableBody, {}) }));
        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(screen.queryAllByRole('row')).toHaveLength(0);
    });
});
