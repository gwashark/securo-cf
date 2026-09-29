import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button.js';
const STEPS = [
    { target: '[data-tour="sidebar"]', titleKey: 'onboarding.sidebar', descKey: 'onboarding.sidebarDesc' },
    { target: '[data-tour="nav-dashboard"]', titleKey: 'onboarding.dashboard', descKey: 'onboarding.dashboardDesc' },
    { target: '[data-tour="nav-accounts"]', titleKey: 'onboarding.accounts', descKey: 'onboarding.accountsDesc' },
    { target: '[data-tour="nav-transactions"]', titleKey: 'onboarding.transactions', descKey: 'onboarding.transactionsDesc' },
    { target: '[data-tour="nav-import"]', titleKey: 'onboarding.import', descKey: 'onboarding.importDesc' },
    { target: '[data-tour="nav-categories"]', titleKey: 'onboarding.categories', descKey: 'onboarding.categoriesDesc' },
];
export function OnboardingTour({ onComplete }) {
    const { t } = useTranslation();
    const [current, setCurrent] = useState(0);
    const [rect, setRect] = useState(null);
    const tooltipRef = useRef(null);
    const updateRect = useCallback(() => {
        const step = STEPS[current];
        const el = document.querySelector(step.target);
        if (el) {
            setRect(el.getBoundingClientRect());
        }
    }, [current]);
    useEffect(() => {
        // Small delay to let the sidebar render
        const timer = setTimeout(updateRect, 100);
        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect, true);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect, true);
        };
    }, [updateRect]);
    const next = () => {
        if (current < STEPS.length - 1) {
            setCurrent(current + 1);
        }
        else {
            onComplete();
        }
    };
    const back = () => {
        if (current > 0) {
            setCurrent(current - 1);
        }
    };
    const step = STEPS[current];
    const pad = 6;
    // Tooltip position: to the right of the target element
    const tooltipStyle = rect
        ? {
            position: 'fixed',
            top: Math.max(8, Math.min(rect.top, window.innerHeight - 220)),
            left: rect.right + 16,
            zIndex: 10001,
            maxWidth: 320,
        }
        : { display: 'none' };
    // If tooltip would go off screen right, put it below instead
    if (rect && rect.right + 16 + 320 > window.innerWidth) {
        tooltipStyle.left = Math.max(8, rect.left);
        tooltipStyle.top = rect.bottom + 12;
    }
    return (_jsxs(_Fragment, { children: [rect && (_jsxs("div", { className: "fixed inset-0 z-[10000] pointer-events-none", children: [_jsx("div", { className: "absolute bg-black/50 pointer-events-auto transition-all duration-300", style: { top: 0, left: 0, right: 0, height: Math.max(0, rect.top - pad) } }), _jsx("div", { className: "absolute bg-black/50 pointer-events-auto transition-all duration-300", style: { top: rect.bottom + pad, left: 0, right: 0, bottom: 0 } }), _jsx("div", { className: "absolute bg-black/50 pointer-events-auto transition-all duration-300", style: {
                            top: Math.max(0, rect.top - pad),
                            left: 0,
                            width: Math.max(0, rect.left - pad),
                            height: rect.height + pad * 2,
                        } }), _jsx("div", { className: "absolute bg-black/50 pointer-events-auto transition-all duration-300", style: {
                            top: Math.max(0, rect.top - pad),
                            left: rect.right + pad,
                            right: 0,
                            height: rect.height + pad * 2,
                        } }), _jsx("div", { className: "absolute rounded-lg ring-2 ring-primary/50 transition-all duration-300", style: {
                            top: rect.top - pad,
                            left: rect.left - pad,
                            width: rect.width + pad * 2,
                            height: rect.height + pad * 2,
                        } })] })), _jsx("div", { ref: tooltipRef, style: tooltipStyle, className: "pointer-events-auto", children: _jsxs("div", { className: "bg-popover text-popover-foreground rounded-xl shadow-lg border p-5 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "font-semibold text-base", children: t(step.titleKey) }), _jsxs("span", { className: "text-xs text-muted-foreground tabular-nums", children: [current + 1, "/", STEPS.length] })] }), _jsx("p", { className: "text-sm text-muted-foreground leading-relaxed", children: t(step.descKey) }), _jsxs("div", { className: "flex items-center justify-between pt-1", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: onComplete, className: "text-muted-foreground", children: t('onboarding.skip') }), _jsxs("div", { className: "flex gap-2", children: [current > 0 && (_jsx(Button, { variant: "outline", size: "sm", onClick: back, children: t('onboarding.back') })), _jsx(Button, { size: "sm", onClick: next, children: current === STEPS.length - 1 ? t('onboarding.finish') : t('onboarding.next') })] })] })] }) })] }));
}
