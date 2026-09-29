import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Global slide-over chat — available from every page (⌘J / Ctrl+J).
 *
 * Header surfaces:
 *   - Agent selector (all non-archived agents; default agent pre-selected)
 *   - Conversation history toggle (resume any prior thread)
 *   - New-conversation +
 *   - Close ×
 *
 * Conversation persistence: the active conversationId is kept in
 * localStorage keyed by agent. Re-opening the panel resumes the same
 * thread instead of starting fresh — the explicit "+" button is the
 * only way to start a new one.
 *
 * Page context: each send forwards a `page_context` snapshot built
 * from the active page's registration (or a synthesized fallback).
 */
import { useMemo, useState } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft, History, Loader2, Plus, Settings, X } from 'lucide-react';
import { Button } from './ui/button.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from './ui/select.js';
import { agents } from '../lib/api.js';
import { ChatPanel } from './agents/chat-panel.js';
import { getEffectivePageChatContext } from '../lib/page-chat-context.js';
import { formatRelative } from '../lib/relative-time.js';
import { cn } from '../lib/utils.js';
const STORAGE_KEY = 'securo.global-chat';
function readState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    }
    catch {
        return {};
    }
}
function writeState(s) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    }
    catch {
        // localStorage can be disabled (private mode, quota); silent fallback.
    }
}
export function GlobalChatPanel({ open, onOpenChange }) {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const [view, setView] = useState('chat');
    // Bumped on every "new conversation" click + agent switch so the
    // textarea refocuses even when conversationId itself doesn't change.
    const [focusBump, setFocusBump] = useState(0);
    // Persisted preferences (agent + per-agent active conversation).
    const [persisted, setPersisted] = useState(() => readState());
    const { data: agentsList, isLoading: loadingAgents } = useQuery({
        queryKey: ['agents'],
        queryFn: () => agents.list(false),
        enabled: open,
        staleTime: 1000 * 30,
    });
    const { data: defaultAgent } = useQuery({
        queryKey: ['agents-default'],
        queryFn: () => agents.getDefault(),
        enabled: open && !persisted.agentId,
        retry: false,
        staleTime: 1000 * 60,
    });
    // Resolve which agent is active. Order: persisted choice → default →
    // first in the list. The picked id always points at an agent that
    // still exists; falls back gracefully when the persisted one was
    // archived/deleted.
    const activeAgent = useMemo(() => {
        if (!agentsList || agentsList.length === 0)
            return undefined;
        if (persisted.agentId) {
            const hit = agentsList.find((a) => a.id === persisted.agentId);
            if (hit)
                return hit;
        }
        if (defaultAgent && agentsList.find((a) => a.id === defaultAgent.id)) {
            return agentsList.find((a) => a.id === defaultAgent.id);
        }
        return agentsList[0];
    }, [agentsList, persisted.agentId, defaultAgent]);
    const conversationId = activeAgent ? persisted.conversationByAgent?.[activeAgent.id] ?? null : null;
    function setConversationForActive(cid) {
        if (!activeAgent)
            return;
        setPersisted((prev) => {
            const next = { ...prev, conversationByAgent: { ...(prev.conversationByAgent || {}) } };
            if (cid === null)
                delete next.conversationByAgent[activeAgent.id];
            else
                next.conversationByAgent[activeAgent.id] = cid;
            writeState(next);
            return next;
        });
    }
    function selectAgent(id) {
        setPersisted((prev) => {
            const next = { ...prev, agentId: id };
            writeState(next);
            return next;
        });
        setView('chat');
        setFocusBump((n) => n + 1);
    }
    function startNewConversation() {
        setConversationForActive(null);
        setView('chat');
        setFocusBump((n) => n + 1);
    }
    // When the panel opens, default the inner view to chat (history view
    // is opt-in). Conversation itself is NOT reset — the user explicitly
    // clicks + to start a new one.
    const [panelSource, setPanelSource] = useState(null);
    if (!panelSource || panelSource.open !== open) {
        setPanelSource({ open });
        if (open) {
            setView('chat');
            setFocusBump((n) => n + 1);
        }
    }
    return (_jsx(DialogPrimitive.Root, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogPrimitive.Portal, { children: [_jsx(DialogPrimitive.Overlay, { className: cn(
                    // Match the command palette (⌘K) overlay: light background-
                    // tinted veil + small blur. Distinct from the heavier
                    // bg-black/30 we had before, which felt like a modal cut.
                    'fixed inset-0 z-50 backdrop-blur-[3px] bg-background/40', 'data-[state=open]:animate-in data-[state=closed]:animate-out', 'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0') }), _jsxs(DialogPrimitive.Content, { "aria-describedby": undefined, className: cn('fixed right-0 top-0 z-50 h-full w-full sm:w-[440px] md:w-[480px] bg-background border-l shadow-xl', 'flex flex-col outline-none', 'data-[state=open]:animate-in data-[state=closed]:animate-out', 'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right', 'duration-200'), children: [_jsx(DialogPrimitive.Title, { className: "sr-only", children: t('agents.globalChat.title', 'Chat') }), _jsxs("header", { className: "flex items-center justify-between gap-2 px-3 py-2 border-b shrink-0", children: [_jsx("div", { className: "flex items-center gap-1 min-w-0 flex-1", children: view === 'history' ? (_jsxs(_Fragment, { children: [_jsx(Button, { size: "sm", variant: "ghost", className: "-ml-1 px-1.5", onClick: () => setView('chat'), "aria-label": t('agents.globalChat.backToChat'), children: _jsx(ArrowLeft, { className: "h-4 w-4" }) }), _jsx("span", { className: "text-sm font-medium truncate", children: t('agents.globalChat.history', 'Recent conversations') })] })) : agentsList && agentsList.length > 1 ? (_jsxs(Select, { value: activeAgent?.id ?? '', onValueChange: selectAgent, children: [_jsx(SelectTrigger, { "aria-label": t('agents.globalChat.selectAgent', 'Select agent'), className: cn('h-8 gap-1.5 border-0 bg-transparent shadow-none focus-visible:ring-0', 'px-2 -ml-1 hover:bg-muted text-sm font-medium', 'data-[size=default]:h-8'), children: _jsx(SelectValue, { placeholder: t('agents.globalChat.selectAgent', 'Select agent') }) }), _jsx(SelectContent, { align: "start", className: "max-h-[60vh]", children: agentsList.map((a) => (_jsx(SelectItem, { value: a.id, children: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx("span", { className: "inline-block h-2 w-2 rounded-full shrink-0", style: { backgroundColor: a.color }, "aria-hidden": true }), _jsx("span", { children: a.name }), a.is_default && (_jsx("span", { className: "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200", children: t('agents.defaultBadge', 'Default') }))] }) }, a.id))) })] })) : (_jsxs("div", { className: "inline-flex items-center gap-2 px-2 -ml-1", children: [_jsx("span", { className: "inline-block h-2 w-2 rounded-full shrink-0", style: { backgroundColor: activeAgent?.color ?? 'transparent' }, "aria-hidden": true }), _jsx("span", { className: "text-sm font-medium truncate", children: activeAgent?.name ?? t('agents.globalChat.title', 'Chat') }), activeAgent?.is_default && (_jsx("span", { className: "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 shrink-0", children: t('agents.defaultBadge', 'Default') }))] })) }), _jsxs("div", { className: "flex items-center gap-1", children: [view === 'chat' && activeAgent && (_jsxs(_Fragment, { children: [_jsx(Button, { size: "sm", variant: "ghost", onClick: () => {
                                                        setView('history');
                                                        qc.invalidateQueries({ queryKey: ['global-chat-conversations', activeAgent.id] });
                                                    }, "aria-label": t('agents.globalChat.history', 'Recent conversations'), title: t('agents.globalChat.history', 'Recent conversations'), children: _jsx(History, { className: "h-4 w-4" }) }), _jsx(Button, { size: "sm", variant: "ghost", onClick: startNewConversation, "aria-label": t('agents.newConversation', 'New conversation'), title: t('agents.newConversation', 'New conversation'), children: _jsx(Plus, { className: "h-4 w-4" }) })] })), _jsx(Button, { asChild: true, size: "sm", variant: "ghost", "aria-label": t('agents.globalChat.openSettings', 'Agent settings'), title: t('agents.globalChat.openSettings', 'Agent settings'), children: _jsx(Link, { to: "/agents", onClick: () => onOpenChange(false), children: _jsx(Settings, { className: "h-4 w-4" }) }) }), _jsx(DialogPrimitive.Close, { asChild: true, children: _jsx(Button, { size: "sm", variant: "ghost", "aria-label": t('common.close'), children: _jsx(X, { className: "h-4 w-4" }) }) })] })] }), _jsxs("div", { className: "flex-1 min-h-0 flex flex-col", children: [loadingAgents && (_jsxs("div", { className: "flex-1 flex items-center justify-center text-muted-foreground gap-2", children: [_jsx(Loader2, { className: "h-4 w-4 animate-spin" }), _jsx("span", { className: "text-sm", children: t('common.loading', 'Loading…') })] })), !loadingAgents && agentsList && agentsList.length === 0 && (_jsxs("div", { className: "flex-1 flex flex-col items-center justify-center text-center px-6 gap-2 text-sm text-muted-foreground", children: [_jsx("span", { children: t('agents.globalChat.empty', 'No agent available. Create one in the Agents page to enable the global chat.') }), _jsx("a", { href: "/agents", className: "underline text-foreground", children: t('agents.globalChat.openAgents', 'Go to Agents') })] })), activeAgent && view === 'chat' && (_jsx(ChatPanel
                                // Key on agent only. Including conversationId here would
                                // remount the panel mid-stream when the SSE assigns a
                                // brand-new conversation an id (null → real), wiping the
                                // streaming state and hiding the loading bubble for the
                                // first message of a fresh chat.
                                , { agent: activeAgent, conversationId: conversationId, onConversationCreated: (id) => setConversationForActive(id), focusSignal: focusBump, getPageContext: () => getEffectivePageChatContext() }, activeAgent.id)), activeAgent && view === 'history' && (_jsx(ConversationsList, { agentId: activeAgent.id, activeConversationId: conversationId, onPick: (id) => {
                                        setConversationForActive(id);
                                        setView('chat');
                                        setFocusBump((n) => n + 1);
                                    } }))] })] })] }) }));
}
function ConversationsList({ agentId, activeConversationId, onPick }) {
    const { t } = useTranslation();
    const { data, isLoading } = useQuery({
        queryKey: ['global-chat-conversations', agentId],
        queryFn: () => agents.conversations.list(agentId, 50),
        staleTime: 1000 * 10,
    });
    if (isLoading) {
        return (_jsxs("div", { className: "flex-1 flex items-center justify-center text-muted-foreground gap-2", children: [_jsx(Loader2, { className: "h-4 w-4 animate-spin" }), _jsx("span", { className: "text-sm", children: t('common.loading', 'Loading…') })] }));
    }
    if (!data || data.length === 0) {
        return (_jsx("div", { className: "flex-1 flex items-center justify-center text-sm text-muted-foreground px-6 text-center", children: t('agents.globalChat.noConversations', 'No conversations yet.') }));
    }
    return (_jsx("div", { className: "flex-1 overflow-y-auto divide-y", children: data.map((c) => (_jsx(ConversationRow, { conv: c, isActive: c.id === activeConversationId, onClick: () => onPick(c.id) }, c.id))) }));
}
function ConversationRow({ conv, isActive, onClick, }) {
    return (_jsx("button", { type: "button", onClick: onClick, className: cn('w-full text-left px-3 py-2.5 hover:bg-muted transition-colors flex flex-col gap-0.5', isActive && 'bg-muted'), children: _jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { className: "text-sm font-medium truncate", children: conv.title || 'Untitled' }), _jsx("span", { className: "text-[11px] text-muted-foreground shrink-0 tabular-nums", children: formatRelative(conv.updated_at) })] }) }));
}
