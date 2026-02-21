/** Base fetch wrapper that attaches the stored JWT and throws on HTTP errors. */
const BASE_URL = "";

export function getToken(): string | null {
    return localStorage.getItem("pg_token");
}

interface FetchOptions extends RequestInit {
    skipAuth?: boolean;
}

export async function apiFetch<T>(
    path: string,
    options: FetchOptions = {}
): Promise<T> {
    const { skipAuth = false, headers = {}, ...rest } = options;

    const authHeaders: Record<string, string> = {};
    if (!skipAuth) {
        const token = getToken();
        if (token) {
            authHeaders["Authorization"] = `Bearer ${token}`;
        }
    }

    const response = await fetch(`${BASE_URL}${path}`, {
        ...rest,
        headers: {
            "Content-Type": "application/json",
            ...authHeaders,
            ...(headers as Record<string, string>),
        },
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(errorBody.detail ?? `HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
}

/** Stores the JWT returned after login/register. */
export function storeToken(token: string): void {
    localStorage.setItem("pg_token", token);
}

/** Clears the stored JWT. */
export function clearToken(): void {
    localStorage.removeItem("pg_token");
}
