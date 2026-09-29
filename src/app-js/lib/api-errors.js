export function extractApiError(error, fallback = 'An unexpected error occurred') {
    if (error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'data' in error.response) {
        const data = error.response.data;
        if (data && typeof data === 'object' && 'detail' in data) {
            const detail = data.detail;
            if (typeof detail === 'string')
                return detail;
            // `{ code, message }`, the shape every hand-raised error in the API
            // uses. Without this branch a precise message ("Similarity runs from
            // 0 to 1") was thrown away and the caller showed its generic
            // fallback instead.
            if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
                const message = detail.message;
                if (typeof message === 'string' && message.trim())
                    return message;
            }
            if (Array.isArray(detail)) {
                const message = detail.map((d) => {
                    const field = d.loc?.slice(-1)[0] ?? '';
                    return `${field}: ${d.msg ?? 'invalid'}`;
                }).join(', ');
                if (message.trim())
                    return message;
            }
        }
    }
    return fallback;
}
