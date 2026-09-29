import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bot, ChevronRight, FileText, MessageSquare, Plug, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button.js';
import { Switch } from '../components/ui/switch.js';
import { PageHeader } from '../components/page-header.js';
import { agents } from '../lib/api.js';
import { AgentFormDialog } from '../components/agents/agent-form-dialog.js';
import { useWorkspace } from '../contexts/workspace-context.js';
export default function AgentsListPage() {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const { canWrite } = useWorkspace();
    const [createOpen, setCreateOpen] = useState(false);
    const { data: info } = useQuery({ queryKey: ['agents-info'], queryFn: () => agents.info() });
    const { data: list, isLoading } = useQuery({ queryKey: ['agents'], queryFn: () => agents.list() });
    const { data: connections } = useQuery({
        queryKey: ['agent-connections'],
        queryFn: () => agents.connections.list(),
    });
    // Setting an agent as default clears the flag on every other agent
    // server-side; we still need to refresh both queries so the badge
    // and the global-chat picker pick up the change immediately.
    const setDefaultMut = useMutation({
        mutationFn: ({ id, value }) => agents.update(id, { is_default: value }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['agents'] });
            qc.invalidateQueries({ queryKey: ['agents-default'] });
        },
        onError: () => toast.error(t('agents.form.saveFailed')),
    });
    return (_jsxs("div", { children: [_jsx(PageHeader, { section: t('agents.title'), title: t('agents.title'), action: canWrite ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Link, { to: "/agents/connections", children: _jsxs(Button, { variant: "outline", size: "sm", className: "gap-1.5 h-8", children: [_jsx(Plug, { size: 13 }), " ", t('agents.connections.manage')] }) }), _jsxs(Button, { size: "sm", className: "gap-1.5 h-8", onClick: () => setCreateOpen(true), children: [_jsx(Plus, { size: 13 }), " ", t('agents.newAgent')] })] })) : undefined }), _jsx("p", { className: "text-sm text-muted-foreground mb-6 max-w-2xl", children: t('agents.subtitle') }), isLoading ? (_jsx("div", { className: "bg-card rounded-xl border border-border shadow-sm p-6 text-sm text-muted-foreground", children: t('agents.loading') })) : (list?.length ?? 0) === 0 ? (_jsxs("div", { className: "bg-card rounded-xl border border-border shadow-sm p-10 text-center", children: [_jsx("div", { className: "h-12 w-12 mx-auto rounded-full bg-muted flex items-center justify-center mb-3", children: _jsx(Bot, { className: "h-6 w-6 text-muted-foreground" }) }), _jsx("h2", { className: "text-base font-semibold", children: t('agents.empty.title') }), _jsx("p", { className: "text-sm text-muted-foreground mt-1 max-w-md mx-auto", children: t('agents.empty.subtitle') }), canWrite && (_jsxs(Button, { size: "sm", className: "gap-1.5 h-8 mt-4", onClick: () => setCreateOpen(true), children: [_jsx(Plus, { size: 13 }), " ", t('agents.empty.create')] }))] })) : (_jsx("div", { className: "bg-card rounded-xl border border-border shadow-sm overflow-hidden", children: _jsx("div", { className: "divide-y divide-border", children: list?.map((a) => (_jsxs("div", { className: "group flex items-center gap-3 px-4 sm:px-5 py-4 hover:bg-muted transition-colors", children: [_jsxs(Link, { to: `/agents/${a.id}`, className: "flex items-center gap-3 flex-1 min-w-0", children: [_jsx("div", { className: "h-10 w-10 rounded-md flex items-center justify-center text-white shrink-0", style: { backgroundColor: a.color }, children: _jsx(Bot, { className: "h-5 w-5" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "text-sm font-semibold truncate group-hover:text-primary transition-colors", children: a.name }), a.is_default && (_jsx("span", { className: "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 shrink-0", children: t('agents.defaultBadge', 'Default') }))] }), _jsx("div", { className: "text-xs text-muted-foreground truncate mt-0.5", children: (() => {
                                                    // Three layers of LLM config (most → least specific):
                                                    //   1. connection_id → user-managed LlmConnection row
                                                    //   2. provider + model → raw values, instance creds
                                                    //   3. nothing → instance default
                                                    // Show the most specific one we can resolve so the
                                                    // row tells the truth instead of always saying
                                                    // "Instance default · —" when the agent uses a
                                                    // connection.
                                                    const conn = a.connection_id
                                                        ? connections?.find((c) => c.id === a.connection_id)
                                                        : undefined;
                                                    if (conn) {
                                                        const model = a.model || conn.default_model;
                                                        return `${conn.name} · ${model || '—'}`;
                                                    }
                                                    if (a.provider) {
                                                        return `${a.provider} · ${a.model || '—'}`;
                                                    }
                                                    return t('agents.instanceDefault');
                                                })() }), a.description && (_jsx("p", { className: "text-sm text-muted-foreground mt-1 line-clamp-1", children: a.description })), _jsxs("div", { className: "flex items-center gap-3 mt-1.5 text-xs text-muted-foreground", children: [_jsxs("span", { className: "inline-flex items-center gap-1", title: t('agents.conversationsCount', 'Conversations'), children: [_jsx(MessageSquare, { className: "h-3 w-3" }), a.conversation_count ?? 0] }), _jsxs("span", { className: "inline-flex items-center gap-1", title: t('agents.knowledgeCount', 'Knowledge files'), children: [_jsx(FileText, { className: "h-3 w-3" }), a.knowledge_count ?? 0] })] })] })] }), canWrite && (_jsxs("div", { className: "flex items-center gap-2 shrink-0", onClick: (e) => e.stopPropagation(), title: t('agents.form.isDefaultHint', 'Used by the global slide-over chat (⌘J). Only one agent can be the default — turning this on clears it on others.'), children: [_jsx("span", { className: "text-xs text-muted-foreground hidden sm:inline", children: t('agents.defaultLabel', 'Default') }), _jsx(Switch, { checked: a.is_default, onCheckedChange: (value) => setDefaultMut.mutate({ id: a.id, value: !!value }), disabled: setDefaultMut.isPending, "aria-label": t('agents.defaultLabel', 'Default') })] })), _jsx(Link, { to: `/agents/${a.id}`, className: "shrink-0 text-muted-foreground/60 hover:text-muted-foreground", "aria-label": t('common.view'), title: t('common.view'), children: _jsx(ChevronRight, { className: "h-4 w-4" }) })] }, a.id))) }) })), _jsx(AgentFormDialog, { open: createOpen, onOpenChange: setCreateOpen, providers: info?.providers ?? [] })] }));
}
