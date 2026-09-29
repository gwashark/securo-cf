/**
 * The workspace kinds, in the order they're offered at creation. Set
 * once and never edited, so this list only ever feeds the create dialog
 * and read-only labels.
 */
export const WORKSPACE_KINDS = ['personal', 'business'];
export const WORKSPACE_KIND_LABEL_KEY = {
    personal: 'workspace.kindPersonal',
    business: 'workspace.kindBusiness',
};
/** Fallback icon when a workspace hasn't picked its own. */
export const WORKSPACE_KIND_ICON = {
    personal: 'user',
    business: 'building-2',
};
