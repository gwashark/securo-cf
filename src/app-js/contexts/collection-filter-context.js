import { createContext, useContext } from 'react';
export const CollectionFilterContext = createContext(null);
export function useCollectionFilter() {
    const ctx = useContext(CollectionFilterContext);
    if (!ctx) {
        throw new Error('useCollectionFilter must be used within a CollectionFilterProvider');
    }
    return ctx;
}
