import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
import { ShellLogo } from './shell-logo.js';
// Left-hand brand panel for the auth/onboarding screens. A deep indigo→violet
// field with a slow purple aurora drifting behind an oversized, translucent
// shell watermark. Decorative only — hidden below `lg`, where the form takes
// the full width and carries its own compact header.
export function AuthBrandPanel() {
    const { t } = useTranslation();
    return (_jsxs("div", { className: "relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between", style: {
            background: 'linear-gradient(150deg, #3F37C9 0%, #5B30C9 48%, #6D28D9 100%)',
        }, children: [_jsxs("div", { "aria-hidden": true, className: "pointer-events-none absolute inset-0", children: [_jsx("div", { className: "securo-aurora securo-aurora-1" }), _jsx("div", { className: "securo-aurora securo-aurora-2" }), _jsx("div", { className: "securo-aurora securo-aurora-3" })] }), _jsx("div", { "aria-hidden": true, className: "pointer-events-none absolute -right-28 -bottom-24 text-white/[0.06]", style: { transform: 'rotate(-8deg)' }, children: _jsx(ShellLogo, { size: 640 }) }), _jsx("div", { "aria-hidden": true, className: "pointer-events-none absolute inset-0", style: {
                    background: 'radial-gradient(115% 90% at 78% 8%, transparent 42%, rgba(20, 12, 60, 0.38) 100%)',
                } }), _jsxs("div", { className: "relative flex items-center gap-2.5", children: [_jsx("div", { className: "flex h-9 w-9 items-center justify-center rounded-lg bg-white/15", children: _jsx(ShellLogo, { size: 20, className: "text-white" }) }), _jsx("span", { className: "text-lg font-semibold tracking-tight", children: "Securo" })] }), _jsxs("div", { className: "relative max-w-md space-y-5", children: [_jsx("h2", { className: "text-[2.6rem] font-semibold leading-[1.08] tracking-tight", children: t('setup.brandTagline') }), _jsx("p", { className: "max-w-sm text-base leading-relaxed text-white/70", children: t('setup.brandSubtitle') }), _jsxs("div", { className: "flex items-center gap-2.5 pt-1 text-xs font-medium text-white/55", children: [_jsx("span", { children: t('setup.brandOpen') }), _jsx("span", { className: "h-1 w-1 rounded-full bg-white/35" }), _jsx("span", { children: t('setup.brandSelfHosted') }), _jsx("span", { className: "h-1 w-1 rounded-full bg-white/35" }), _jsx("span", { children: t('setup.brandPrivate') })] })] })] }));
}
