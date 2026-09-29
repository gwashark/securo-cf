import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, Plug, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button.js';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, } from '../ui/dialog.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.js';
import { Switch } from '../ui/switch.js';
import { agents } from '../../lib/api.js';
export function AgentFormDialog({ open, onOpenChange, agent }) {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const isEdit = !!agent;
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    // Empty string = nothing picked yet. Required to submit; we no
    // longer support an "instance default" sentinel because there is no
    // such thing — a connection is what tells the agent how to reach an
    // LLM.
    const [connectionId, setConnectionId] = useState('');
    const [model, setModel] = useState('');
    const [temperature, setTemperature] = useState('0.4');
    const [autoContext, setAutoContext] = useState(true);
    const [isDefault, setIsDefault] = useState(false);
    const { data: connections } = useQuery({
        queryKey: ['agent-connections'],
        queryFn: () => agents.connections.list(),
        enabled: open,
    });
    useEffect(() => {
        if (agent) {
            setName(agent.name);
            setDescription(agent.description ?? '');
            setSystemPrompt(agent.system_prompt ?? '');
            setConnectionId(agent.connection_id ?? '');
            setModel(agent.model ?? '');
            setTemperature(String(agent.temperature ?? 0.4));
            setAutoContext(agent.auto_context ?? true);
            setIsDefault(agent.is_default ?? false);
        }
        else {
            setName('');
            setDescription('');
            setSystemPrompt('');
            // Pre-select the user's default connection (or the only one,
            // if there's just one) so the form is one click closer to done.
            setConnectionId('');
            setModel('');
            setTemperature('0.4');
            setAutoContext(true);
            setIsDefault(false);
        }
    }, [agent, open]);
    // When connections load (or the dialog opens), pre-select the most
    // sensible default: the user-flagged default connection, or the only
    // one if there's a single connection.
    useEffect(() => {
        if (!open || isEdit || connectionId)
            return;
        if (!connections || connections.length === 0)
            return;
        const def = connections.find((c) => c.is_default);
        setConnectionId(def?.id ?? connections[0].id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, connections]);
    const selectedConnection = connections?.find((c) => c.id === connectionId);
    const saveMut = useMutation({
        mutationFn: (payload) => isEdit && agent ? agents.update(agent.id, payload) : agents.create(payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['agents'] });
            onOpenChange(false);
            toast.success(isEdit ? t('agents.form.updated') : t('agents.form.created'));
        },
        onError: (err) => {
            const message = err?.message ?? t('agents.form.saveFailed');
            toast.error(message);
        },
    });
    const submit = () => {
        if (!name.trim()) {
            toast.error(t('agents.form.nameRequired'));
            return;
        }
        if (!connectionId) {
            toast.error(t('agents.form.connectionRequired', 'Pick a connection — agents need one to talk to an LLM.'));
            return;
        }
        saveMut.mutate({
            name: name.trim(),
            description: description.trim() || null,
            system_prompt: systemPrompt,
            connection_id: connectionId,
            model: model.trim() || null,
            temperature: Number(temperature) || 0.4,
            auto_context: autoContext,
            is_default: isDefault,
        });
    };
    const noConnections = connections !== undefined && connections.length === 0;
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "max-w-xl", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: isEdit ? t('agents.form.editTitle') : t('agents.form.createTitle') }) }), _jsxs("div", { className: "grid gap-4 py-2", children: [_jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "agent-name", children: t('agents.form.name') }), _jsx(Input, { id: "agent-name", value: name, onChange: (e) => setName(e.target.value), placeholder: t('agents.form.namePlaceholder') })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "agent-desc", children: t('agents.form.description') }), _jsx(Input, { id: "agent-desc", value: description, onChange: (e) => setDescription(e.target.value), placeholder: t('agents.form.descriptionPlaceholder') })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "agent-prompt", children: t('agents.form.systemPrompt') }), _jsx("textarea", { id: "agent-prompt", value: systemPrompt, onChange: (e) => setSystemPrompt(e.target.value), rows: 6, className: "rounded-md border bg-card px-3 py-2 text-sm font-mono", placeholder: t('agents.form.systemPromptPlaceholder') })] }), noConnections ? (_jsxs("div", { className: "rounded-md border border-dashed p-4 flex items-start gap-3", children: [_jsx(Plug, { className: "h-4 w-4 text-muted-foreground mt-0.5 shrink-0" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-medium", children: t('agents.form.needConnectionTitle', 'Add an LLM connection first') }), _jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: t('agents.form.needConnectionHint', 'An agent needs a connection (OpenAI, Anthropic, Ollama, …) to talk to a model. Set one up, then come back here.') }), _jsxs(Link, { to: "/agents/connections", onClick: () => onOpenChange(false), className: "inline-flex items-center gap-1 mt-2 text-xs font-medium text-primary hover:underline", children: [t('agents.form.goToConnections', 'Go to connections'), _jsx(ArrowRight, { className: "h-3 w-3" })] })] })] })) : (_jsxs("div", { className: "grid grid-cols-[1fr_1fr] gap-3", children: [_jsxs("div", { className: "grid gap-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Label, { children: t('agents.form.connection') }), _jsxs(Link, { to: "/agents/connections", className: "text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1", onClick: () => onOpenChange(false), children: [_jsx(Settings2, { className: "h-3 w-3" }), t('agents.form.manageConnections')] })] }), _jsxs(Select, { value: connectionId, onValueChange: setConnectionId, children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, { placeholder: t('agents.form.connectionPlaceholder', 'Pick a connection') }) }), _jsx(SelectContent, { children: (connections ?? []).map((c) => (_jsxs(SelectItem, { value: c.id, children: [c.name, " ", _jsxs("span", { className: "text-muted-foreground ml-1", children: ["(", c.kind, ")"] })] }, c.id))) })] })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "agent-model", children: t('agents.form.model') }), _jsx(Input, { id: "agent-model", value: model, onChange: (e) => setModel(e.target.value), placeholder: selectedConnection?.default_model || t('agents.form.modelPlaceholder') }), !model && selectedConnection?.default_model && (_jsx("p", { className: "text-xs text-muted-foreground", children: t('agents.form.willUseConnectionDefault', { model: selectedConnection.default_model }) }))] })] })), _jsxs("div", { className: "grid gap-2 max-w-[160px]", children: [_jsx(Label, { htmlFor: "agent-temp", children: t('agents.form.temperature') }), _jsx(Input, { id: "agent-temp", type: "number", step: "0.05", min: "0", max: "2", value: temperature, onChange: (e) => setTemperature(e.target.value) })] }), _jsxs("div", { className: "rounded-md border p-3 flex items-start gap-3", children: [_jsx(Switch, { checked: autoContext, onCheckedChange: (v) => setAutoContext(!!v) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx(Label, { className: "cursor-pointer", onClick: () => setAutoContext(!autoContext), children: t('agents.form.autoContext') }), _jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: t('agents.form.autoContextHint') })] })] }), _jsxs("div", { className: "rounded-md border p-3 flex items-start gap-3", children: [_jsx(Switch, { checked: isDefault, onCheckedChange: (v) => setIsDefault(!!v) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx(Label, { className: "cursor-pointer", onClick: () => setIsDefault(!isDefault), children: t('agents.form.isDefault', 'Default agent') }), _jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: t('agents.form.isDefaultHint', 'Used by the global slide-over chat (⌘J). Only one agent can be the default — turning this on clears it on others.') })] })] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => onOpenChange(false), children: t('agents.form.cancel') }), _jsx(Button, { onClick: submit, disabled: saveMut.isPending || noConnections || !connectionId, children: saveMut.isPending ? t('agents.form.saving') : isEdit ? t('agents.form.save') : t('agents.form.create') })] })] }) }));
}
