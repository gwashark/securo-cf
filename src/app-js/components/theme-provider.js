import { jsx as _jsx } from "react/jsx-runtime";
import { ThemeProvider as NextThemesProvider } from 'next-themes';
export function ThemeProvider({ children }) {
    return (_jsx(NextThemesProvider, { attribute: "class", defaultTheme: "dark", enableSystem: false, children: children }));
}
