import { apiFetch, storeToken } from "./client";

interface TokenResponse {
    access_token: string;
    token_type: string;
}

interface RegisterResponse {
    id: number;
    email: string;
}

/**
 * Registers a new user and returns the created user object.
 * Does NOT log the user in (no token returned from /auth/register).
 */
export async function registerUser(
    email: string,
    password: string
): Promise<RegisterResponse> {
    return apiFetch<RegisterResponse>("/auth/register", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ email, password }),
    });
}

/**
 * Logs in and stores the returned JWT.
 * Returns the access token string.
 */
export async function loginUser(
    email: string,
    password: string
): Promise<string> {
    const data = await apiFetch<TokenResponse>("/auth/login", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ email, password }),
    });
    storeToken(data.access_token);
    return data.access_token;
}
