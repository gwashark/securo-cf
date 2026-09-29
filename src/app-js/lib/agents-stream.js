/**
 * Tiny SSE consumer for /api/agents/{id}/chat.
 *
 * We can't use the native EventSource because it doesn't allow setting an
 * Authorization header. Instead we POST with fetch, then parse the SSE
 * response stream by hand.
 */
import { WORKSPACE_STORAGE_KEY } from './api.js';
export async function streamChat(opts) {
    const token = localStorage.getItem('token') || '';
    // SSE uses raw fetch, so we have to set the workspace header here
    // — the axios interceptor that adds it for the rest of the app
    // doesn't run on this code path.
    const workspaceId = localStorage.getItem(WORKSPACE_STORAGE_KEY) || '';
    const headers = {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
    };
    if (workspaceId)
        headers['X-Workspace-Id'] = workspaceId;
    const res = await fetch(`/api/agents/${opts.agentId}/chat`, {
        method: 'POST',
        signal: opts.signal,
        headers,
        body: JSON.stringify({
            content: opts.content,
            conversation_id: opts.conversationId ?? null,
            channel: opts.channel ?? 'web',
            page_context: opts.pageContext ?? null,
        }),
    });
    if (!res.ok || !res.body) {
        let detail = '';
        try {
            detail = await res.text();
        }
        catch {
            detail = '';
        }
        opts.onEvent({ kind: 'error', error_code: String(res.status), error_message: detail || res.statusText });
        return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    // SSE framing: events are separated by a blank line. Within an event,
    // `event: <type>` and `data: <json>` lines. We accumulate lines into a
    // buffer until we hit a blank line, then dispatch.
    let currentEvent = 'message';
    let currentData = '';
    function flushEvent() {
        if (!currentData) {
            currentEvent = 'message';
            return;
        }
        try {
            const parsed = JSON.parse(currentData);
            const ev = { kind: currentEvent, ...parsed };
            opts.onEvent(ev);
        }
        catch {
            // Malformed payload — surface as error so the UI can recover.
            opts.onEvent({ kind: 'error', error_code: 'parse', error_message: currentData });
        }
        currentEvent = 'message';
        currentData = '';
    }
    for (;;) {
        const { value, done } = await reader.read();
        if (done)
            break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, idx).replace(/\r$/, '');
            buffer = buffer.slice(idx + 1);
            if (line === '') {
                flushEvent();
            }
            else if (line.startsWith('event:')) {
                currentEvent = line.slice(6).trim();
            }
            else if (line.startsWith('data:')) {
                currentData += (currentData ? '\n' : '') + line.slice(5).trim();
            }
        }
    }
    flushEvent();
}
