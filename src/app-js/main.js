import '@vitejs/plugin-react/preamble';
import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { i18nReady } from './lib/i18n';
import App from './App';
// Honour a persisted language before rendering any translated UI.
void i18nReady.then(() => {
    createRoot(document.getElementById('root')).render(_jsx(StrictMode, { children: _jsx(App, {}) }));
});
