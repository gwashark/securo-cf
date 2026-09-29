import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Pin, PinOff, Trash2, Upload as UploadIcon, FileText, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button.js';
import { agents } from '../../lib/api.js';
import { useWorkspace } from '../../contexts/workspace-context.js';
function StatusBadge({ d }) {
    const { t } = useTranslation();
    if (d.status === 'ready')
        return (_jsxs("span", { className: "inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400", children: [_jsx(CheckCircle2, { className: "h-3.5 w-3.5" }), " ", t('agents.knowledge.ready'), " \u00B7 ", t('agents.knowledge.chunks', { count: d.chunk_count })] }));
    if (d.status === 'failed')
        return (_jsxs("span", { className: "inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400", title: d.error || '', children: [_jsx(AlertCircle, { className: "h-3.5 w-3.5" }), " ", t('agents.knowledge.failed')] }));
    return (_jsxs("span", { className: "inline-flex items-center gap-1 text-xs text-muted-foreground", children: [_jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin" }), " ", d.status] }));
}
export function KnowledgeSection({ agentId }) {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const { canWrite } = useWorkspace();
    const fileRef = useRef(null);
    const { data, isLoading } = useQuery({
        queryKey: ['agent-knowledge', agentId],
        queryFn: () => agents.knowledge.list(agentId),
        refetchInterval: (q) => {
            const items = q.state.data?.items || [];
            return items.some((d) => d.status !== 'ready' && d.status !== 'failed') ? 3000 : false;
        },
    });
    const upload = useMutation({
        mutationFn: (file) => agents.knowledge.upload(agentId, file, false),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['agent-knowledge', agentId] });
            toast.success(t('agents.knowledge.uploaded'));
        },
        onError: (err) => {
            const detail = err?.response?.data?.detail;
            toast.error(detail || t('agents.knowledge.uploadFailed'));
        },
    });
    const pin = useMutation({
        mutationFn: ({ id, pinned }) => agents.knowledge.pin(agentId, id, pinned),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-knowledge', agentId] }),
    });
    const remove = useMutation({
        mutationFn: (id) => agents.knowledge.remove(agentId, id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-knowledge', agentId] }),
    });
    const items = data?.items ?? [];
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold", children: t('agents.knowledge.title') }), _jsx("p", { className: "text-xs text-muted-foreground", children: t('agents.knowledge.subtitle') })] }), _jsx("input", { ref: fileRef, type: "file", accept: ".pdf,.md,.markdown,.txt,.rst", className: "hidden", onChange: (e) => {
                            const f = e.target.files?.[0];
                            if (f)
                                upload.mutate(f);
                            if (fileRef.current)
                                fileRef.current.value = '';
                        } }), canWrite && (_jsxs(Button, { size: "sm", onClick: () => fileRef.current?.click(), disabled: upload.isPending, children: [_jsx(UploadIcon, { className: "h-4 w-4 mr-1.5" }), upload.isPending ? t('agents.knowledge.uploading') : t('agents.knowledge.upload')] }))] }), isLoading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: t('agents.knowledge.loading') })) : items.length === 0 ? (_jsx("div", { className: "rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center", children: t('agents.knowledge.empty') })) : (_jsx("div", { className: "rounded-lg border divide-y", children: items.map((d) => (_jsxs("div", { className: "flex items-center gap-3 px-3 py-2.5", children: [_jsx(FileText, { className: "h-4 w-4 text-muted-foreground shrink-0" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "text-sm truncate", children: d.title }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(StatusBadge, { d: d }), _jsxs("span", { className: "text-xs text-muted-foreground", children: [(d.size_bytes / 1024).toFixed(0), " KB"] })] })] }), canWrite && (_jsxs(_Fragment, { children: [_jsx(Button, { size: "icon", variant: "ghost", title: d.pinned ? t('agents.knowledge.unpinTitle') : t('agents.knowledge.pinTitle'), onClick: () => pin.mutate({ id: d.id, pinned: !d.pinned }), children: d.pinned ? _jsx(Pin, { className: "h-4 w-4 text-amber-500" }) : _jsx(PinOff, { className: "h-4 w-4" }) }), _jsx(Button, { size: "icon", variant: "ghost", onClick: () => remove.mutate(d.id), title: t('common.delete'), children: _jsx(Trash2, { className: "h-4 w-4 text-rose-500" }) })] }))] }, d.id))) }))] }));
}
