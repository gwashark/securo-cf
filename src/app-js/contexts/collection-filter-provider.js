import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collections as collectionsApi } from '../lib/api.js';
import { useWorkspace } from './workspace-context.js';
import { CollectionFilterContext } from './collection-filter-context.js';
const STORAGE_PREFIX = 'securo.activeCollection.';
export function CollectionFilterProvider({ children }) {
    const { current } = useWorkspace();
    const wsId = current?.id ?? '';
    const { data } = useQuery({
        queryKey: ['collections'],
        queryFn: collectionsApi.list,
    });
    const collections = useMemo(() => data ?? [], [data]);
    const [activeCollectionId, setActiveId] = useState(null);
    // The active selection is persisted per workspace — switching workspaces
    // restores that workspace's last-used collection (or "all").
    const [loadedWsId, setLoadedWsId] = useState(null);
    if (wsId && wsId !== loadedWsId) {
        setLoadedWsId(wsId);
        setActiveId(localStorage.getItem(STORAGE_PREFIX + wsId) || null);
    }
    const setActiveCollectionId = (id) => {
        setActiveId(id);
        if (!wsId)
            return;
        if (id)
            localStorage.setItem(STORAGE_PREFIX + wsId, id);
        else
            localStorage.removeItem(STORAGE_PREFIX + wsId);
    };
    const activeCollection = useMemo(() => collections.find((c) => c.id === activeCollectionId) ?? null, [collections, activeCollectionId]);
    // If the active collection was deleted elsewhere, fall back to "all".
    useEffect(() => {
        if (activeCollectionId && collections.length > 0 && !activeCollection) {
            setActiveCollectionId(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCollectionId, collections, activeCollection]);
    const value = {
        collections,
        activeCollectionId,
        activeCollection,
        setActiveCollectionId,
        activeAccountIds: activeCollection ? activeCollection.account_ids : null,
        activeWalletIds: activeCollection ? activeCollection.wallet_ids : null,
    };
    return (_jsx(CollectionFilterContext.Provider, { value: value, children: children }));
}
