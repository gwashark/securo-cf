import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Edit2, Trash2, Plus, MessageSquare } from 'lucide-react';
import { ConversationRow } from '../components/agents/conversation-row.js';
import { toast } from 'sonner';
import { Button } from '../components/ui/button.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.js';
import { agents } from '../lib/api.js';
import { AgentFormDialog } from '../components/agents/agent-form-dialog.js';
import { ChatPanel } from '../components/agents/chat-panel.js';
import { KnowledgeSection } from '../components/agents/knowledge-section.js';
import { ToolsSection } from '../components/agents/tools-section.js';
import { useWorkspace } from '../contexts/workspace-context.js';
export default function AgentDetailPage() {
    const { t } = useTranslation();
    const { id = '' } = useParams();
    const navigate = useNavigate();
    const qc = useQueryClient();
    const { canWrite } = useWorkspace();
    const [editOpen, setEditOpen] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    // Increments on every sidebar click so the chat input refocuses even
    // when the conversation id didn't actually change (e.g. clicking "+"
    // while already on a null conversation).
    const [focusSignal, setFocusSignal] = useState(0);
    const pickConversation = (id) => {
        setConversationId(id);
        setFocusSignal((n) => n + 1);
    };
    const { data: info } = useQuery({ queryKey: ['agents-info'], queryFn: () => agents.info() });
    const { data: agent, isLoading } = useQuery({
        queryKey: ['agent', id],
        queryFn: () => agents.get(id),
        enabled: !!id,
    });
    const { data: conversations } = useQuery({
        queryKey: ['agent-conversations', id],
        queryFn: () => agents.conversations.list(id),
        enabled: !!id,
    });
    const { data: connections } = useQuery({
        queryKey: ['agent-connections'],
        queryFn: () => agents.connections.list(),
    });
    const linkedConnection = agent?.connection_id
        ? connections?.find((c) => c.id === agent.connection_id)
        : undefined;
    const providerLabel = linkedConnection?.name ||
        (linkedConnection ? linkedConnection.kind : null) ||
        agent?.provider ||
        t('agents.instanceDefault');
    const modelLabel = agent?.model || linkedConnection?.default_model || '—';
    const removeMut = useMutation({
        mutationFn: () => agents.remove(id),
        onSuccess: () => {
            toast.success(t('agents.detail.deleted'));
            qc.invalidateQueries({ queryKey: ['agents'] });
            navigate('/agents');
        },
    });
    if (isLoading)
        return _jsx("div", { className: "p-6 text-sm text-muted-foreground", children: t('agents.loading') });
    if (!agent)
        return _jsx("div", { className: "p-6 text-sm text-muted-foreground", children: t('agents.detail.notFound') });
    return (_jsxs("div", { className: "flex flex-col h-[calc(100dvh-6.5rem)] lg:h-[calc(100dvh-3rem)] overflow-hidden", children: [_jsxs("div", { className: "border-b px-4 py-3 flex items-center gap-3", children: [_jsx(Button, { size: "icon", variant: "ghost", onClick: () => navigate('/agents'), title: t('common.back'), "aria-label": t('common.back'), children: _jsx(ArrowLeft, { className: "h-4 w-4" }) }), _jsx("div", { className: "h-9 w-9 rounded-md flex items-center justify-center text-white shrink-0", style: { backgroundColor: agent.color }, children: _jsx("span", { className: "font-semibold", children: agent.name[0] }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "font-semibold truncate", children: agent.name }), _jsxs("div", { className: "text-xs text-muted-foreground truncate", children: [providerLabel, " \u00B7 ", modelLabel, " \u00B7 temp ", agent.temperature] })] }), canWrite && (_jsxs(_Fragment, { children: [_jsxs(Button, { size: "sm", variant: "outline", onClick: () => setEditOpen(true), children: [_jsx(Edit2, { className: "h-3.5 w-3.5 mr-1.5" }), " ", t('agents.detail.edit')] }), _jsxs(Button, { size: "sm", variant: "outline", onClick: () => {
                                    if (confirm(t('agents.detail.deleteConfirm'))) {
                                        removeMut.mutate();
                                    }
                                }, children: [_jsx(Trash2, { className: "h-3.5 w-3.5 mr-1.5" }), " ", t('agents.detail.delete')] })] }))] }), _jsxs(Tabs, { defaultValue: "chat", className: "flex-1 flex flex-col min-h-0", children: [_jsx("div", { className: "px-4 pt-3", children: _jsxs(TabsList, { children: [_jsx(TabsTrigger, { value: "chat", children: t('agents.detail.tabs.chat') }), _jsx(TabsTrigger, { value: "knowledge", children: t('agents.detail.tabs.knowledge') }), _jsx(TabsTrigger, { value: "tools", children: t('agents.detail.tabs.tools') })] }) }), _jsxs(TabsContent, { value: "chat", className: "flex-1 flex min-h-0 mt-3", children: [_jsxs("aside", { className: "hidden md:flex md:w-64 border-r flex-col min-h-0", children: [_jsxs("div", { className: "px-3 pt-2 pb-1 flex items-center justify-between shrink-0", children: [_jsx("span", { className: "text-xs uppercase tracking-wider text-muted-foreground", children: t('agents.detail.conversations') }), _jsx(Button, { size: "icon", variant: "ghost", onClick: () => pickConversation(null), title: t('agents.detail.newConversation'), children: _jsx(Plus, { className: "h-4 w-4" }) })] }), _jsxs("div", { className: "flex-1 min-h-0 overflow-y-auto", children: [conversationId === null && (_jsxs("button", { onClick: () => pickConversation(null), className: "w-full text-left px-3 py-2 text-sm bg-muted flex items-center gap-2 truncate text-muted-foreground italic", children: [_jsx(MessageSquare, { className: "h-3.5 w-3.5 shrink-0" }), _jsx("span", { className: "truncate", children: t('agents.detail.newConversation') })] })), (conversations ?? []).map((c) => (_jsx(ConversationRow, { conv: c, agentId: id, active: conversationId === c.id, onPick: () => pickConversation(c.id), onDeleted: () => {
                                                    if (conversationId === c.id)
                                                        pickConversation(null);
                                                } }, c.id)))] })] }), _jsx("div", { className: "flex-1 min-w-0", children: _jsx(ChatPanel, { agent: agent, conversationId: conversationId, focusSignal: focusSignal, onConversationCreated: (cid) => {
                                        setConversationId(cid);
                                        qc.invalidateQueries({ queryKey: ['agent-conversations', id] });
                                    } }) })] }), _jsx(TabsContent, { value: "knowledge", className: "flex-1 overflow-y-auto px-4 py-3", children: _jsx(KnowledgeSection, { agentId: id }) }), _jsx(TabsContent, { value: "tools", className: "flex-1 overflow-y-auto px-4 py-3", children: _jsx(ToolsSection, { agentId: id }) })] }), _jsx(AgentFormDialog, { open: editOpen, onOpenChange: setEditOpen, agent: agent, providers: info?.providers ?? [] })] }));
}
