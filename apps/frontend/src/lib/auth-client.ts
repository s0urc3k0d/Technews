// ===========================================
// Auth client helpers (Auth0 access token)
// ===========================================

let cachedToken: string | null = null;
let cachedAt = 0;
const TOKEN_TTL_MS = 55 * 1000;
const ACCESS_TOKEN_ENDPOINTS = ['/api/auth/access-token', '/api/auth/token', '/auth/access-token'];

interface AccessTokenResponse {
  accessToken?: string;
}

export async function getAccessTokenClient(force = false): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const now = Date.now();
  if (!force && cachedToken && now - cachedAt < TOKEN_TTL_MS) {
    return cachedToken;
  }

  if (!force && cachedToken === null && now - cachedAt < TOKEN_TTL_MS) {
    return null;
  }

  try {
    for (const endpoint of ACCESS_TOKEN_ENDPOINTS) {
      const response = await fetch(endpoint, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        if (response.status === 404) {
          continue;
        }

        cachedToken = null;
        cachedAt = now;
        return null;
      }

      const data = (await response.json()) as AccessTokenResponse;
      const token = data.accessToken ?? null;

      cachedToken = token;
      cachedAt = now;

      return token;
    }

    cachedToken = null;
    cachedAt = now;
    return null;
  } catch {
    cachedToken = null;
    cachedAt = now;
    return null;
  }
}

export async function buildAuthHeaders(extra?: HeadersInit): Promise<HeadersInit> {
  const token = await getAccessTokenClient();

  const headers: HeadersInit = {
    ...extra,
  };

  if (token) {
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }

  return headers;
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = await buildAuthHeaders(init.headers);

  return fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });
}
