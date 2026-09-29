import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { isProposalData, isProposalToolName } from '../../lib/agent-proposals.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ShellLogo } from '../shell-logo.js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Loader2, Send, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button.js';
import { agents } from '../../lib/api.js';
import { streamChat } from '../../lib/agents-stream.js';
import { Markdown } from './markdown.js';
import { ToolDebugChip } from './tool-debug-chip.js';
import { ProposalCard } from './proposal-card.js';
export function ChatPanel({ agent, conversationId, onConversationCreated, focusSignal, getPageContext }) {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [draft, setDraft] = useState(null); // assistant turn currently being streamed
    const [pendingUser, setPendingUser] = useState(null); // user msg shown immediately
    // Last error from a chat round, kept after streaming ends so the user
    // can actually see what went wrong. Cleared when they send a new message.
    const [lastError, setLastError] = useState(null);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);
    // Whether the user is "pinned" to the bottom of the scroll area. We
    // only auto-scroll while pinned — if the user scrolls up to read,
    // streaming deltas no longer yank them back down.
    const isAtBottomRef = useRef(true);
    const { data: history } = useQuery({
        queryKey: ['agent-conv-messages', conversationId],
        queryFn: () => (conversationId ? agents.conversations.messages(conversationId) : Promise.resolve([])),
        enabled: !!conversationId,
        staleTime: 1000 * 5,
    });
    // Snap to bottom when the conversation switches (it should look fresh)
    // and move keyboard focus to the input — covers both "+" (null) and
    // selecting an existing conversation. focusSignal also triggers focus
    // when the user clicks "+" while already on a null conversation.
    useEffect(() => {
        if (scrollRef.current) {
            isAtBottomRef.current = true;
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
        inputRef.current?.focus();
    }, [conversationId, focusSignal]);
    // Clear any stale optimistic draft when the conversation prop changes
    // for a reason OTHER than the in-flight stream getting its id assigned
    // (i.e. user picked a different thread from history, or hit "+"). We
    // detect "stream is mid-flight" via the `streaming` flag — during that
    // window the conversationId may legitimately go from null → real, and
    // we don't want to wipe the loading bubble. Once the stream finishes,
    // the existing finally{} clears the draft anyway.
    useEffect(() => {
        if (!streaming) {
            setDraft(null);
            setPendingUser(null);
            setLastError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversationId]);
    // Reset the textarea's inline height when the input is cleared (after
    // send, on conversation change, etc.) — onChange's auto-grow leaves
    // an explicit `style.height` behind that won't shrink on its own.
    useEffect(() => {
        if (input === '' && inputRef.current) {
            inputRef.current.style.height = '';
        }
    }, [input]);
    // While streaming or new content arrives, only follow if pinned.
    useEffect(() => {
        if (!scrollRef.current)
            return;
        if (isAtBottomRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history, draft, pendingUser]);
    const handleScroll = () => {
        const el = scrollRef.current;
        if (!el)
            return;
        // 80px tolerance — close enough to count as "at the bottom".
        const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
        isAtBottomRef.current = distance < 80;
    };
    const send = async () => {
        const trimmed = input.trim();
        if (!trimmed || streaming)
            return;
        setInput('');
        setLastError(null);
        setStreaming(true);
        // User just took an action — they want to see the response.
        isAtBottomRef.current = true;
        let errorThisTurn = null;
        // Track the active conversation id locally — the React state for it
        // updates asynchronously, so a closure over `conversationId` still
        // sees the value at the start of send() and would invalidate the
        // wrong query key on a brand-new conversation.
        let activeConvId = conversationId;
        // Remember whether this round started a fresh conversation, so we
        // can ask the backend to generate a real title from the LLM after
        // streaming completes successfully.
        const startedFresh = !conversationId;
        const localId = crypto.randomUUID();
        setPendingUser({ id: 'pending-user-' + localId, role: 'user', text: trimmed, tools: [] });
        setDraft({ id: 'draft-' + localId, role: 'assistant', text: '', tools: [], pending: true });
        try {
            await streamChat({
                agentId: agent.id,
                content: trimmed,
                conversationId,
                pageContext: getPageContext?.() ?? null,
                onEvent: (ev) => {
                    if (ev.kind === 'conversation') {
                        activeConvId = ev.conversation_id;
                        if (!conversationId)
                            onConversationCreated(ev.conversation_id);
                        return;
                    }
                    if (ev.kind === 'text_delta') {
                        setDraft((d) => (d ? { ...d, text: d.text + ev.text } : d));
                    }
                    else if (ev.kind === 'tool_call') {
                        setDraft((d) => (d ? { ...d, tools: [...d.tools, { name: ev.tool_name, args: ev.tool_args }] } : d));
                    }
                    else if (ev.kind === 'tool_result') {
                        setDraft((d) => {
                            if (!d)
                                return d;
                            const idx = d.tools.findIndex((t) => t.name === ev.tool_name && !t.result);
                            if (idx === -1)
                                return d;
                            const copy = [...d.tools];
                            copy[idx] = { ...copy[idx], result: ev.tool_result };
                            return { ...d, tools: copy };
                        });
                    }
                    else if (ev.kind === 'error') {
                        errorThisTurn = `${ev.error_code || 'error'}: ${ev.error_message || ''}`;
                        setDraft((d) => (d ? { ...d, error: errorThisTurn || undefined } : d));
                    }
                    else if (ev.kind === 'done') {
                        setDraft((d) => (d ? { ...d, pending: false } : d));
                    }
                },
            });
        }
        catch (err) {
            errorThisTurn = String(err);
            setDraft((d) => (d ? { ...d, error: String(err) } : d));
        }
        finally {
            setStreaming(false);
            // Pull the persisted turn for the conversation we actually wrote
            // to. refetchQueries waits for the data to come back; only THEN do
            // we clear the optimistic draft so the user never sees a blank gap.
            if (activeConvId) {
                try {
                    await qc.refetchQueries({ queryKey: ['agent-conv-messages', activeConvId] });
                }
                catch {
                    // ignore — we still want to clear the draft below
                }
            }
            qc.invalidateQueries({ queryKey: ['agent-conversations'] });
            setPendingUser(null);
            setDraft(null);
            if (errorThisTurn)
                setLastError(errorThisTurn);
            // After the very first round of a brand-new conversation, ask the
            // backend to summarize the exchange into a short title via the
            // LLM. Fire-and-forget — the conversations list will refetch when
            // it lands.
            if (!errorThisTurn && startedFresh && activeConvId) {
                agents.conversations
                    .generateTitle(activeConvId)
                    .then(() => qc.invalidateQueries({ queryKey: ['agent-conversations'] }))
                    .catch(() => { });
            }
        }
    };
    return (_jsxs("div", { className: "flex flex-col h-full min-h-0", children: [_jsxs("div", { ref: scrollRef, onScroll: handleScroll, className: "flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4", children: [(history ?? []).length === 0 && !pendingUser && !draft && (_jsx(ChatEmptyState, { agent: agent, onPick: (text) => {
                            setInput(text);
                            // Defer focus so the textarea picks up the new value
                            // before we drop the caret into it.
                            requestAnimationFrame(() => inputRef.current?.focus());
                        } })), _jsx(HistoryView, { agent: agent, history: history ?? [] }), pendingUser &&
                        !(history ?? []).some((m) => m.role === 'user' && (m.content ?? '').trim() === pendingUser.text.trim()) && (_jsx("div", { className: "flex justify-end", children: _jsx("div", { className: "max-w-[80%] rounded-lg px-3 py-2 bg-primary text-primary-foreground", children: _jsx("div", { className: "whitespace-pre-wrap text-sm", children: pendingUser.text }) }) })), draft && (_jsxs("div", { className: "space-y-2", children: [draft.tools.map((tool, i) => {
                                const isProposal = isProposalToolName(tool.name) && tool.result?.data && isProposalData(tool.result.data);
                                if (isProposal) {
                                    // Stable id for the localStorage "applied" marker — the
                                    // draft uses an in-flight uuid so we suffix with the index.
                                    return (_jsx(ProposalCard, { toolCallId: `draft-${draft.id}-${i}`, data: tool.result.data }, i));
                                }
                                return (_jsx(ToolDebugChip, { name: tool.name, args: tool.args, result: tool.result || null, pending: !tool.result }, i));
                            }), (draft.text || draft.pending) && (_jsxs("div", { className: "rounded-lg px-3 py-2 bg-muted", children: [_jsxs("div", { className: "text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5", children: [_jsx(Sparkles, { className: "h-3 w-3" }), " ", agent.name] }), draft.text ? (_jsx(Markdown, { children: draft.text + (draft.pending ? ' ▍' : '') })) : (_jsx(Loader2, { className: "inline h-3.5 w-3.5 animate-spin text-muted-foreground" }))] })), draft.error && (_jsxs("div", { className: "rounded-lg px-3 py-2 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-200 text-sm flex items-center gap-2", children: [_jsx(AlertCircle, { className: "h-4 w-4" }), draft.error] }))] })), !draft && lastError && (_jsxs("div", { className: "rounded-lg px-3 py-2 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-200 text-sm flex items-start gap-2", children: [_jsx(AlertCircle, { className: "h-4 w-4 mt-0.5 shrink-0" }), _jsx("div", { className: "min-w-0 flex-1 break-words", children: lastError }), _jsx("button", { type: "button", onClick: () => setLastError(null), className: "text-xs uppercase tracking-wider text-rose-600/70 hover:text-rose-700 dark:text-rose-400/70 dark:hover:text-rose-200", children: "\u2715" })] }))] }), _jsxs("div", { className: "shrink-0 border-t p-3 flex items-end gap-2 bg-background", children: [_jsx("textarea", { ref: inputRef, value: input, onChange: (e) => {
                            setInput(e.target.value);
                            // Auto-grow: reset then size to content. Capped via maxHeight.
                            const el = e.target;
                            el.style.height = 'auto';
                            el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
                        }, rows: 1, placeholder: t('agents.chat.placeholder', { name: agent.name }), 
                        // h-10 matches the default Button height so the input + send
                        // button line up when empty. Auto-grow above lifts it as the
                        // user types more lines.
                        className: "flex-1 h-10 max-h-[200px] rounded-md border bg-card px-3 py-2 text-sm resize-none leading-5 overflow-y-auto", onKeyDown: (e) => {
                            // Enter sends; Shift+Enter inserts a newline. IME composition
                            // (e.g. accented chars on Mac, CJK input) must not be hijacked.
                            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                                e.preventDefault();
                                send();
                            }
                        } }), _jsx(Button, { onClick: send, disabled: streaming || !input.trim(), className: "shrink-0", children: streaming ? _jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : _jsx(Send, { className: "h-4 w-4" }) })] })] }));
}
/**
 * Persisted history. Pairs each assistant tool_call with its matching
 * `tool` message (looked up by tool_call_id) so the call and its result
 * render together in a single expandable chip — same UX as the live
 * streaming draft.
 */
function HistoryView({ agent, history }) {
    const resultsById = useMemo(() => {
        const map = {};
        for (const m of history) {
            if (m.role === 'tool') {
                const id = m.tool_result?.tool_call_id;
                if (id)
                    map[id] = m;
            }
        }
        return map;
    }, [history]);
    return (_jsx(_Fragment, { children: history
            .filter((m) => m.role !== 'tool') // tool messages render under their assistant call
            .map((m) => {
            if (m.role === 'user') {
                return (_jsx("div", { className: "flex justify-end", children: _jsx("div", { className: "max-w-[80%] rounded-lg px-3 py-2 bg-primary text-primary-foreground", children: _jsx("div", { className: "whitespace-pre-wrap text-sm", children: m.content }) }) }, m.id));
            }
            if (m.role === 'assistant') {
                return (_jsxs("div", { className: "space-y-2", children: [m.tool_calls?.map((tc) => {
                            const tres = resultsById[tc.id];
                            const data = tres?.tool_result?.data;
                            if (isProposalToolName(tc.name) && data && isProposalData(data)) {
                                // Persisted tool_call_id is stable across reloads —
                                // perfect localStorage key for the "applied" marker.
                                return _jsx(ProposalCard, { toolCallId: tc.id, data: data }, tc.id);
                            }
                            return (_jsx(ToolDebugChip, { name: tc.name, args: tc.arguments, result: tres
                                    ? {
                                        ok: tres.tool_result?.ok ?? false,
                                        data: tres.tool_result?.data,
                                        text: tres.content,
                                    }
                                    : null, pending: !tres }, tc.id));
                        }), m.content && (_jsxs("div", { className: "rounded-lg px-3 py-2 bg-muted", children: [_jsxs("div", { className: "text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5", children: [_jsx(Sparkles, { className: "h-3 w-3" }), " ", agent.name] }), _jsx(Markdown, { children: m.content })] }))] }, m.id));
            }
            return null;
        }) }));
}
/** Shown in a fresh conversation (no history, no draft). Centers the
 *  Securo mark + agent name and surfaces ~6 randomized example prompts
 *  pulled from i18n. Picking one fills the textarea and focuses it
 *  (cheaper than auto-sending — gives the user a chance to tweak). */
function ChatEmptyState({ agent, onPick }) {
    const { t } = useTranslation();
    // Resolve the LLM connector tied to this agent so the empty state
    // can show "Connected via X" — useful trust signal: the user knows
    // which provider/key/model is going to handle the next message.
    // Falls back gracefully when the agent has no connection_id (uses
    // raw provider/model fields or instance default).
    const { data: connections } = useQuery({
        queryKey: ['agent-connections'],
        queryFn: () => agents.connections.list(),
        staleTime: 1000 * 60,
    });
    const connectorLabel = useMemo(() => {
        if (agent.connection_id) {
            const conn = connections?.find((c) => c.id === agent.connection_id);
            if (conn) {
                const model = agent.model || conn.default_model;
                return model ? `${conn.name} · ${model}` : conn.name;
            }
        }
        if (agent.provider) {
            return agent.model ? `${agent.provider} · ${agent.model}` : agent.provider;
        }
        return null;
    }, [agent.connection_id, agent.provider, agent.model, connections]);
    // Pull the localized prompt pool. Each locale ships ~10 short tips.
    const allPrompts = useMemo(() => {
        const raw = t('agents.emptyState.suggestions', { returnObjects: true });
        return Array.isArray(raw) ? raw : [];
    }, [t]);
    // Each agent gets its own slice of the pool, taken by rotating the list
    // from an offset derived from its id. Deriving instead of shuffling keeps
    // the render pure, so the chips stay put instead of swapping themselves
    // out on an unrelated re-render.
    const picks = useMemo(() => {
        if (allPrompts.length === 0)
            return [];
        let hash = 0;
        for (let i = 0; i < agent.id.length; i++) {
            hash = (hash * 31 + agent.id.charCodeAt(i)) | 0;
        }
        const start = Math.abs(hash) % allPrompts.length;
        return Array.from({ length: Math.min(3, allPrompts.length) }, (_, i) => allPrompts[(start + i) % allPrompts.length]);
    }, [allPrompts, agent.id]);
    return (_jsxs("div", { className: "flex flex-col items-center justify-center text-center gap-5 py-12 min-h-[65vh]", children: [_jsx(ShellLogo, { size: 56, className: "text-primary opacity-90" }), _jsxs("div", { className: "space-y-1 px-6", children: [_jsx("div", { className: "text-base font-semibold", children: agent.name }), agent.description && (_jsx("p", { className: "text-xs text-muted-foreground line-clamp-2", children: agent.description })), connectorLabel && (_jsxs("div", { className: "text-[11px] text-muted-foreground/80 mt-1.5", children: [t('agents.emptyState.connectedVia', 'via'), " ", _jsx("span", { className: "font-mono", children: connectorLabel })] }))] }), picks.length > 0 && (_jsxs("div", { className: "w-full px-3 mt-1", children: [_jsx("div", { className: "text-[11px] uppercase tracking-wider text-muted-foreground/80 mb-2 text-center", children: t('agents.emptyState.tryAsking', 'Try asking') }), _jsx("div", { className: "flex flex-col gap-1.5", children: picks.map((p) => (_jsx("button", { type: "button", onClick: () => onPick(p), className: "text-left text-sm px-3 py-2 rounded-md border border-border bg-background/40 hover:bg-muted transition-colors", children: p }, p))) })] }))] }));
}
