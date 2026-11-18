
const TOKEN_KEY = "cms_admin_token";
const REFRESH_TOKEN_KEY = "cms_admin_refresh_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    clearToken();
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch("/api/admin/auth/refresh", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken }),
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

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else {
    headers.delete("Authorization");
  }

  return fetch(path, {
    ...options,
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
      error.message ?? response.statusText
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
