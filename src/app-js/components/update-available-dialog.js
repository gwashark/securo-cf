import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, Copy, Download, Info, Sparkles, Bug, Server, CheckCircle2, BellOff, } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from './ui/dialog.js';
import { Button } from './ui/button.js';
import { Switch } from './ui/switch.js';
import { APP_VERSION } from '../lib/build-info.js';
import { useAutoUpdateCheck } from '../hooks/use-auto-update-check.js';
import { useLatestRelease } from '../hooks/use-latest-release.js';
import { isUpdateAvailable } from '../lib/semver.js';
const UPGRADE_COMMAND = 'git pull && docker compose up -d --build';
export function UpdateAvailableDialog({ open, onClose, }) {
    const { t } = useTranslation();
    const { enabled, setEnabled } = useAutoUpdateCheck();
    const { data, isFetching } = useLatestRelease();
    const [copied, setCopied] = useState(false);
    const hasUpdate = data ? isUpdateAvailable(APP_VERSION, data.tagName) : false;
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(UPGRADE_COMMAND);
            setCopied(true);
            toast.success(t('update.copied'));
            setTimeout(() => setCopied(false), 2000);
        }
        catch {
            toast.error(t('update.copyFailed'));
        }
    };
    return (_jsx(Dialog, { open: open, onOpenChange: (v) => !v && onClose(), children: _jsxs(DialogContent, { className: "sm:max-w-lg", children: [_jsx(DialogHeader, { children: _jsxs("div", { className: "flex items-center justify-between gap-3 pr-6", children: [_jsx(DialogTitle, { children: t('update.title') }), _jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground", children: [_jsx(Server, { size: 12 }), _jsx("span", { className: "tabular-nums font-semibold text-foreground", children: APP_VERSION }), _jsx("span", { className: "h-1 w-1 rounded-full bg-muted-foreground/40" }), _jsx("span", { children: t('update.runningLabel') })] })] }) }), _jsxs("div", { className: "space-y-5", children: [!enabled && (_jsxs("div", { className: "flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-700 dark:text-amber-400", children: [_jsx(BellOff, { size: 16, className: "shrink-0 mt-0.5" }), _jsx("p", { className: "leading-relaxed", children: t('update.autoCheckDisabled') })] })), enabled && isFetching && !data && (_jsx("div", { className: "rounded-lg border bg-muted/40 px-3.5 py-3 text-sm text-muted-foreground", children: t('update.checking') })), enabled && data && !hasUpdate && (_jsxs("div", { className: "flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400", children: [_jsx(CheckCircle2, { size: 18, className: "shrink-0" }), _jsxs("span", { className: "flex-1", children: [t('update.upToDate'), ' ', _jsx("span", { className: "tabular-nums font-bold", children: data.tagName })] })] })), enabled && hasUpdate && data && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400", children: [_jsx(Download, { size: 18, className: "shrink-0" }), _jsxs("span", { className: "flex-1", children: [t('update.newVersionAvailable'), ' ', _jsx("span", { className: "font-bold tabular-nums", children: data.tagName })] })] }), _jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-sm text-foreground/80", children: t('update.description') }), _jsxs("ul", { className: "space-y-2 text-sm text-foreground/80", children: [_jsxs("li", { className: "flex items-start gap-2.5", children: [_jsx(Sparkles, { size: 15, className: "text-primary shrink-0 mt-0.5" }), _jsx("span", { children: t('update.reasonFeatures') })] }), _jsxs("li", { className: "flex items-start gap-2.5", children: [_jsx(Bug, { size: 15, className: "text-primary shrink-0 mt-0.5" }), _jsx("span", { children: t('update.reasonBugs') })] })] })] }), _jsxs("div", { className: "flex items-start gap-2.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3.5 py-3 text-sm text-blue-700 dark:text-blue-300", children: [_jsx(Info, { size: 16, className: "shrink-0 mt-0.5" }), _jsxs("p", { className: "leading-relaxed", children: [t('update.releaseNotesHintBefore'), ' ', _jsx("a", { href: data.htmlUrl, target: "_blank", rel: "noreferrer noopener", className: "font-medium underline underline-offset-2 hover:opacity-80", children: t('update.releaseNotesLink') }), ' ', t('update.releaseNotesHintAfter')] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground", children: t('update.commandLabel') }), _jsxs("code", { className: "block rounded-md border bg-muted/50 px-3 py-2.5 font-mono text-xs text-foreground break-all", children: [_jsx("span", { className: "select-none text-muted-foreground mr-2", children: "$" }), UPGRADE_COMMAND] })] })] })), _jsxs("div", { className: "flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3.5 py-2.5", children: [_jsx("label", { htmlFor: "auto-update-check", className: "text-sm font-medium cursor-pointer select-none", children: t('update.autoCheckToggle') }), _jsx(Switch, { id: "auto-update-check", checked: enabled, onCheckedChange: setEnabled })] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: onClose, children: hasUpdate ? t('common.cancel') : t('common.close') }), hasUpdate && (_jsxs(Button, { type: "button", onClick: handleCopy, children: [copied ? _jsx(Check, { size: 14 }) : _jsx(Copy, { size: 14 }), copied ? t('update.copied') : t('update.copyCommand')] }))] })] }) }));
}
