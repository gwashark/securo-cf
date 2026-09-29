import { useCallback, useEffect, useMemo, useState } from 'react';
// Source of truth for the available columns. The picker iterates over this
// list in registry order; visible columns render in the order the user has
// chosen (persisted in localStorage), which defaults to registry order.
export const COLUMN_REGISTRY = [
    { id: 'date', labelKey: 'transactions.colDate', defaultVisible: true, sortable: true, defaultWidth: 110, align: 'left' },
    { id: 'description', labelKey: 'transactions.colDescription', alwaysOn: true, defaultVisible: true, sortable: true, defaultWidth: 320, align: 'left' },
    { id: 'category', labelKey: 'transactions.colCategory', defaultVisible: true, sortable: true, defaultWidth: 180, align: 'left' },
    { id: 'account', labelKey: 'transactions.colAccount', defaultVisible: true, sortable: true, defaultWidth: 160, align: 'left' },
    { id: 'payee', labelKey: 'transactions.colPayee', defaultVisible: false, sortable: true, defaultWidth: 160, align: 'left' },
    { id: 'notes', labelKey: 'transactions.colNotes', defaultVisible: false, sortable: false, defaultWidth: 220, align: 'left' },
    { id: 'tags', labelKey: 'transactions.colTags', defaultVisible: false, sortable: false, defaultWidth: 180, align: 'left' },
    { id: 'attachments', labelKey: 'transactions.colAttachments', defaultVisible: false, sortable: false, defaultWidth: 70, align: 'right' },
    { id: 'type', labelKey: 'transactions.colType', defaultVisible: false, sortable: true, defaultWidth: 100, align: 'left' },
    { id: 'status', labelKey: 'transactions.colStatus', defaultVisible: false, sortable: true, defaultWidth: 100, align: 'left' },
    { id: 'amount', labelKey: 'transactions.colAmount', alwaysOn: true, defaultVisible: true, sortable: true, defaultWidth: 160, align: 'right' },
];
const COL_BY_ID = Object.fromEntries(COLUMN_REGISTRY.map(c => [c.id, c]));
export function getColumn(id) {
    return COL_BY_ID[id];
}
const STORAGE_KEY_ORDER = 'securo.transactions.columns.order';
const STORAGE_KEY_WIDTHS = 'securo.transactions.columns.widths';
const STORAGE_KEY_SORT = 'securo.transactions.sort';
function loadOrder() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_ORDER);
        if (!raw)
            return defaultVisibleOrder();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return defaultVisibleOrder();
        // Drop unknown ids (registry shrank). Keep alwaysOn ids even if missing.
        const known = parsed.filter((id) => id in COL_BY_ID);
        for (const c of COLUMN_REGISTRY) {
            if (c.alwaysOn && !known.includes(c.id))
                known.push(c.id);
        }
        return known;
    }
    catch {
        return defaultVisibleOrder();
    }
}
function defaultVisibleOrder() {
    return COLUMN_REGISTRY.filter(c => c.defaultVisible || c.alwaysOn).map(c => c.id);
}
function loadWidths() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_WIDTHS);
        if (!raw)
            return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object')
            return {};
        const out = {};
        for (const [k, v] of Object.entries(parsed)) {
            if (k in COL_BY_ID && typeof v === 'number' && v > 40 && v < 800) {
                out[k] = v;
            }
        }
        return out;
    }
    catch {
        return {};
    }
}
function loadSort() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_SORT);
        if (!raw)
            return { by: null, dir: 'desc' };
        const parsed = JSON.parse(raw);
        const by = parsed?.by && parsed.by in COL_BY_ID ? parsed.by : null;
        const dir = parsed?.dir === 'asc' ? 'asc' : 'desc';
        return { by, dir };
    }
    catch {
        return { by: null, dir: 'desc' };
    }
}
export function useTransactionsGridState() {
    const [order, setOrder] = useState(() => loadOrder());
    const [widths, setWidths] = useState(() => loadWidths());
    const [sort, setSort] = useState(() => loadSort());
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(order));
        }
        catch { /* quota / disabled */ }
    }, [order]);
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY_WIDTHS, JSON.stringify(widths));
        }
        catch { /* quota / disabled */ }
    }, [widths]);
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY_SORT, JSON.stringify(sort));
        }
        catch { /* quota / disabled */ }
    }, [sort]);
    const visibleColumns = useMemo(() => order.map(id => COL_BY_ID[id]).filter(Boolean), [order]);
    const visibleIds = useMemo(() => visibleColumns.map(c => c.id), [visibleColumns]);
    const visibleSet = useMemo(() => new Set(visibleIds), [visibleIds]);
    const isVisible = useCallback((id) => visibleSet.has(id), [visibleSet]);
    const toggleColumn = useCallback((id) => {
        const def = COL_BY_ID[id];
        if (!def || def.alwaysOn)
            return;
        setOrder(prev => {
            if (prev.includes(id))
                return prev.filter(x => x !== id);
            // Re-insert at the position the registry suggests, so toggling on
            // a column twice doesn't drift it to the end.
            const registryOrder = COLUMN_REGISTRY.map(c => c.id);
            const next = [...prev, id];
            next.sort((a, b) => registryOrder.indexOf(a) - registryOrder.indexOf(b));
            return next;
        });
    }, []);
    const resetColumns = useCallback(() => {
        setOrder(defaultVisibleOrder());
        setWidths({});
    }, []);
    const widthOf = useCallback((id) => widths[id] ?? COL_BY_ID[id]?.defaultWidth ?? 120, [widths]);
    const setWidth = useCallback((id, width) => {
        const clamped = Math.max(60, Math.min(800, Math.round(width)));
        setWidths(prev => ({ ...prev, [id]: clamped }));
    }, []);
    const toggleSort = useCallback((id) => {
        const def = COL_BY_ID[id];
        if (!def || !def.sortable)
            return;
        // Two-state toggle: first click on a column sorts descending, then every
        // subsequent click flips the direction. We intentionally never cycle back
        // to an unsorted state: the backend's implicit default is date-descending,
        // so a "cleared" sort was visually identical to date-desc and made the
        // header look like it toggled between the same two orders (issue #383).
        setSort(prev => {
            if (prev.by !== id)
                return { by: id, dir: 'desc' };
            return { by: id, dir: prev.dir === 'desc' ? 'asc' : 'desc' };
        });
    }, []);
    const apiSort = useMemo(() => {
        if (!sort.by)
            return {};
        return { sort_by: sort.by, sort_dir: sort.dir };
    }, [sort]);
    return {
        visibleIds,
        visibleColumns,
        isVisible,
        toggleColumn,
        resetColumns,
        widthOf,
        setWidth,
        sortBy: sort.by,
        sortDir: sort.dir,
        toggleSort,
        apiSort,
    };
}
