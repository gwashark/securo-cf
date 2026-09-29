import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Check, Copy, KeyRound, Plug } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs.js';
import { agents } from '../../lib/api.js';
function CopyButton({ value }) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    return (_jsxs("button", { type: "button", onClick: async () => {
            try {
                await navigator.clipboard.writeText(value);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
            }
            catch {
                toast.error(t('agents.mcpExternal.copyFailed', 'Copy failed'));
            }
        }, className: "absolute top-2 right-2 inline-flex items-center gap-1 rounded-md border border-border bg-background/80 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors", children: [copied ? _jsx(Check, { className: "h-3 w-3" }) : _jsx(Copy, { className: "h-3 w-3" }), copied ? t('agents.mcpExternal.copied', 'Copied') : t('agents.mcpExternal.copy', 'Copy')] }));
}
function CodeBlock({ value }) {
    return (_jsxs("div", { className: "relative", children: [_jsx("pre", { className: "bg-muted/50 border border-border rounded-md p-3 pr-16 text-[12px] leading-relaxed overflow-x-auto whitespace-pre", children: _jsx("code", { children: value }) }), _jsx(CopyButton, { value: value })] }));
}
// Builds the per-client integration snippet. Kept as a function so the
// shapes stay co-located with their labels and easy to extend.
function clientConfigFor(client, url, token) {
    if (client === 'claude') {
        // Works for Claude Desktop, Claude Code (.mcp.json), and Cursor.
        return JSON.stringify({
            mcpServers: {
                securo: {
                    url,
                    headers: { Authorization: `Bearer ${token}` },
                },
            },
        }, null, 2);
    }
    // OpenAI Responses API tool spec — paste into the `tools` array of
    // your API call. ChatGPT.com itself adds MCP via the Connectors UI,
    // not a JSON paste.
    return JSON.stringify({
        type: 'mcp',
        server_label: 'securo',
        server_url: url,
        headers: { Authorization: `Bearer ${token}` },
        require_approval: 'never',
    }, null, 2);
}
export function McpExternalPanel() {
    const { t } = useTranslation();
    const { data: info } = useQuery({ queryKey: ['agents-info'], queryFn: () => agents.info() });
    const [result, setResult] = useState(null);
    const [client, setClient] = useState('claude');
    const mintMut = useMutation({
        mutationFn: () => agents.mcpTokens.create(),
        onSuccess: (res) => {
            setResult({ token: res.token, expiresInDays: res.expires_in_days });
        },
        onError: () => toast.error(t('agents.mcpExternal.mintFailed', 'Could not mint token')),
    });
    if (!info)
        return null;
    // Prefer the backend-configured URL (AGENTS_EXTERNAL_MCP_URL) so deployments
    // behind an ingress/reverse proxy can point at a custom host/subpath/port.
    // Fall back to the direct :8765 endpoint derived from the browser location,
    // which matches the default Docker Compose setup.
    const url = info.external_mcp_url ||
        `${window.location.protocol}//${window.location.hostname}:8765/mcp`;
    // The first three snippets are universal regardless of client choice.
    const universalSnippets = result
        ? [
            { label: t('agents.mcpExternal.snippets.token', 'Token'), value: result.token },
            { label: t('agents.mcpExternal.snippets.url', 'MCP endpoint'), value: url },
            {
                label: t('agents.mcpExternal.snippets.curl', 'curl example'),
                value: `curl -X POST ${url} \\\n  -H "Authorization: Bearer ${result.token}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
            },
        ]
        : [];
    const clientTabs = [
        { id: 'claude', label: t('agents.mcpExternal.clients.claude', 'Claude Desktop / Code / Cursor') },
        { id: 'openai', label: t('agents.mcpExternal.clients.openai', 'OpenAI Responses API') },
    ];
    return (_jsxs("div", { className: "mt-8 bg-card rounded-xl border border-border shadow-sm overflow-hidden", children: [_jsxs("div", { className: "flex items-start gap-3 px-4 sm:px-5 py-4 border-b border-border", children: [_jsx("div", { className: "h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0", children: _jsx(Plug, { className: "h-5 w-5 text-muted-foreground" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("h2", { className: "text-base font-semibold", children: t('agents.mcpExternal.title', 'External MCP access') }), _jsx("p", { className: "text-sm text-muted-foreground mt-1", children: t('agents.mcpExternal.subtitle', "Plug an external agent (Claude Desktop, ChatGPT, n8n, a custom client) into Securo's built-in MCP server. The token below is scoped to your user and expires in {{days}} days.", { days: info.mcp_external_ttl_days }) })] })] }), _jsx("div", { className: "px-4 sm:px-5 py-4 space-y-4", children: !result ? (_jsxs(Button, { size: "sm", className: "gap-1.5 h-8", onClick: () => mintMut.mutate(), disabled: mintMut.isPending, children: [_jsx(KeyRound, { size: 13 }), mintMut.isPending
                            ? t('agents.mcpExternal.minting', 'Generating…')
                            : t('agents.mcpExternal.mint', 'Generate token')] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "text-xs text-muted-foreground", children: t('agents.mcpExternal.warning', "Copy now — Securo does not store the token, so we can't show it again. Revoke by rotating AGENTS_MCP_JWT_SECRET.") }), universalSnippets.map((s) => (_jsxs("div", { children: [_jsx("div", { className: "text-xs font-medium text-muted-foreground mb-1.5", children: s.label }), _jsx(CodeBlock, { value: s.value })] }, s.label))), _jsxs("div", { children: [_jsx("div", { className: "text-xs font-medium text-muted-foreground mb-1.5", children: t('agents.mcpExternal.snippets.clientConfig', 'Client integration') }), _jsxs(Tabs, { value: client, onValueChange: (v) => setClient(v), children: [_jsx(TabsList, { className: "h-8", children: clientTabs.map((tab) => (_jsx(TabsTrigger, { value: tab.id, className: "text-xs px-2.5 py-1", children: tab.label }, tab.id))) }), clientTabs.map((tab) => (_jsx(TabsContent, { value: tab.id, className: "mt-2", children: _jsx(CodeBlock, { value: clientConfigFor(tab.id, url, result.token) }) }, tab.id)))] })] }), _jsx(Button, { variant: "outline", size: "sm", className: "h-8 text-xs", onClick: () => {
                                setResult(null);
                                mintMut.reset();
                            }, children: t('agents.mcpExternal.regenerate', 'Generate another') })] })) })] }));
}
