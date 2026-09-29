import axios from 'axios';
const api = axios.create({
    baseURL: '/api',
});
// Storage key for the currently-selected workspace ID. Lives in
// localStorage so reloads + new tabs stay on the same workspace until
// the user picks another one.
export const WORKSPACE_STORAGE_KEY = 'workspace_id';
// Add auth token + active workspace header to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    const workspaceId = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (workspaceId) {
        config.headers['X-Workspace-Id'] = workspaceId;
    }
    return config;
});
// Handle auth errors
api.interceptors.response.use((response) => response, (error) => {
    if (error.response?.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
    }
    return Promise.reject(error);
});
// Workspaces
export const workspaces = {
    list: async () => {
        const { data } = await api.get('/workspaces');
        return data;
    },
    current: async () => {
        const { data } = await api.get('/workspaces/current');
        return data;
    },
    create: async (payload) => {
        const { data } = await api.post('/workspaces', payload);
        return data;
    },
    // `kind` is absent on purpose: it is fixed when the workspace is created.
    update: async (id, payload) => {
        const { data } = await api.patch(`/workspaces/${id}`, payload);
        return data;
    },
    listMembers: async (id) => {
        const { data } = await api.get(`/workspaces/${id}/members`);
        return data;
    },
    invite: async (id, payload) => {
        const { data } = await api.post(`/workspaces/${id}/members`, payload);
        return data;
    },
    changeRole: async (id, memberUserId, role) => {
        const { data } = await api.patch(`/workspaces/${id}/members/${memberUserId}`, { role });
        return data;
    },
    removeMember: async (id, memberUserId) => {
        await api.delete(`/workspaces/${id}/members/${memberUserId}`);
    },
    stats: async (id) => {
        const { data } = await api.get(`/workspaces/${id}/stats`);
        return data;
    },
    archive: async (id) => {
        const { data } = await api.post(`/workspaces/${id}/archive`);
        return data;
    },
};
// Setup
export const setup = {
    status: async () => {
        const { data } = await api.get('/setup/status');
        return data;
    },
    createAdmin: async (email, password, currency = 'USD', name = '', language = 'en') => {
        const { data } = await api.post('/setup/create-admin', { email, password, currency, name, language });
        return data;
    },
};
// Auth
export const auth = {
    login: async (email, password) => {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);
        const { data } = await api.post('/auth/login', formData, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        return data;
    },
    register: async (email, password, preferences) => {
        const { data } = await api.post('/auth/register', { email, password, preferences });
        return data;
    },
    me: async () => {
        const { data } = await api.get('/users/me');
        return data;
    },
    updateMe: async (updates) => {
        const { data } = await api.patch('/users/me', updates);
        return data;
    },
    changePassword: async (password) => {
        const { data } = await api.patch('/users/me', { password });
        return data;
    },
    setup2fa: async () => {
        const { data } = await api.post('/auth/2fa/setup');
        return data;
    },
    enable2fa: async (code) => {
        await api.post('/auth/2fa/enable', { code });
    },
    disable2fa: async (password, code) => {
        await api.post('/auth/2fa/disable', { password, code });
    },
    verify2fa: async (tempToken, code) => {
        const { data } = await api.post('/auth/2fa/verify', { temp_token: tempToken, code });
        return data;
    },
    listPasskeys: async () => {
        const { data } = await api.get('/auth/passkeys');
        return data;
    },
    registerPasskeyOptions: async (name) => {
        const { data } = await api.post('/auth/passkeys/register/options', { name });
        return data;
    },
    verifyPasskeyRegistration: async (challengeId, name, credential) => {
        const { data } = await api.post('/auth/passkeys/register/verify', {
            challenge_id: challengeId,
            name,
            credential,
        });
        return data;
    },
    deletePasskey: async (id) => {
        await api.delete(`/auth/passkeys/${id}`);
    },
    passkeyAuthenticationOptions: async (email) => {
        const { data } = await api.post('/auth/passkeys/authenticate/options', { email });
        return data;
    },
    verifyPasskeyAuthentication: async (challengeId, credential) => {
        const { data } = await api.post('/auth/passkeys/authenticate/verify', {
            challenge_id: challengeId,
            credential,
        });
        return data;
    },
    passkeySecondFactorOptions: async (tempToken) => {
        const { data } = await api.post('/auth/passkeys/2fa/options', { temp_token: tempToken });
        return data;
    },
    verifyPasskeySecondFactor: async (tempToken, challengeId, credential) => {
        const { data } = await api.post('/auth/passkeys/2fa/verify', {
            temp_token: tempToken,
            challenge_id: challengeId,
            credential,
        });
        return data;
    },
    oidcConfig: async () => {
        // The login card blocks on this call while it decides which sign-in
        // methods to offer, so a hung request must fail fast and let the caller
        // fall back instead of leaving the page stuck on its loading state.
        const { data } = await api.get('/auth/oidc/config', { timeout: 5000 });
        return data;
    },
};
// Categories
export const categories = {
    list: async () => {
        const { data } = await api.get('/categories');
        return data;
    },
    listIncludingHidden: async () => {
        const { data } = await api.get('/categories', { params: { include_hidden: true } });
        return data;
    },
    create: async (category) => {
        const { data } = await api.post('/categories', category);
        return data;
    },
    update: async (id, category, options) => {
        const { data } = await api.patch(`/categories/${id}`, category, {
            params: options?.deactivateRules ? { deactivate_rules: true } : undefined,
        });
        return data;
    },
    ruleUsage: async (id) => {
        const { data } = await api.get(`/categories/${id}/rule-usage`);
        return data;
    },
    delete: async (id) => {
        await api.delete(`/categories/${id}`);
    },
};
// Category Groups
export const categoryGroups = {
    list: async () => {
        const { data } = await api.get('/category-groups');
        return data;
    },
    listIncludingHidden: async () => {
        const { data } = await api.get('/category-groups', { params: { include_hidden: true } });
        return data;
    },
    create: async (group) => {
        const { data } = await api.post('/category-groups', group);
        return data;
    },
    update: async (id, group) => {
        const { data } = await api.patch(`/category-groups/${id}`, group);
        return data;
    },
    delete: async (id) => {
        await api.delete(`/category-groups/${id}`);
    },
};
// Bank Connections
export const connections = {
    list: async () => {
        const { data } = await api.get('/connections');
        return data;
    },
    getProviders: async () => {
        const { data } = await api.get('/connections/providers');
        return data.providers;
    },
    getConnectToken: async (provider = 'pluggy') => {
        const { data } = await api.post('/connections/connect-token', { provider });
        return data.access_token;
    },
    getOAuthUrl: async (provider, flow_params) => {
        const { data } = await api.post('/connections/oauth/url', { provider, flow_params });
        return data.url;
    },
    listInstitutions: async (provider, country) => {
        const { data } = await api.get(`/connections/${provider}/institutions`, {
            params: country ? { country } : undefined,
        });
        return data;
    },
    handleCallback: async (code, provider, state, settings, reconnectConnectionId) => {
        const { data } = await api.post('/connections/oauth/callback', {
            code,
            provider,
            state,
            reconnect_connection_id: reconnectConnectionId,
            ...settings,
        });
        return data;
    },
    getReauthUrl: async (connectionId) => {
        const { data } = await api.post(`/connections/${connectionId}/oauth/reauth-url`);
        return data.url;
    },
    sync: async (id) => {
        const { data } = await api.post(`/connections/${id}/sync`);
        return data;
    },
    getReconnectToken: async (connectionId) => {
        const { data } = await api.post(`/connections/${connectionId}/reconnect-token`);
        return data.access_token;
    },
    updateSettings: async (id, settings) => {
        const { data } = await api.patch(`/connections/${id}/settings`, settings);
        return data;
    },
    delete: async (id) => {
        await api.delete(`/connections/${id}`);
    },
};
// Accounts
export const accounts = {
    list: async (includeClosed = false) => {
        const { data } = await api.get('/accounts', { params: { include_closed: includeClosed } });
        return data;
    },
    get: async (id) => {
        const { data } = await api.get(`/accounts/${id}`);
        return data;
    },
    create: async (account) => {
        const { data } = await api.post('/accounts', account);
        return data;
    },
    update: async (id, account) => {
        const { data } = await api.patch(`/accounts/${id}`, account);
        return data;
    },
    delete: async (id) => {
        await api.delete(`/accounts/${id}`);
    },
    summary: async (id, from, to, billId, unbilledOnly) => {
        const { data } = await api.get(`/accounts/${id}/summary`, { params: { from, to, bill_id: billId, unbilled_only: unbilledOnly || undefined } });
        return data;
    },
    balanceHistory: async (id, from, to) => {
        const { data } = await api.get(`/accounts/${id}/balance-history`, { params: { from, to } });
        return data;
    },
    bills: async (id, limit = 24) => {
        const { data } = await api.get(`/accounts/${id}/bills`, { params: { limit } });
        return data;
    },
    close: async (id) => {
        const { data } = await api.post(`/accounts/${id}/close`);
        return data;
    },
    reopen: async (id) => {
        const { data } = await api.post(`/accounts/${id}/reopen`);
        return data;
    },
};
// Transactions
export const transactions = {
    list: async (params) => {
        const { data } = await api.get('/transactions', {
            params,
            paramsSerializer: { indexes: null },
        });
        return data;
    },
    calendar: async (params) => {
        const { data } = await api.get('/transactions/calendar', {
            params,
            paramsSerializer: { indexes: null },
        });
        return data;
    },
    get: async (id) => {
        const { data } = await api.get(`/transactions/${id}`);
        return data;
    },
    create: async (transaction) => {
        const { data } = await api.post('/transactions', transaction);
        return data;
    },
    createInstallments: async (payload) => {
        const { data } = await api.post('/transactions/installments', payload);
        return data;
    },
    update: async (id, transaction) => {
        const { data } = await api.patch(`/transactions/${id}`, transaction);
        return data;
    },
    delete: async (id, applyTo = 'this') => {
        await api.delete(`/transactions/${id}`, { params: { apply_to: applyTo } });
    },
    toggleIgnore: async (id) => {
        const { data } = await api.patch(`/transactions/${id}/ignore`);
        return data;
    },
    unlinkRecurring: async (id) => {
        const { data } = await api.patch(`/transactions/${id}/unlink-recurring`);
        return data;
    },
    createTransfer: async (transfer) => {
        const { data } = await api.post('/transactions/transfer', transfer);
        return data;
    },
    bulkCategorize: async (transactionIds, categoryId) => {
        const { data } = await api.patch('/transactions/bulk-categorize', {
            transaction_ids: transactionIds,
            category_id: categoryId,
        });
        return data;
    },
    bulkAddTags: async (transactionIds, tags) => {
        const { data } = await api.patch('/transactions/bulk-add-tags', {
            transaction_ids: transactionIds,
            tags,
        });
        return data;
    },
    bulkRemoveTags: async (transactionIds, tags) => {
        const { data } = await api.patch('/transactions/bulk-remove-tags', {
            transaction_ids: transactionIds,
            tags,
        });
        return data;
    },
    bulkAddToGroup: async (transactionIds, groupId, options) => {
        const { data } = await api.patch('/transactions/bulk-add-to-group', {
            transaction_ids: transactionIds,
            group_id: groupId,
            ...(options?.share_type ? { share_type: options.share_type } : {}),
            ...(options?.member_splits ? { member_splits: options.member_splits } : {}),
        });
        return data;
    },
    bulkDelete: async (transactionIds) => {
        const { data } = await api.post('/transactions/bulk-delete', {
            transaction_ids: transactionIds,
        });
        return data;
    },
    linkTransfer: async (transactionIds) => {
        const { data } = await api.post('/transactions/link-transfer', {
            transaction_ids: transactionIds,
        });
        return data;
    },
    createTransferCounterpart: async (transactionId, toAccountId) => {
        const { data } = await api.post(`/transactions/${transactionId}/create-counterpart`, {
            to_account_id: toAccountId,
        });
        return data;
    },
    transferCandidates: async (transactionId, params) => {
        const { data } = await api.get(`/transactions/${transactionId}/transfer-candidates`, { params });
        return data;
    },
    transferPair: async (transactionId) => {
        const { data } = await api.get(`/transactions/${transactionId}/transfer-pair`);
        return data;
    },
    unlinkTransfer: async (pairId) => {
        await api.delete(`/connections/transfers/${pairId}`);
    },
    previewImport: async (file, options) => {
        const formData = new FormData();
        formData.append('file', file);
        if (options?.date_format)
            formData.append('date_format', options.date_format);
        if (options?.flip_amount)
            formData.append('flip_amount', 'true');
        if (options?.inflow_column)
            formData.append('inflow_column', options.inflow_column);
        if (options?.outflow_column)
            formData.append('outflow_column', options.outflow_column);
        if (options?.column_mapping && Object.keys(options.column_mapping).length > 0) {
            formData.append('column_mapping', JSON.stringify(options.column_mapping));
        }
        const { data } = await api.post('/transactions/import/preview', formData);
        return data;
    },
    import: async (account_id, transactions, filename, detected_format, options) => {
        const payload = { account_id, transactions, filename, detected_format };
        if (typeof options?.detect_duplicates === 'boolean') {
            payload.detect_duplicates = options.detect_duplicates;
        }
        const { data } = await api.post('/transactions/import', payload);
        return data;
    },
    export: async (params) => {
        const { data } = await api.get('/transactions/export', {
            params,
            responseType: 'blob',
            paramsSerializer: { indexes: null },
        });
        const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    attachments: {
        list: async (transactionId) => {
            const { data } = await api.get(`/transactions/${transactionId}/attachments`);
            return data;
        },
        upload: async (transactionId, file) => {
            const formData = new FormData();
            formData.append('file', file);
            const { data } = await api.post(`/transactions/${transactionId}/attachments`, formData);
            return data;
        },
        downloadUrl: async (transactionId, attachmentId) => {
            const { data } = await api.get(`/transactions/${transactionId}/attachments/${attachmentId}`, {
                responseType: 'blob',
            });
            return URL.createObjectURL(data);
        },
        rename: async (transactionId, attachmentId, filename) => {
            const { data } = await api.patch(`/transactions/${transactionId}/attachments/${attachmentId}`, { filename });
            return data;
        },
        delete: async (transactionId, attachmentId) => {
            await api.delete(`/transactions/${transactionId}/attachments/${attachmentId}`);
        },
    },
};
// Payees
/** Jurisdiction metadata. Labels, masks and ordering come from the server so
 *  the browser cannot disagree with it about what a document looks like. */
export const fiscal = {
    jurisdictions: async () => {
        const { data } = await api.get('/fiscal/jurisdictions');
        return data.jurisdictions;
    },
    taxIdKinds: async () => {
        const { data } = await api.get('/fiscal/tax-id-kinds');
        return data;
    },
    /** Fiscal references the workspace's jurisdiction suggests on a product. */
    productFields: async () => {
        const { data } = await api.get('/fiscal/product-fields');
        return data;
    },
};
/** The catalog: what the workspace sells. Gated like invoices. */
export const products = {
    list: async (params) => {
        const { data } = await api.get('/products', {
            params: {
                ...(params?.active === undefined ? {} : { active: params.active }),
                ...(params?.kind ? { kind: params.kind } : {}),
                ...(params?.q ? { q: params.q } : {}),
            },
        });
        return data;
    },
    get: async (id) => {
        const { data } = await api.get(`/products/${id}`);
        return data;
    },
    create: async (payload) => {
        const { data } = await api.post('/products', payload);
        return data;
    },
    update: async (id, payload) => {
        const { data } = await api.patch(`/products/${id}`, payload);
        return data;
    },
    remove: async (id) => {
        await api.delete(`/products/${id}`);
    },
    addPrice: async (id, payload) => {
        const { data } = await api.post(`/products/${id}/prices`, payload);
        return data;
    },
    updatePrice: async (id, priceId, payload) => {
        const { data } = await api.patch(`/products/${id}/prices/${priceId}`, payload);
        return data;
    },
    removePrice: async (id, priceId) => {
        const { data } = await api.delete(`/products/${id}/prices/${priceId}`);
        return data;
    },
};
export const payees = {
    list: async (params) => {
        const cleanParams = params && !('queryKey' in params) ? params : undefined;
        const { data } = await api.get('/payees', { params: cleanParams });
        return data;
    },
    get: async (id) => {
        const { data } = await api.get(`/payees/${id}`);
        return data;
    },
    summary: async (id, from, to) => {
        const { data } = await api.get(`/payees/${id}/summary`, { params: { from, to } });
        return data;
    },
    create: async (payee) => {
        const { data } = await api.post('/payees', payee);
        return data;
    },
    update: async (id, payee) => {
        const { data } = await api.patch(`/payees/${id}`, payee);
        return data;
    },
    delete: async (id) => {
        await api.delete(`/payees/${id}`);
    },
    merge: async (targetId, sourceIds) => {
        const { data } = await api.post('/payees/merge', { target_id: targetId, source_ids: sourceIds });
        return data;
    },
    bulkDelete: async (ids) => {
        const { data } = await api.post('/payees/bulk-delete', { ids });
        return data;
    },
};
export const groups = {
    list: async (includeArchived = false) => {
        const { data } = await api.get('/groups', { params: { include_archived: includeArchived } });
        return data;
    },
    get: async (id) => {
        const { data } = await api.get(`/groups/${id}`);
        return data;
    },
    create: async (payload) => {
        const { data } = await api.post('/groups', payload);
        return data;
    },
    update: async (id, payload) => {
        const { data } = await api.patch(`/groups/${id}`, payload);
        return data;
    },
    delete: async (id) => {
        await api.delete(`/groups/${id}`);
    },
    members: {
        list: async (groupId) => {
            const { data } = await api.get(`/groups/${groupId}/members`);
            return data;
        },
        create: async (groupId, payload) => {
            const { data } = await api.post(`/groups/${groupId}/members`, payload);
            return data;
        },
        update: async (groupId, memberId, payload) => {
            const { data } = await api.patch(`/groups/${groupId}/members/${memberId}`, payload);
            return data;
        },
        delete: async (groupId, memberId) => {
            await api.delete(`/groups/${groupId}/members/${memberId}`);
        },
    },
    settlements: {
        list: async (groupId) => {
            const { data } = await api.get(`/groups/${groupId}/settlements`);
            return data;
        },
        create: async (groupId, payload) => {
            const { data } = await api.post(`/groups/${groupId}/settlements`, payload);
            return data;
        },
        update: async (groupId, settlementId, payload) => {
            const { data } = await api.patch(`/groups/${groupId}/settlements/${settlementId}`, payload);
            return data;
        },
        delete: async (groupId, settlementId) => {
            await api.delete(`/groups/${groupId}/settlements/${settlementId}`);
        },
    },
    balances: async (groupId) => {
        const { data } = await api.get(`/groups/${groupId}/balances`);
        return data;
    },
    transactions: async (groupId, limit = 20) => {
        const { data } = await api.get(`/groups/${groupId}/transactions`, {
            params: { limit },
        });
        return data;
    },
};
export const users = {
    lookupByEmail: async (email) => {
        try {
            const { data } = await api.get('/users/lookup', { params: { email } });
            return data;
        }
        catch (err) {
            const status = err?.response?.status;
            if (status === 404)
                return null;
            throw err;
        }
    },
    directory: async () => {
        const { data } = await api.get('/users/directory');
        return data;
    },
};
// Categorization Rules
export const rules = {
    list: async () => {
        const { data } = await api.get('/rules');
        return data;
    },
    create: async (rule) => {
        const { data } = await api.post('/rules', rule);
        return data;
    },
    update: async (id, rule) => {
        const { data } = await api.patch(`/rules/${id}`, rule);
        return data;
    },
    delete: async (id) => {
        await api.delete(`/rules/${id}`);
    },
    preview: async (draft) => {
        const { data } = await api.post('/rules/preview', draft);
        return data;
    },
    applyAll: async () => {
        const { data } = await api.post('/rules/apply-all');
        return data;
    },
    exportFile: async () => {
        const { data } = await api.get('/rules/export', { responseType: 'blob' });
        const blob = new Blob([data], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `securo-categorization-rules-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    importFile: async (payload, overwrite = false) => {
        const { data } = await api.post('/rules/import', { payload, overwrite });
        return data;
    },
    packs: async () => {
        const { data } = await api.get('/rules/packs');
        return data;
    },
    installPack: async (packCode, createMissingCategories = false) => {
        const { data } = await api.post(`/rules/packs/${packCode}/install`, null, {
            params: { create_missing_categories: createMissingCategories },
        });
        return data;
    },
};
// Recurring Transactions
// Reconciliation: the rules matching follows, and the matches it was
// not confident enough to make on its own.
export const reconciliation = {
    rules: async () => {
        const { data } = await api.get('/reconciliation/rules');
        return data;
    },
    updateRule: async (node, id, patch) => {
        const { data } = await api.patch(`/reconciliation/rules/${encodeURIComponent(node)}/${encodeURIComponent(id)}`, patch);
        return data;
    },
    /** Set the order rules are tried in. Names every rule in the set: the
     *  first match wins, so a half-implicit order rearranges itself the day
     *  a new default ships. */
    reorderRules: async (node, order) => {
        const { data } = await api.put(`/reconciliation/rules/${encodeURIComponent(node)}/order`, { order });
        return data;
    },
    createRule: async (rule) => {
        const { data } = await api.post('/reconciliation/rules', rule);
        return data;
    },
    /** Get rid of a rule, whoever wrote it: ours included. What happens
     *  underneath differs (a rule of your own is a row and goes; one of
     *  ours ships in the image, so a tombstone records that this workspace
     *  does not run it) but that is our problem, not something to make a
     *  person learn. */
    deleteRule: async (node, id) => {
        await api.delete(`/reconciliation/rules/${encodeURIComponent(node)}/${encodeURIComponent(id)}`);
    },
    /** Forget everything this workspace did to one of our rules (a moved
     *  threshold, a place in the order, a deletion), and go back to
     *  whatever we ship today. */
    resetRule: async (node, id) => {
        await api.post(`/reconciliation/rules/${encodeURIComponent(node)}/${encodeURIComponent(id)}/reset`);
    },
    /** `node` narrows the file to one set. Each set is its own card with
     *  its own button, and a button under one heading that hands over
     *  another set's rules is a button that lies. */
    exportRules: async (node) => {
        const { data } = await api.get('/reconciliation/rules/export', {
            responseType: 'blob',
            params: node ? { node } : undefined,
        });
        const blob = new Blob([data], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // The set in the filename, so two exports do not overwrite each
        // other in the downloads folder on the same day.
        const set = node ? `-${node.split('.').pop()}` : '';
        a.download = `securo-reconciliation-rules${set}-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    /** Replaces rather than merges: order is the mechanism here, and there
     *  is no correct way to interleave two orderings. Hence `overwrite`. */
    importRules: async (payload, overwrite = false, node) => {
        const { data } = await api.post('/reconciliation/rules/import', { payload, overwrite }, { params: node ? { node } : undefined });
        return data;
    },
    /** What matching did, newest first. `expectationId` narrows it to
     *  everything that ever happened to one invoice. */
    history: async (expectationId) => {
        const { data } = await api.get('/reconciliation/history', {
            params: expectationId ? { expectation_id: expectationId } : undefined,
        });
        return data;
    },
    suggestions: async () => {
        const { data } = await api.get('/reconciliation/suggestions');
        return data;
    },
    accept: async (id) => {
        const { data } = await api.post(`/reconciliation/suggestions/${id}/accept`);
        return data;
    },
    decline: async (id) => {
        const { data } = await api.post(`/reconciliation/suggestions/${id}/decline`);
        return data;
    },
};
export const recurring = {
    list: async () => {
        const { data } = await api.get('/recurring-transactions');
        return data;
    },
    create: async (rt) => {
        const { data } = await api.post('/recurring-transactions', rt);
        return data;
    },
    update: async (id, rt) => {
        const { data } = await api.patch(`/recurring-transactions/${id}`, rt);
        return data;
    },
    delete: async (id) => {
        await api.delete(`/recurring-transactions/${id}`);
    },
    generate: async () => {
        const { data } = await api.post('/recurring-transactions/generate');
        return data;
    },
};
// Budgets
export const budgets = {
    list: async (month) => {
        const { data } = await api.get('/budgets', { params: { month } });
        return data;
    },
    create: async (budget) => {
        const { data } = await api.post('/budgets', budget);
        return data;
    },
    update: async (id, budget) => {
        const { data } = await api.patch(`/budgets/${id}`, budget);
        return data;
    },
    delete: async (id) => {
        await api.delete(`/budgets/${id}`);
    },
    comparison: async (month) => {
        const { data } = await api.get('/budgets/comparison', { params: { month } });
        return data;
    },
};
// Goals
export const goals = {
    list: async (status) => {
        const { data } = await api.get('/goals', { params: { status } });
        return data;
    },
    get: async (id) => {
        const { data } = await api.get(`/goals/${id}`);
        return data;
    },
    create: async (goal) => {
        const { data } = await api.post('/goals', goal);
        return data;
    },
    update: async (id, goal) => {
        const { data } = await api.patch(`/goals/${id}`, goal);
        return data;
    },
    delete: async (id) => {
        await api.delete(`/goals/${id}`);
    },
    summary: async (limit = 3) => {
        const { data } = await api.get('/goals/summary', { params: { limit } });
        return data;
    },
};
// Dashboard
// Repeated `account_ids=a&account_ids=b` (no [] brackets) so FastAPI's
// list[UUID] query param parses them. Only attached when a filter is active.
const acctIdsParam = (accountIds) => accountIds && accountIds.length > 0
    ? { params: { account_ids: accountIds }, paramsSerializer: { indexes: null } }
    : {};
export const dashboard = {
    summary: async (month, balanceDate, accountIds, assetGroupIds) => {
        const hasFilter = (accountIds && accountIds.length > 0) || (assetGroupIds && assetGroupIds.length > 0);
        const { data } = await api.get('/dashboard/summary', {
            params: {
                month, balance_date: balanceDate,
                ...(accountIds && accountIds.length > 0 ? { account_ids: accountIds } : {}),
                ...(assetGroupIds && assetGroupIds.length > 0 ? { asset_group_ids: assetGroupIds } : {}),
            },
            ...(hasFilter ? { paramsSerializer: { indexes: null } } : {}),
        });
        return data;
    },
    spendingByCategory: async (month, accountIds) => {
        const extra = acctIdsParam(accountIds);
        const { data } = await api.get('/dashboard/spending-by-category', { params: { month, ...(extra.params ?? {}) }, ...(extra.paramsSerializer ? { paramsSerializer: extra.paramsSerializer } : {}) });
        return data;
    },
    monthlyTrend: async (months = 6, accountIds) => {
        const extra = acctIdsParam(accountIds);
        const { data } = await api.get('/dashboard/monthly-trend', { params: { months, ...(extra.params ?? {}) }, ...(extra.paramsSerializer ? { paramsSerializer: extra.paramsSerializer } : {}) });
        return data;
    },
    projectedTransactions: async (params) => {
        const { data } = await api.get('/dashboard/projected-transactions', { params });
        return data;
    },
    balanceHistory: async (month, accountIds) => {
        const extra = acctIdsParam(accountIds);
        const { data } = await api.get('/dashboard/balance-history', { params: { month, ...(extra.params ?? {}) }, ...(extra.paramsSerializer ? { paramsSerializer: extra.paramsSerializer } : {}) });
        return data;
    },
};
// Assets
export const assets = {
    list: async (includeArchived = false) => {
        const { data } = await api.get('/assets', { params: { include_archived: includeArchived } });
        return data;
    },
    get: async (id) => {
        const { data } = await api.get(`/assets/${id}`);
        return data;
    },
    create: async (asset) => {
        const { data } = await api.post('/assets', asset);
        return data;
    },
    update: async (id, asset, opts) => {
        const { data } = await api.patch(`/assets/${id}`, asset, {
            params: opts?.regenerateGrowth ? { regenerate_growth: true } : undefined,
        });
        return data;
    },
    delete: async (id) => {
        await api.delete(`/assets/${id}`);
    },
    values: async (id) => {
        const { data } = await api.get(`/assets/${id}/values`);
        return data;
    },
    valueTrend: async (id, months = 12) => {
        const { data } = await api.get(`/assets/${id}/value-trend`, { params: { months } });
        return data;
    },
    addValue: async (id, value) => {
        const { data } = await api.post(`/assets/${id}/values`, value);
        return data;
    },
    deleteValue: async (valueId) => {
        await api.delete(`/assets/values/${valueId}`);
    },
    portfolioTrend: async () => {
        const { data } = await api.get('/assets/portfolio-trend');
        return data;
    },
    marketSearch: async (q, limit = 15) => {
        const { data } = await api.get('/assets/market/search', { params: { q, limit } });
        return data;
    },
    marketQuote: async (symbol) => {
        const { data } = await api.get('/assets/market/quote', { params: { symbol } });
        return data;
    },
    refreshPrice: async (id) => {
        const { data } = await api.post(`/assets/${id}/refresh-price`);
        return data;
    },
    // Transaction ledger (issue #235)
    transactions: async (id) => {
        const { data } = await api.get(`/assets/${id}/transactions`);
        return data;
    },
    allTransactions: async (params) => {
        const { data } = await api.get('/assets/transactions', { params });
        return data;
    },
    addTransaction: async (id, tx) => {
        const { data } = await api.post(`/assets/${id}/transactions`, tx);
        return data;
    },
    updateTransaction: async (txId, tx) => {
        const { data } = await api.patch(`/assets/transactions/${txId}`, tx);
        return data;
    },
    deleteTransaction: async (txId) => {
        const { data } = await api.delete(`/assets/transactions/${txId}`);
        return data;
    },
    buy: async (tx) => {
        const { data } = await api.post('/assets/buy', tx);
        return data;
    },
    previewImport: async (file, options) => {
        const formData = new FormData();
        formData.append('file', file);
        if (options?.date_format)
            formData.append('date_format', options.date_format);
        if (options?.group_id)
            formData.append('group_id', options.group_id);
        if (options?.column_mapping && Object.keys(options.column_mapping).length > 0) {
            formData.append('column_mapping', JSON.stringify(options.column_mapping));
        }
        const { data } = await api.post('/assets/import/preview', formData);
        return data;
    },
    importOrders: async (orders, group_id, filename) => {
        const { data } = await api.post('/assets/import', { orders, group_id: group_id || null, filename });
        return data;
    },
    importTemplate: async () => {
        const { data } = await api.get('/assets/import/template', { responseType: 'blob' });
        const url = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'securo-asset-orders.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
};
// Asset Groups ("wallets")
export const assetGroups = {
    list: async () => {
        const { data } = await api.get('/asset-groups');
        return data;
    },
    create: async (group) => {
        const { data } = await api.post('/asset-groups', group);
        return data;
    },
    update: async (id, group) => {
        const { data } = await api.patch(`/asset-groups/${id}`, group);
        return data;
    },
    delete: async (id) => {
        await api.delete(`/asset-groups/${id}`);
    },
};
// Collections — user-defined account groups for filtering (issue #105)
export const collections = {
    list: async () => {
        const { data } = await api.get('/collections');
        return data;
    },
    create: async (payload) => {
        const { data } = await api.post('/collections', payload);
        return data;
    },
    update: async (id, payload) => {
        const { data } = await api.patch(`/collections/${id}`, payload);
        return data;
    },
    delete: async (id) => {
        await api.delete(`/collections/${id}`);
    },
};
// Reports
export const reports = {
    netWorth: async (months = 12, interval = 'monthly', accountIds, assetGroupIds, period, startDate, endDate) => {
        const hasFilter = (accountIds && accountIds.length > 0) || (assetGroupIds && assetGroupIds.length > 0);
        const { data } = await api.get('/reports/net-worth', {
            params: {
                months, interval, period,
                ...(startDate && endDate ? { start_date: startDate, end_date: endDate } : {}),
                ...(accountIds && accountIds.length > 0 ? { account_ids: accountIds } : {}),
                ...(assetGroupIds && assetGroupIds.length > 0 ? { asset_group_ids: assetGroupIds } : {}),
            },
            ...(hasFilter ? { paramsSerializer: { indexes: null } } : {}),
        });
        return data;
    },
    // `days` requests an exact rolling window ending today, instead of the
    // month-aligned window `months` produces. `startDate`/`endDate` (both
    // required together) pin the window to an explicit calendar range and
    // override the preset selectors on the backend.
    incomeExpenses: async (months = 12, interval = 'monthly', accountIds, period, days, startDate, endDate) => {
        const extra = acctIdsParam(accountIds);
        const { data } = await api.get('/reports/income-expenses', {
            params: {
                months, interval, period, days,
                ...(startDate && endDate ? { start_date: startDate, end_date: endDate } : {}),
                ...(extra.params ?? {}),
            },
            ...(extra.paramsSerializer ? { paramsSerializer: extra.paramsSerializer } : {}),
        });
        return data;
    },
    cashFlow: async (months = 6, interval = 'daily', baseline = false, accountIds) => {
        const extra = acctIdsParam(accountIds);
        const { data } = await api.get('/reports/cash-flow', { params: { months, interval, baseline, ...(extra.params ?? {}) }, ...(extra.paramsSerializer ? { paramsSerializer: extra.paramsSerializer } : {}) });
        return data;
    },
};
// Currencies
export const currencies = {
    list: async () => {
        const { data } = await api.get('/currencies');
        return data;
    },
};
// FX Rates
export const fxRates = {
    refresh: async () => {
        const { data } = await api.post('/fx-rates/refresh');
        return data;
    },
    status: async () => {
        const { data } = await api.get('/fx-rates/status');
        return data;
    },
};
// Import Logs
export const importLogs = {
    list: async () => {
        const { data } = await api.get('/import-logs');
        return data;
    },
    delete: async (id) => {
        await api.delete(`/import-logs/${id}`);
    },
};
// Settings
export const settings = {
    attachments: async () => {
        const { data } = await api.get('/settings/attachments');
        return data;
    },
};
// Backup
export const backup = {
    /**
     * Download the workspace archive, encrypted with AES-256 when a password is
     * given. POST rather than GET so the password stays out of browser history
     * and proxy logs.
     */
    download: async (password) => {
        const { data } = await api.post('/export/backup', password ? { password } : {}, { responseType: 'blob' });
        const blob = new Blob([data], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `securo-backup-${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
};
export const timezones = {
    list: async () => {
        const { data } = await api.get('/timezones');
        return data;
    },
};
export const admin = {
    listUsers: async (params) => {
        const { data } = await api.get('/admin/users', { params });
        return data;
    },
    getUser: async (id) => {
        const { data } = await api.get(`/admin/users/${id}`);
        return data;
    },
    createUser: async (user) => {
        const { data } = await api.post('/admin/users', user);
        return data;
    },
    updateUser: async (id, user) => {
        const { data } = await api.patch(`/admin/users/${id}`, user);
        return data;
    },
    deleteUser: async (id) => {
        await api.delete(`/admin/users/${id}`);
    },
    getSetting: async (key) => {
        const { data } = await api.get(`/admin/settings/${key}`);
        return data;
    },
    updateSetting: async (key, value) => {
        const { data } = await api.patch(`/admin/settings/${key}`, { value });
        return data;
    },
    deleteSetting: async (key) => {
        await api.delete(`/admin/settings/${key}`);
    },
    timezone: async () => {
        const { data } = await api.get('/admin/timezone');
        return data;
    },
    registrationStatus: async () => {
        const { data } = await api.get('/admin/registration-status');
        return data;
    },
    accountingMode: async () => {
        const { data } = await api.get('/admin/accounting-mode');
        return data;
    },
    numberFormat: async () => {
        const { data } = await api.get('/admin/number-format');
        return data;
    },
    dateFormat: async () => {
        const { data } = await api.get('/admin/date-format');
        return data;
    },
    defaultColors: async () => {
        const { data } = await api.get('/admin/default-colors');
        return data;
    },
};
export const search = {
    query: async (q, limit = 5) => {
        if (!q.trim())
            return [];
        const { data } = await api.get('/search', { params: { q, limit } });
        return data.results;
    },
};
export const info = {
    get: async () => {
        const { data } = await api.get('/info');
        return data;
    },
};
export const agents = {
    info: async () => {
        const { data } = await api.get('/agents/info');
        return data;
    },
    mcpTokens: {
        create: async () => {
            const { data } = await api.post('/agents/mcp-tokens');
            return data;
        },
    },
    list: async (includeArchived = false) => {
        const { data } = await api.get('/agents', { params: { include_archived: includeArchived } });
        return data;
    },
    // Default agent for the global slide-over chat panel. Returns the
    // user-flagged default; falls back to the most recent agent.
    // Throws 404 if the user has no agents at all.
    getDefault: async () => {
        const { data } = await api.get('/agents/default');
        return data;
    },
    get: async (id) => {
        const { data } = await api.get(`/agents/${id}`);
        return data;
    },
    create: async (payload) => {
        const { data } = await api.post('/agents', payload);
        return data;
    },
    update: async (id, payload) => {
        const { data } = await api.patch(`/agents/${id}`, payload);
        return data;
    },
    remove: async (id) => {
        await api.delete(`/agents/${id}`);
    },
    tools: async (id) => {
        const { data } = await api.get(`/agents/${id}/tools`);
        return data;
    },
    setTools: async (id, items) => {
        await api.put(`/agents/${id}/tools`, items);
    },
    knowledge: {
        list: async (id) => {
            const { data } = await api.get(`/agents/${id}/knowledge`);
            return data;
        },
        upload: async (id, file, pinned = false) => {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('pinned', String(pinned));
            const { data } = await api.post(`/agents/${id}/knowledge`, fd);
            return data;
        },
        pin: async (agentId, docId, pinned) => {
            const { data } = await api.patch(`/agents/${agentId}/knowledge/${docId}/pin`, null, {
                params: { pinned },
            });
            return data;
        },
        remove: async (agentId, docId) => {
            await api.delete(`/agents/${agentId}/knowledge/${docId}`);
        },
    },
    conversations: {
        list: async (agentId, limit = 50) => {
            const { data } = await api.get('/agents/conversations', { params: { agent_id: agentId, limit } });
            return data;
        },
        get: async (id) => {
            const { data } = await api.get(`/agents/conversations/${id}`);
            return data;
        },
        messages: async (id, limit = 200) => {
            const { data } = await api.get(`/agents/conversations/${id}/messages`, { params: { limit } });
            return data;
        },
        rename: async (id, title) => {
            const { data } = await api.patch(`/agents/conversations/${id}`, { title });
            return data;
        },
        generateTitle: async (id) => {
            const { data } = await api.post(`/agents/conversations/${id}/generate-title`);
            return data;
        },
        remove: async (id) => {
            await api.delete(`/agents/conversations/${id}`);
        },
    },
    // Streaming chat endpoint — caller handles the SSE response themselves
    // (see lib/agents-stream.ts). We just expose the URL + body builder.
    chatUrl: (agentId) => `/api/agents/${agentId}/chat`,
    connections: {
        list: async () => {
            const { data } = await api.get('/agents/connections');
            return data;
        },
        get: async (id) => {
            const { data } = await api.get(`/agents/connections/${id}`);
            return data;
        },
        create: async (payload) => {
            const { data } = await api.post('/agents/connections', payload);
            return data;
        },
        update: async (id, payload) => {
            const { data } = await api.patch(`/agents/connections/${id}`, payload);
            return data;
        },
        remove: async (id) => {
            await api.delete(`/agents/connections/${id}`);
        },
        test: async (id) => {
            const { data } = await api.post(`/agents/connections/${id}/test`);
            return data;
        },
    },
};
export default api;
/** Recurring invoices: an agreement that emits one invoice per period.
 *  Its own prefix, because `/invoices/{id}` would swallow `schedules`. */
export const invoiceSchedules = {
    list: async (params) => {
        const { data } = await api.get('/invoice-schedules', { params });
        return data;
    },
    summary: async () => {
        const { data } = await api.get('/invoice-schedules/summary');
        return data;
    },
    get: async (id) => {
        const { data } = await api.get(`/invoice-schedules/${id}`);
        return data;
    },
    invoices: async (id) => {
        const { data } = await api.get(`/invoice-schedules/${id}/invoices`);
        return data;
    },
    periods: async (id, ahead = 3) => {
        const { data } = await api.get(`/invoice-schedules/${id}/periods`, { params: { ahead } });
        return data;
    },
    create: async (payload) => {
        const { data } = await api.post('/invoice-schedules', payload);
        return data;
    },
    update: async (id, payload) => {
        const { data } = await api.patch(`/invoice-schedules/${id}`, payload);
        return data;
    },
    remove: async (id) => {
        await api.delete(`/invoice-schedules/${id}`);
    },
    pause: async (id) => {
        const { data } = await api.post(`/invoice-schedules/${id}/pause`);
        return data;
    },
    resume: async (id) => {
        const { data } = await api.post(`/invoice-schedules/${id}/resume`);
        return data;
    },
    end: async (id, payload) => {
        const { data } = await api.post(`/invoice-schedules/${id}/end`, payload);
        return data;
    },
    /** Emit the next period now, whether or not its date has come. */
    generate: async (id) => {
        const { data } = await api.post(`/invoice-schedules/${id}/generate`);
        return data;
    },
    addTerm: async (id, payload) => {
        const { data } = await api.post(`/invoice-schedules/${id}/terms`, payload);
        return data;
    },
    updateTerm: async (id, termId, payload) => {
        const { data } = await api.patch(`/invoice-schedules/${id}/terms/${termId}`, payload);
        return data;
    },
    removeTerm: async (id, termId) => {
        const { data } = await api.delete(`/invoice-schedules/${id}/terms/${termId}`);
        return data;
    },
    /** Say an existing invoice answers for a period of this agreement. */
    link: async (id, payload) => {
        const { data } = await api.post(`/invoice-schedules/${id}/link`, payload);
        return data;
    },
};
export const invoices = {
    facets: async (year, direction) => {
        const { data } = await api.get('/invoices/facets', {
            params: { ...(year ? { year } : {}), ...(direction ? { direction } : {}) },
        });
        return data;
    },
    list: async (params) => {
        const cleanParams = params && !('queryKey' in params) ? params : undefined;
        const { data } = await api.get('/invoices', { params: cleanParams });
        return data;
    },
    get: async (id) => {
        const { data } = await api.get(`/invoices/${id}`);
        return data;
    },
    summary: async (direction) => {
        const { data } = await api.get('/invoices/summary', {
            params: direction ? { direction } : undefined,
        });
        return data;
    },
    create: async (payload) => {
        const { data } = await api.post('/invoices', payload);
        return data;
    },
    update: async (id, payload) => {
        const { data } = await api.patch(`/invoices/${id}`, payload);
        return data;
    },
    remove: async (id) => {
        await api.delete(`/invoices/${id}`);
    },
    /** Turn this invoice into period one of a new agreement that repeats it. */
    makeRecurring: async (id, payload) => {
        const { data } = await api.post(`/invoices/${id}/make-recurring`, payload);
        return data;
    },
    /** The invoice stops answering for a period. It stays as it is. */
    unlinkSchedule: async (id) => {
        const { data } = await api.delete(`/invoices/${id}/schedule`);
        return data;
    },
    // The decisions. Each is its own call for the same reason it is its own
    // route on the server: a status change always has a cause.
    issue: async (id) => {
        const { data } = await api.post(`/invoices/${id}/issue`);
        return data;
    },
    void: async (id) => {
        const { data } = await api.post(`/invoices/${id}/void`);
        return data;
    },
    writeOff: async (id) => {
        const { data } = await api.post(`/invoices/${id}/uncollectible`);
        return data;
    },
    reopen: async (id) => {
        const { data } = await api.post(`/invoices/${id}/reopen`);
        return data;
    },
    allocate: async (id, transactionId, amount) => {
        const { data } = await api.post(`/invoices/${id}/allocations`, {
            transaction_id: transactionId,
            ...(amount ? { amount } : {}),
        });
        return data;
    },
    /** Close part of the debt without money: tax withheld, a fee kept. */
    deduct: async (id, payload) => {
        const { data } = await api.post(`/invoices/${id}/deductions`, payload);
        return data;
    },
    undeduct: async (id, deductionId) => {
        const { data } = await api.delete(`/invoices/${id}/deductions/${deductionId}`);
        return data;
    },
    unallocate: async (id, allocationId) => {
        const { data } = await api.delete(`/invoices/${id}/allocations/${allocationId}`);
        return data;
    },
    settings: async () => {
        const { data } = await api.get('/invoices/settings');
        return data;
    },
    updateSettings: async (payload) => {
        const { data } = await api.patch('/invoices/settings', payload);
        return data;
    },
    issuer: async () => {
        const { data } = await api.get('/invoices/issuer');
        return data;
    },
    updateIssuer: async (payload) => {
        const { data } = await api.patch('/invoices/issuer', payload);
        return data;
    },
    document: async (id) => {
        const { data } = await api.get(`/invoices/${id}/document`);
        return data;
    },
    /** Fetched as a blob rather than linked directly: the PDF route needs
     *  the Authorization header and the workspace header the interceptor
     *  adds, which a plain <a href> would not carry. */
    pdf: async (id) => {
        const { data } = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
        return data;
    },
    /** The statement of account: payments and deductions since issue. */
    statement: async (id) => {
        const { data } = await api.get(`/invoices/${id}/statement`, { responseType: 'blob' });
        return data;
    },
    share: async (id) => {
        const { data } = await api.post(`/invoices/${id}/share`);
        return data;
    },
    unshare: async (id) => {
        await api.delete(`/invoices/${id}/share`);
    },
    /** The workspace's mark. Uploaded rather than linked, so a rendered
     *  document never fetches an image from somebody else's host. */
    uploadLogo: async (file) => {
        const form = new FormData();
        form.append('file', file);
        const { data } = await api.post('/invoices/settings/logo', form);
        return data;
    },
    removeLogo: async () => {
        const { data } = await api.delete('/invoices/settings/logo');
        return data;
    },
    /** By id, not "the current one": a document issued under an older mark
     *  froze that id, and asking for the current logo would repaint it. */
    logoUrl: async (logoId) => {
        const { data } = await api.get(`/invoices/logo/${logoId}`, { responseType: 'blob' });
        return URL.createObjectURL(data);
    },
    /** The paper gathered under an invoice: the bill, the fiscal document,
     *  a receipt, the contract behind it. */
    attachments: {
        list: async (invoiceId) => {
            const { data } = await api.get(`/invoices/${invoiceId}/attachments`);
            return data;
        },
        upload: async (invoiceId, file, fields = {}) => {
            const form = new FormData();
            form.append('file', file);
            Object.entries(fields).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '')
                    form.append(key, String(value));
            });
            const { data } = await api.post(`/invoices/${invoiceId}/attachments`, form);
            return data;
        },
        /** Same reason as `pdf` above: the route needs headers a plain
         *  <a href> would not carry, so the bytes come back as a blob. */
        blobUrl: async (invoiceId, attachmentId) => {
            const { data } = await api.get(`/invoices/${invoiceId}/attachments/${attachmentId}`, {
                responseType: 'blob',
            });
            return URL.createObjectURL(data);
        },
        update: async (invoiceId, attachmentId, payload) => {
            const { data } = await api.patch(`/invoices/${invoiceId}/attachments/${attachmentId}`, payload);
            return data;
        },
        remove: async (invoiceId, attachmentId) => {
            await api.delete(`/invoices/${invoiceId}/attachments/${attachmentId}`);
        },
    },
};
/** The shared invoice. Unauthenticated by design — the token is the whole
 *  credential — so these bypass the api instance and its interceptors. */
export const publicInvoices = {
    get: async (token) => {
        // Bare axios, not the shared instance: the interceptors would attach
        // an Authorization header and a workspace id, and this route must
        // work for someone who has neither.
        const { data } = await axios.get(`/api/public/invoices/${token}`);
        return data;
    },
    pdfUrl: (token) => `/api/public/invoices/${token}/pdf`,
};
