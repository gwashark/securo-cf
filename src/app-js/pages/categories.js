import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categories as categoriesApi, categoryGroups as groupsApi } from '../lib/api.js';
import { extractApiError } from '../lib/api-errors.js';
import { toast } from 'sonner';
import { Button } from '../components/ui/button.js';
import { DeleteConfirmationDialog } from '../components/delete-confirmation-dialog.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from '../components/ui/dialog.js';
import { Pencil, Trash2, Plus, ChevronDown, ChevronRight, ChevronsUpDown, Eye, EyeOff } from 'lucide-react';
import { PageHeader } from '../components/page-header.js';
import { invalidateCategoryQueries } from '../lib/invalidate-queries.js';
import { CategoryIcon } from '../components/category-icon.js';
import { IconPicker } from '../components/icon-picker.js';
import { useWorkspace } from '../contexts/workspace-context.js';
function SectionCard({ children }) {
    return (_jsx("div", { className: "bg-card rounded-xl border border-border shadow-sm overflow-hidden", children: children }));
}
function SectionHeader({ title, titleExtra, action }) {
    return (_jsxs("div", { className: "px-4 sm:px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: title }), titleExtra] }), action] }));
}
export default function CategoriesPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { canWrite } = useWorkspace();
    const [catDialogOpen, setCatDialogOpen] = useState(false);
    const [editingCat, setEditingCat] = useState(null);
    const [formIcon, setFormIcon] = useState('circle-help');
    const [formColor, setFormColor] = useState('#6366f1');
    const [formTreatAsTransfer, setFormTreatAsTransfer] = useState(false);
    const [formIgnoreTransfer, setFormIgnoreTransfer] = useState(false);
    const [groupDialogOpen, setGroupDialogOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [groupFormIcon, setGroupFormIcon] = useState('folder');
    const [groupFormColor, setGroupFormColor] = useState('#6B7280');
    const [collapsedGroups, setCollapsedGroups] = useState(new Set());
    const [deletingCategory, setDeletingCategory] = useState(null);
    const [deletingGroup, setDeletingGroup] = useState(null);
    const [hidingCategory, setHidingCategory] = useState(null);
    const { data: groups } = useQuery({
        queryKey: ['category-groups', 'management'],
        queryFn: groupsApi.listIncludingHidden,
    });
    const { data: categoriesList } = useQuery({
        queryKey: ['categories', 'management'],
        queryFn: categoriesApi.listIncludingHidden,
    });
    const invalidateAll = () => {
        invalidateCategoryQueries(queryClient);
    };
    const createCatMutation = useMutation({
        mutationFn: (cat) => categoriesApi.create(cat),
        onSuccess: () => { invalidateAll(); setCatDialogOpen(false); toast.success(t('categories.created')); },
    });
    const updateCatMutation = useMutation({
        mutationFn: ({ id, ...data }) => categoriesApi.update(id, data),
        onSuccess: () => { invalidateAll(); setCatDialogOpen(false); setEditingCat(null); toast.success(t('categories.updated')); },
    });
    // Hiding is its own mutation: it can also retire the rules that assign the
    // category, and it must refresh the rule list rather than the category form.
    const hideCatMutation = useMutation({
        mutationFn: ({ id, deactivateRules }) => categoriesApi.update(id, { is_hidden: true }, { deactivateRules }),
        onSuccess: (_data, variables) => {
            invalidateAll();
            if (variables.deactivateRules)
                queryClient.invalidateQueries({ queryKey: ['rules'] });
            setHidingCategory(null);
            toast.success(t('categories.updated'));
        },
        onError: (err) => toast.error(extractApiError(err, t('common.error'))),
    });
    // Rules that still file transactions into a category outlive hiding it, so
    // check for them first and only interrupt the user when there are any.
    async function handleToggleHidden(cat) {
        if (cat.is_hidden) {
            updateCatMutation.mutate({ id: cat.id, is_hidden: false });
            return;
        }
        try {
            const usage = await queryClient.fetchQuery({
                queryKey: ['category-rule-usage', cat.id],
                queryFn: () => categoriesApi.ruleUsage(cat.id),
                staleTime: 0,
            });
            if (usage.rules.length === 0) {
                hideCatMutation.mutate({ id: cat.id, deactivateRules: false });
                return;
            }
            setHidingCategory({ category: cat, rules: usage.rules });
        }
        catch (err) {
            toast.error(extractApiError(err, t('common.error')));
        }
    }
    const deleteCatMutation = useMutation({
        mutationFn: (id) => categoriesApi.delete(id),
        onSuccess: () => { invalidateAll(); setDeletingCategory(null); toast.success(t('categories.deleted')); },
        onError: (err) => {
            // The API answers 409 with an English sentence; show the translated one instead.
            if (axios.isAxiosError(err) && err.response?.status === 409) {
                toast.error(t('categories.deleteInUse'));
                return;
            }
            toast.error(extractApiError(err, t('common.error')));
        },
    });
    const createGroupMutation = useMutation({
        mutationFn: (g) => groupsApi.create(g),
        onSuccess: () => { invalidateAll(); setGroupDialogOpen(false); toast.success(t('groups.created')); },
    });
    const updateGroupMutation = useMutation({
        mutationFn: ({ id, ...data }) => groupsApi.update(id, data),
        onSuccess: () => { invalidateAll(); setGroupDialogOpen(false); setEditingGroup(null); toast.success(t('groups.updated')); },
        onError: () => { toast.error(t('common.error')); },
    });
    const deleteGroupMutation = useMutation({
        mutationFn: (id) => groupsApi.delete(id),
        onSuccess: () => { invalidateAll(); setDeletingGroup(null); toast.success(t('groups.deleted')); },
        onError: (err) => {
            toast.error(extractApiError(err, t('common.error')));
        },
    });
    const toggleCollapse = (groupId) => {
        setCollapsedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupId))
                next.delete(groupId);
            else
                next.add(groupId);
            return next;
        });
    };
    const ungrouped = categoriesList?.filter((c) => !c.group_id) ?? [];
    const openCatDialog = (cat) => {
        setEditingCat(cat);
        setFormIcon(cat?.icon ?? 'circle-help');
        setFormColor(cat?.color ?? '#6366f1');
        setFormTreatAsTransfer(cat?.treat_as_transfer ?? false);
        setFormIgnoreTransfer(cat?.is_ignored ?? false);
        setCatDialogOpen(true);
    };
    const openGroupDialog = (group) => {
        setEditingGroup(group);
        setGroupFormIcon(group?.icon ?? 'folder');
        setGroupFormColor(group?.color ?? '#6B7280');
        setGroupDialogOpen(true);
    };
    const renderHiddenBadge = (label) => (_jsx("span", { className: "text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border shrink-0", children: label }));
    const renderCategoryItem = (cat) => (_jsxs("div", { className: `flex items-center gap-3 px-4 sm:px-5 pl-6 sm:pl-12 py-2.5 border-b border-border last:border-0 hover:bg-muted transition-colors ${cat.is_hidden ? 'opacity-60' : ''}`, children: [_jsx(CategoryIcon, { icon: cat.icon, color: cat.color, size: "md" }), _jsxs("div", { className: "flex-1 min-w-0 flex items-center gap-2", children: [_jsx("span", { className: "text-sm font-medium text-foreground truncate", children: cat.name }), cat.is_hidden && renderHiddenBadge(t('categories.hiddenBadge')), cat.treat_as_transfer && (_jsx("span", { className: "text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border shrink-0", title: t('categories.treatAsTransferDesc'), children: t('categories.treatAsTransferBadge') })), cat.is_ignored && (_jsx("span", { className: "text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border shrink-0", title: t('categories.ignoreTransferDesc'), children: t('categories.ignoreTransferBadge') }))] }), _jsxs("div", { className: "hidden sm:flex items-center gap-2 shrink-0", children: [_jsx("span", { className: "inline-block w-3.5 h-3.5 rounded-full border border-black/10", style: { backgroundColor: cat.color } }), _jsx("span", { className: "text-xs text-muted-foreground font-mono", children: cat.color })] }), canWrite && (_jsxs("div", { className: "flex items-center gap-1 shrink-0 ml-2", children: [_jsx("button", { className: "p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors", onClick: () => openCatDialog(cat), title: t('common.edit'), children: _jsx(Pencil, { size: 13 }) }), cat.is_system ? (_jsx("button", { className: "p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors", onClick: () => handleToggleHidden(cat), disabled: updateCatMutation.isPending || hideCatMutation.isPending, title: cat.is_hidden ? t('categories.showDefault') : t('categories.hideDefault'), children: cat.is_hidden ? _jsx(Eye, { size: 13 }) : _jsx(EyeOff, { size: 13 }) })) : (_jsx("button", { className: "p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-50 transition-colors", onClick: () => setDeletingCategory(cat), disabled: deleteCatMutation.isPending, title: t('common.delete'), children: _jsx(Trash2, { size: 13 }) }))] }))] }, cat.id));
    return (_jsxs("div", { children: [_jsx(PageHeader, { section: t('categories.title'), title: t('categories.title') }), _jsx("p", { className: "mb-4 text-sm text-muted-foreground", children: t('categories.hiddenScopeDescription') }), _jsxs(SectionCard, { children: [_jsx(SectionHeader, { title: t('categories.title'), titleExtra: _jsxs("button", { className: "flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors", onClick: () => {
                                if (!groups)
                                    return;
                                const allCollapsed = groups.every((g) => collapsedGroups.has(g.id));
                                if (allCollapsed) {
                                    setCollapsedGroups(new Set());
                                }
                                else {
                                    setCollapsedGroups(new Set(groups.map((g) => g.id)));
                                }
                            }, children: [_jsx(ChevronsUpDown, { size: 13 }), groups && groups.every((g) => collapsedGroups.has(g.id)) ? t('categories.expandAll') : t('categories.collapseAll')] }), action: canWrite ? (_jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", className: "gap-1.5 h-8", onClick: () => openGroupDialog(null), children: [_jsx(Plus, { size: 13 }), " ", _jsx("span", { className: "hidden sm:inline", children: t('groups.add') })] }), _jsxs(Button, { size: "sm", className: "gap-1.5 h-8", onClick: () => openCatDialog(null), children: [_jsx(Plus, { size: 13 }), " ", _jsx("span", { className: "hidden sm:inline", children: t('categories.addCategory') })] })] })) : undefined }), _jsxs("div", { children: [groups?.map((group) => {
                                const isCollapsed = collapsedGroups.has(group.id);
                                return (_jsxs("div", { className: group.is_hidden ? 'opacity-60' : '', children: [_jsxs("div", { className: "flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-border bg-muted/40", children: [_jsxs("button", { className: "flex items-center gap-2 flex-1 min-w-0 text-left", onClick: () => toggleCollapse(group.id), children: [isCollapsed ? _jsx(ChevronRight, { size: 14, className: "text-muted-foreground shrink-0" }) : _jsx(ChevronDown, { size: 14, className: "text-muted-foreground shrink-0" }), _jsx(CategoryIcon, { icon: group.icon, color: group.color, size: "md" }), _jsx("span", { className: "text-sm font-semibold", style: { color: group.color }, children: group.name }), group.is_hidden && renderHiddenBadge(t('groups.hiddenBadge')), _jsxs("span", { className: "text-xs text-muted-foreground", children: ["(", group.categories.length, ")"] })] }), canWrite && (_jsxs("div", { className: "flex items-center gap-1 shrink-0", children: [_jsx("button", { className: "p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors", onClick: () => openGroupDialog(group), title: t('common.edit'), children: _jsx(Pencil, { size: 13 }) }), group.is_system ? (_jsx("button", { className: "p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors", onClick: () => updateGroupMutation.mutate({ id: group.id, is_hidden: !group.is_hidden }), disabled: updateGroupMutation.isPending, title: group.is_hidden ? t('groups.showDefault') : t('groups.hideDefault'), children: group.is_hidden ? _jsx(Eye, { size: 13 }) : _jsx(EyeOff, { size: 13 }) })) : (_jsx("button", { className: "p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-50 transition-colors", onClick: () => setDeletingGroup(group), disabled: deleteGroupMutation.isPending, title: t('common.delete'), children: _jsx(Trash2, { size: 13 }) }))] }))] }), !isCollapsed && group.categories.map(renderCategoryItem)] }, group.id));
                            }), ungrouped.length > 0 && (_jsxs("div", { children: [_jsx("div", { className: "px-5 py-3 border-b border-border bg-muted/40", children: _jsx("span", { className: "text-sm font-semibold text-muted-foreground", children: t('groups.noGroup') }) }), ungrouped.map(renderCategoryItem)] }))] })] }), _jsx(Dialog, { open: catDialogOpen, onOpenChange: () => { setCatDialogOpen(false); setEditingCat(null); }, children: _jsxs(DialogContent, { className: "flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: editingCat ? t('categories.editCategory') : t('categories.newCategory') }) }), _jsxs("form", { onSubmit: (e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                const data = {
                                    name: formData.get('name'),
                                    icon: formData.get('icon'),
                                    color: formData.get('color'),
                                    group_id: formData.get('group_id') || null,
                                    treat_as_transfer: formTreatAsTransfer,
                                    is_ignored: formIgnoreTransfer
                                };
                                if (editingCat) {
                                    updateCatMutation.mutate({ id: editingCat.id, ...data });
                                }
                                else {
                                    createCatMutation.mutate(data);
                                }
                            }, className: "flex min-h-0 flex-1 flex-col", children: [_jsxs("div", { className: "min-h-0 flex-1 space-y-4 overflow-y-auto pr-3", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('groups.name') }), _jsx(Input, { name: "name", defaultValue: editingCat?.name ?? '', required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('categories.group') }), _jsxs("select", { name: "group_id", defaultValue: editingCat?.group_id ?? '', className: "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary", children: [_jsx("option", { value: "", children: t('categories.noGroup') }), groups?.filter((g) => !g.is_hidden || g.id === editingCat?.group_id).map((g) => (_jsxs("option", { value: g.id, children: [g.name, g.is_hidden ? ` (${t('groups.hiddenBadge')})` : ''] }, g.id)))] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('groups.color') }), _jsx(Input, { name: "color", type: "color", value: formColor, onChange: (e) => setFormColor(e.target.value), required: true, className: "h-9 px-2 py-1" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('groups.icon') }), _jsx(IconPicker, { value: formIcon, color: formColor, onChange: setFormIcon }), _jsx("input", { type: "hidden", name: "icon", value: formIcon })] }), _jsxs("div", { className: "pt-2 border-t border-border", children: [_jsxs("label", { className: "flex items-start gap-3 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: formTreatAsTransfer, onChange: (e) => setFormTreatAsTransfer(e.target.checked), className: "h-4 w-4 mt-0.5 rounded border-border shrink-0" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("span", { className: "text-sm font-medium text-foreground", children: t('categories.treatAsTransfer') }), _jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: t('categories.treatAsTransferDesc') })] })] }), _jsxs("label", { className: "flex items-start gap-3 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: formIgnoreTransfer, onChange: (e) => setFormIgnoreTransfer(e.target.checked), className: "h-4 w-4 mt-0.5 rounded border-border shrink-0" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("span", { className: "text-sm font-medium text-foreground", children: t('categories.ignoreTransfer') }), _jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: t('categories.ignoreTransferDesc') })] })] })] })] }), _jsxs(DialogFooter, { className: "mt-2 shrink-0 border-t pt-4", children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => { setCatDialogOpen(false); setEditingCat(null); }, children: t('common.cancel') }), _jsx(Button, { type: "submit", children: t('common.save') })] })] }, editingCat?.id ?? 'new')] }) }), _jsx(Dialog, { open: groupDialogOpen, onOpenChange: () => { setGroupDialogOpen(false); setEditingGroup(null); }, children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: editingGroup ? t('groups.edit') : t('groups.new') }) }), _jsxs("form", { onSubmit: (e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                const data = {
                                    name: formData.get('name'),
                                    icon: formData.get('icon'),
                                    color: formData.get('color'),
                                    position: parseInt(formData.get('position')) || 0,
                                };
                                if (editingGroup) {
                                    updateGroupMutation.mutate({ id: editingGroup.id, ...data });
                                }
                                else {
                                    createGroupMutation.mutate(data);
                                }
                            }, className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('groups.name') }), _jsx(Input, { name: "name", defaultValue: editingGroup?.name ?? '', required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('groups.position') }), _jsx(Input, { name: "position", type: "number", defaultValue: editingGroup?.position?.toString() ?? '0' })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('groups.color') }), _jsx(Input, { name: "color", type: "color", value: groupFormColor, onChange: (e) => setGroupFormColor(e.target.value), required: true, className: "h-9 px-2 py-1" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('groups.icon') }), _jsx(IconPicker, { value: groupFormIcon, color: groupFormColor, onChange: setGroupFormIcon }), _jsx("input", { type: "hidden", name: "icon", value: groupFormIcon })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => { setGroupDialogOpen(false); setEditingGroup(null); }, children: t('common.cancel') }), _jsx(Button, { type: "submit", children: t('common.save') })] })] }, editingGroup?.id ?? 'new-group')] }) }), _jsx(DeleteConfirmationDialog, { open: !!deletingCategory, title: t('categories.confirmDeleteTitle'), description: t('categories.confirmDeleteDescription', { name: deletingCategory?.name }), isPending: deleteCatMutation.isPending, onClose: () => setDeletingCategory(null), onConfirm: () => deletingCategory && deleteCatMutation.mutate(deletingCategory.id) }), _jsx(DeleteConfirmationDialog, { open: !!deletingGroup, title: t('groups.confirmDeleteTitle'), description: t('groups.confirmDeleteDescription', { name: deletingGroup?.name }), isPending: deleteGroupMutation.isPending, onClose: () => setDeletingGroup(null), onConfirm: () => deletingGroup && deleteGroupMutation.mutate(deletingGroup.id) }), _jsx(Dialog, { open: !!hidingCategory, onOpenChange: (open) => !open && setHidingCategory(null), children: _jsxs(DialogContent, { className: "sm:max-w-lg", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('categories.hideWithRulesTitle', { name: hidingCategory?.category.name }) }) }), _jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: t('categories.hideWithRulesDescription', { count: hidingCategory?.rules.length ?? 0 }) }), _jsx("ul", { className: "max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border", children: hidingCategory?.rules.map((rule) => (_jsx("li", { className: "px-3 py-2 text-sm text-foreground truncate", children: rule.name }, rule.id))) })] }), _jsxs(DialogFooter, { className: "gap-2 sm:justify-between", children: [_jsx(Button, { variant: "ghost", onClick: () => setHidingCategory(null), disabled: hideCatMutation.isPending, children: t('common.cancel') }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { variant: "outline", onClick: () => hidingCategory
                                                && hideCatMutation.mutate({ id: hidingCategory.category.id, deactivateRules: false }), disabled: hideCatMutation.isPending, children: t('categories.hideKeepRules') }), _jsx(Button, { onClick: () => hidingCategory
                                                && hideCatMutation.mutate({ id: hidingCategory.category.id, deactivateRules: true }), disabled: hideCatMutation.isPending, children: t('categories.hideAndTurnOffRules') })] })] })] }) })] }));
}
