import { useQuery } from '@tanstack/react-query';
import { useAutoUpdateCheck } from './use-auto-update-check.js';
const LATEST_RELEASE_URL = 'https://api.github.com/repos/securo-finance/securo/releases/latest';
const SIX_HOURS = 1000 * 60 * 60 * 6;
async function fetchLatestRelease() {
    const response = await fetch(LATEST_RELEASE_URL, {
        headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok)
        return null;
    const payload = (await response.json());
    if (!payload.tag_name || !payload.html_url)
        return null;
    return { tagName: payload.tag_name, htmlUrl: payload.html_url };
}
export function useLatestRelease() {
    const { enabled } = useAutoUpdateCheck();
    return useQuery({
        queryKey: ['latest-release', 'securo-finance/securo'],
        queryFn: fetchLatestRelease,
        enabled,
        staleTime: SIX_HOURS,
        gcTime: SIX_HOURS,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });
}
