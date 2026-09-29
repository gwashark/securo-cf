import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle2, Edit2, Plug, Plus, Star, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button.js';
import { Badge } from '../components/ui/badge.js';
import { PageHeader } from '../components/page-header.js';
import { agents } from '../lib/api.js';
import { ConnectionFormDialog } from '../components/agents/connection-form-dialog.js';
import { McpExternalPanel } from '../components/agents/mcp-external-panel.js';
import { useWorkspace } from '../contexts/workspace-context.js';
export default function AgentConnectionsPage() {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const { canWrite } = useWorkspace();
    const [editing, setEditing] = useState(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [testResults, setTestResults] = useState({});
    const { data: list, isLoading } = useQuery({
        queryKey: ['agent-connections'],
        queryFn: () => agents.connections.list(),
    });
    const removeMut = useMutation({
        mutationFn: (id) => agents.connections.remove(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['agent-connections'] });
            toast.success(t('agents.connections.deleted'));
        },
    });
    const testMut = useMutation({
        mutationFn: (id) => agents.connections.test(id),
        onSuccess: (res, id) => {
            setTestResults((r) => ({ ...r, [id]: { ok: res.ok, detail: res.detail } }));
        },
    });
    return (_jsxs("div", { children: [_jsxs(Link, { to: "/agents", className: "inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors", children: [_jsx(ArrowLeft, { className: "h-3.5 w-3.5" }), " ", t('agents.title')] }), _jsx(PageHeader, { section: t('agents.title'), title: t('agents.connections.title'), action: canWrite ? (_jsxs(Button, { size: "sm", className: "gap-1.5 h-8", onClick: () => setCreateOpen(true), children: [_jsx(Plus, { size: 13 }), " ", t('agents.connections.add')] })) : undefined }), _jsx("p", { className: "text-sm text-muted-foreground mb-6 max-w-2xl", children: t('agents.connections.subtitle') }), isLoading ? (_jsx("div", { className: "bg-card rounded-xl border border-border shadow-sm p-6 text-sm text-muted-foreground", children: t('agents.loading') })) : (list?.length ?? 0) === 0 ? (_jsxs("div", { className: "bg-card rounded-xl border border-border shadow-sm p-10 text-center", children: [_jsx("div", { className: "h-12 w-12 mx-auto rounded-full bg-muted flex items-center justify-center mb-3", children: _jsx(Plug, { className: "h-6 w-6 text-muted-foreground" }) }), _jsx("h2", { className: "text-base font-semibold", children: t('agents.connections.empty.title') }), _jsx("p", { className: "text-sm text-muted-foreground mt-1 max-w-md mx-auto", children: t('agents.connections.empty.subtitle') }), canWrite && (_jsxs(Button, { size: "sm", className: "gap-1.5 h-8 mt-4", onClick: () => setCreateOpen(true), children: [_jsx(Plus, { size: 13 }), " ", t('agents.connections.add')] }))] })) : (_jsx("div", { className: "bg-card rounded-xl border border-border shadow-sm overflow-hidden", children: _jsx("div", { className: "divide-y divide-border", children: list?.map((c) => {
                        const tested = testResults[c.id];
                        return (_jsxs("div", { className: "flex items-start gap-3 px-4 sm:px-5 py-4 hover:bg-muted/50 transition-colors", children: [_jsx("div", { className: "h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0", children: _jsx(Plug, { className: "h-5 w-5 text-muted-foreground" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: "text-sm font-semibold truncate", children: c.name }), _jsx(Badge, { variant: "secondary", className: "text-[10px] uppercase tracking-wider px-1.5 py-0", children: c.kind }), c.is_default && (_jsxs(Badge, { className: "text-[10px] uppercase tracking-wider px-1.5 py-0 bg-amber-100 hover:bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 inline-flex items-center gap-1", children: [_jsx(Star, { className: "h-3 w-3" }), " ", t('agents.connections.default')] }))] }), _jsxs("div", { className: "text-xs text-muted-foreground mt-0.5 truncate", children: [c.base_url || t('agents.connections.providerDefaultEndpoint'), " \u00B7", ' ', c.default_model || t('agents.connections.noDefaultModel')] }), tested && (_jsxs("div", { className: `mt-2 inline-flex items-center gap-1.5 text-xs ${tested.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`, children: [tested.ok ? _jsx(CheckCircle2, { className: "h-3.5 w-3.5" }) : _jsx(XCircle, { className: "h-3.5 w-3.5" }), tested.detail] }))] }), canWrite && (_jsxs("div", { className: "flex items-center gap-1 shrink-0", children: [_jsx(Button, { size: "sm", variant: "outline", className: "h-8 text-xs", onClick: () => testMut.mutate(c.id), disabled: testMut.isPending, children: t('agents.connections.test') }), _jsx("button", { type: "button", onClick: () => setEditing(c), className: "p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors", title: t('common.edit'), children: _jsx(Edit2, { className: "h-4 w-4" }) }), _jsx("button", { type: "button", onClick: () => {
                                                if (confirm(t('agents.connections.deleteConfirm', { name: c.name }))) {
                                                    removeMut.mutate(c.id);
                                                }
                                            }, className: "p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors", title: t('common.delete'), children: _jsx(Trash2, { className: "h-4 w-4" }) })] }))] }, c.id));
                    }) }) })), _jsx(McpExternalPanel, {}), _jsx(ConnectionFormDialog, { open: createOpen, onOpenChange: setCreateOpen }), _jsx(ConnectionFormDialog, { open: !!editing, onOpenChange: (o) => !o && setEditing(null), connection: editing })] }));
}
