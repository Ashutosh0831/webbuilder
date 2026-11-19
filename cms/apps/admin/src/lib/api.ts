let accessToken: string | null = null;
const LEGACY_TOKEN_KEYS = ["cms_admin_token", "cms_admin_refresh_token"];

try {
  for (const key of LEGACY_TOKEN_KEYS) localStorage.removeItem(key);
} catch {
  // Storage may be disabled; browser auth no longer depends on it.
}

export function getToken(): string | null {
  return accessToken;
}

export function setToken(token: string): void {
  accessToken = token;
}

export function clearToken(): void {
  accessToken = null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch("/api/admin/auth/refresh", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: "{}",
          credentials: "include",
        });

        if (!response.ok) {
          clearToken();
          return null;
        }

        const data: { accessToken: string } = await response.json();

        if (!data.accessToken) {
          clearToken();
          return null;
        }

        setToken(data.accessToken);
        return data.accessToken;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

async function sendRequest(
  path: string,
  options: RequestInit,
  token: string | null
): Promise<Response> {
  const headers = new Headers(options.headers);

  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else {
    headers.delete("Authorization");
  }

  return fetch(path, {
    ...options,
    credentials: "include",
    headers,
  });
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let token = getToken();

  let response = await sendRequest(path, options, token);

  const isAuthEndpoint =
    path.includes("/api/admin/auth/login") ||
    path.includes("/api/admin/auth/register") ||
    path.includes("/api/admin/auth/refresh");

  if (response.status === 401 && !isAuthEndpoint) {
    const newToken = await refreshAccessToken();

    if (newToken) {
      token = newToken;
      response = await sendRequest(path, options, token);
    } else {
      clearToken();
    }
  }

  if (!response.ok) {
    let body: any = {};

    try {
      body = await response.json();
    } catch {
      // Response was not JSON.
    }

    const error = body?.error ?? {};

    throw new ApiError(
      response.status,
      error.code ?? "ERROR",
      error.message ?? response.statusText,
      error.details
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
