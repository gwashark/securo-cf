import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '../ui/button.js';
import { Switch } from '../ui/switch.js';
import { agents } from '../../lib/api.js';
import { useWorkspace } from '../../contexts/workspace-context.js';
export function ToolsSection({ agentId }) {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const { canWrite } = useWorkspace();
    const { data, isLoading } = useQuery({
        queryKey: ['agent-tools', agentId],
        queryFn: () => agents.tools(agentId),
    });
    const [draft, setDraft] = useState([]);
    useEffect(() => {
        setDraft(data?.tools ?? []);
    }, [data?.tools]);
    const save = useMutation({
        mutationFn: () => agents.setTools(agentId, draft.map((t) => ({ server: t.server, tool_name: t.name, enabled: t.enabled }))),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['agent-tools', agentId] });
            toast.success(t('agents.tools.saved'));
        },
        onError: () => toast.error(t('agents.tools.saveFailed')),
    });
    if (isLoading)
        return _jsx("div", { className: "text-sm text-muted-foreground", children: t('agents.tools.loading') });
    const grouped = draft.reduce((acc, tool) => {
        ;
        (acc[tool.server] ||= []).push(tool);
        return acc;
    }, {});
    const dirty = draft.some((tool, i) => (data?.tools[i]?.enabled ?? true) !== tool.enabled);
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold", children: t('agents.tools.title') }), _jsx("p", { className: "text-xs text-muted-foreground", children: t('agents.tools.subtitle') })] }), canWrite && (_jsx(Button, { size: "sm", disabled: !dirty || save.isPending, onClick: () => save.mutate(), children: save.isPending ? t('agents.tools.saving') : t('agents.tools.save') }))] }), Object.keys(grouped).length === 0 ? (_jsx("div", { className: "rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center", children: t('agents.tools.empty') })) : (_jsx("div", { className: "space-y-5", children: Object.entries(grouped).map(([server, items]) => (_jsxs("div", { children: [_jsx("div", { className: "text-xs uppercase tracking-wider text-muted-foreground mb-2", children: server }), _jsx("div", { className: "rounded-lg border divide-y", children: items.map((tool) => (_jsxs("div", { className: "flex items-center gap-3 px-3 py-2.5", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "text-sm font-medium flex items-center gap-2", children: [tool.name, tool.is_proposal && (_jsx("span", { className: "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200", children: t('agents.tools.proposeBadge') }))] }), _jsx("div", { className: "text-xs text-muted-foreground line-clamp-2", children: tool.description })] }), _jsx(Switch, { checked: tool.enabled, disabled: !canWrite, onCheckedChange: (v) => {
                                            setDraft((d) => d.map((x) => (x.server === tool.server && x.name === tool.name ? { ...x, enabled: !!v } : x)));
                                        } })] }, `${tool.server}.${tool.name}`))) })] }, server))) }))] }));
}
