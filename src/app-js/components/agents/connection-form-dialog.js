import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '../ui/button.js';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, } from '../ui/dialog.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.js';
import { Switch } from '../ui/switch.js';
import { agents } from '../../lib/api.js';
const KIND_LABELS = {
    ollama: { label: 'Ollama', needsBaseUrl: false, needsKey: false, modelHint: 'llama3.1:8b', urlHint: 'http://host.docker.internal:11434' },
    // OpenAI + Anthropic ship a sensible default model so non-tech users
    // don't need to know which id to type. Self-hosted kinds (Ollama,
    // OpenAI-compatible) intentionally have NO default — the right model
    // depends on what the user actually has installed/loaded.
    openai: { label: 'OpenAI', needsBaseUrl: false, needsKey: true, modelHint: 'gpt-4o-mini', urlHint: '', defaultModel: 'gpt-4o-mini' },
    anthropic: { label: 'Anthropic', needsBaseUrl: false, needsKey: true, modelHint: 'claude-haiku-4-5', urlHint: '', defaultModel: 'claude-haiku-4-5' },
    openai_compatible: { label: 'OpenAI-compatible (LM Studio, vLLM, Groq, Together, …)', needsBaseUrl: true, needsKey: false, modelHint: 'llama3.1-70b', urlHint: 'http://192.168.1.142:1234' },
};
export function ConnectionFormDialog({ open, onOpenChange, connection }) {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const isEdit = !!connection;
    const [name, setName] = useState('');
    const [kind, setKind] = useState('ollama');
    const [baseUrl, setBaseUrl] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [keyTouched, setKeyTouched] = useState(false);
    const [defaultModel, setDefaultModel] = useState('');
    // Track whether the user typed in the model field. If they didn't,
    // switching kinds re-seeds the field with the new kind's default
    // model (where one exists). Once they type, we never overwrite.
    const [modelTouched, setModelTouched] = useState(false);
    const [isDefault, setIsDefault] = useState(false);
    /** Switch the connector kind and, when the user is in the create
     *  flow and hasn't customized the model field, auto-fill the new
     *  kind's preset (only OpenAI + Anthropic ship one). */
    const handleKindChange = (newKind) => {
        setKind(newKind);
        if (isEdit)
            return;
        if (modelTouched)
            return;
        setDefaultModel(KIND_LABELS[newKind].defaultModel ?? '');
    };
    const [formSource, setFormSource] = useState(null);
    if (!formSource || formSource.connection !== connection || formSource.open !== open) {
        setFormSource({ connection, open });
        if (connection) {
            setName(connection.name);
            setKind(connection.kind);
            setBaseUrl(connection.base_url ?? '');
            setApiKey('');
            setKeyTouched(false);
            setDefaultModel(connection.default_model ?? '');
            // Editing a saved connection — treat the field as already
            // user-touched so kind swaps don't clobber what's stored.
            setModelTouched(true);
            setIsDefault(connection.is_default);
        }
        else {
            setName('');
            setKind('ollama');
            setBaseUrl('');
            setApiKey('');
            setKeyTouched(false);
            // Seed the model field with the initial kind's default (none
            // for ollama). Switching kinds inside the form will re-seed via
            // handleKindChange.
            setDefaultModel(KIND_LABELS['ollama'].defaultModel ?? '');
            setModelTouched(false);
            setIsDefault(false);
        }
    }
    const meta = KIND_LABELS[kind];
    const saveMut = useMutation({
        mutationFn: async () => {
            const payload = {
                name: name.trim(),
                kind,
                base_url: meta.needsBaseUrl ? baseUrl.trim() || null : baseUrl.trim() || null,
                default_model: defaultModel.trim() || null,
                is_default: isDefault,
            };
            // Only include api_key in the payload if user actually typed one. This
            // preserves the existing key on edits where the user didn't touch the field.
            if (!isEdit || keyTouched) {
                payload.api_key = apiKey || null;
            }
            if (isEdit && connection)
                return agents.connections.update(connection.id, payload);
            return agents.connections.create(payload);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['agent-connections'] });
            onOpenChange(false);
            toast.success(isEdit ? t('agents.connections.updated') : t('agents.connections.created'));
        },
        onError: (err) => {
            const detail = err?.response?.data?.detail;
            toast.error(detail || t('agents.connections.saveFailed'));
        },
    });
    const submit = () => {
        if (!name.trim()) {
            toast.error(t('agents.connections.nameRequired'));
            return;
        }
        if (meta.needsBaseUrl && !baseUrl.trim()) {
            toast.error(t('agents.connections.baseUrlRequired'));
            return;
        }
        saveMut.mutate();
    };
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "max-w-xl", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: isEdit ? t('agents.connections.editTitle') : t('agents.connections.createTitle') }) }), _jsxs("div", { className: "grid gap-4 py-2", children: [_jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { children: t('agents.connections.name') }), _jsx(Input, { value: name, onChange: (e) => setName(e.target.value), placeholder: t('agents.connections.namePlaceholder') })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { children: t('agents.connections.kind') }), _jsxs(Select, { value: kind, onValueChange: (v) => handleKindChange(v), disabled: isEdit, children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: Object.keys(KIND_LABELS).map((k) => (_jsx(SelectItem, { value: k, children: KIND_LABELS[k].label }, k))) })] })] }), _jsxs("div", { className: "grid gap-2", children: [_jsxs(Label, { children: [t('agents.connections.baseUrl'), !meta.needsBaseUrl && _jsxs("span", { className: "text-xs text-muted-foreground ml-1", children: ["(", t('agents.connections.optional'), ")"] })] }), _jsx(Input, { value: baseUrl, onChange: (e) => setBaseUrl(e.target.value), placeholder: meta.urlHint || t('agents.connections.baseUrlPlaceholder') }), kind === 'ollama' && (_jsx("p", { className: "text-xs text-muted-foreground", children: t('agents.connections.ollamaHint') })), kind === 'openai_compatible' && (_jsx("p", { className: "text-xs text-muted-foreground", children: t('agents.connections.openaiCompatHint') }))] }), _jsxs("div", { className: "grid gap-2", children: [_jsxs(Label, { children: [t('agents.connections.apiKey'), !meta.needsKey && _jsxs("span", { className: "text-xs text-muted-foreground ml-1", children: ["(", t('agents.connections.optional'), ")"] })] }), _jsx(Input, { type: "password", value: apiKey, onChange: (e) => {
                                        setApiKey(e.target.value);
                                        setKeyTouched(true);
                                    }, placeholder: isEdit && connection?.has_api_key ? t('agents.connections.apiKeyPlaceholderEdit') : t('agents.connections.apiKeyPlaceholder') }), _jsx("p", { className: "text-xs text-muted-foreground", children: t('agents.connections.apiKeyHint') })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { children: t('agents.connections.defaultModel') }), _jsx(Input, { value: defaultModel, onChange: (e) => {
                                        setDefaultModel(e.target.value);
                                        setModelTouched(true);
                                    }, placeholder: meta.modelHint })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Switch, { checked: isDefault, onCheckedChange: (v) => setIsDefault(!!v) }), _jsx(Label, { className: "cursor-pointer", onClick: () => setIsDefault(!isDefault), children: t('agents.connections.setAsDefault') })] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => onOpenChange(false), children: t('agents.connections.cancel') }), _jsx(Button, { onClick: submit, disabled: saveMut.isPending, children: saveMut.isPending ? t('agents.connections.saving') : isEdit ? t('agents.connections.save') : t('agents.connections.create') })] })] }) }));
}
