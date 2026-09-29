import { jsx as _jsx } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { auth } from '../lib/api.js';
import { AuthContext } from './auth-context.js';
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => localStorage.getItem('token'));
    const [isLoading, setIsLoading] = useState(true);
    const queryClient = useQueryClient();
    if (!token && (user !== null || isLoading)) {
        setUser(null);
        setIsLoading(false);
    }
    useEffect(() => {
        if (!token)
            return;
        let cancelled = false;
        auth.me()
            .then((me) => { if (!cancelled)
            setUser(me); })
            .catch(() => {
            if (cancelled)
                return;
            localStorage.removeItem('token');
            setToken(null);
        })
            .finally(() => { if (!cancelled)
            setIsLoading(false); });
        return () => { cancelled = true; };
    }, [token]);
    // Sync token across tabs via storage events
    useEffect(() => {
        const handleStorage = (e) => {
            if (e.key === 'token') {
                setToken(e.newValue);
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);
    const login = useCallback(async (email, password) => {
        const data = await auth.login(email, password);
        if (data.requires_2fa) {
            return { requires_2fa: true, temp_token: data.temp_token, available_methods: data.available_methods };
        }
        const accessToken = data.access_token;
        localStorage.setItem('token', accessToken);
        setToken(accessToken);
        const me = await auth.me();
        setUser(me);
        return { requires_2fa: false };
    }, []);
    const verify2fa = useCallback(async (tempToken, code) => {
        const data = await auth.verify2fa(tempToken, code);
        localStorage.setItem('token', data.access_token);
        setToken(data.access_token);
        const me = await auth.me();
        setUser(me);
    }, []);
    const loginWithToken = useCallback((accessToken) => {
        localStorage.setItem('token', accessToken);
        setToken(accessToken);
        auth.me().then(setUser).catch(() => { });
    }, []);
    const updateUser = useCallback((updatedUser) => {
        setUser(updatedUser);
    }, []);
    const register = useCallback(async (email, password, preferences) => {
        await auth.register(email, password, preferences);
        await login(email, password);
    }, [login]);
    const logout = useCallback(() => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        queryClient.clear();
    }, [queryClient]);
    return (_jsx(AuthContext.Provider, { value: { user, token, isLoading, login, verify2fa, loginWithToken, register, updateUser, logout }, children: children }));
}
