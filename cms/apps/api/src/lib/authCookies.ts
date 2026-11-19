export const REFRESH_COOKIE_NAME = "cms_admin_refresh";

function normalizeSameSite(value: string): "lax" | "strict" | "none" {
  const sameSite = value.toLowerCase();
  if (sameSite === "lax" || sameSite === "strict" || sameSite === "none") return sameSite;
  throw new Error("AUTH_COOKIE_SAME_SITE must be lax, strict, or none");
}

export function readCookieHeader(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0 || pair.slice(0, separator).trim() !== name) continue;
    try { return decodeURIComponent(pair.slice(separator + 1).trim()); } catch { return null; }
  }
  return null;
}

export function isAllowedCookieOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
  return !origin || allowedOrigins.includes(origin);
}

export function serializeRefreshCookie(
  value: string,
  maxAgeMs: number,
  options: { sameSite?: string; production?: boolean } = {},
): string {
  const sameSite = normalizeSameSite(options.sameSite ?? process.env.AUTH_COOKIE_SAME_SITE ?? "lax");
  const secure = Boolean(options.production ?? (process.env.NODE_ENV === "production")) || sameSite === "none";
  const parts = [
    `${REFRESH_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/api/admin/auth",
    "HttpOnly",
    `SameSite=${sameSite}`,
    `Max-Age=${Math.max(0, Math.floor(maxAgeMs / 1000))}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearRefreshCookie(options: { sameSite?: string; production?: boolean } = {}): string {
  const sameSite = normalizeSameSite(options.sameSite ?? process.env.AUTH_COOKIE_SAME_SITE ?? "lax");
  const secure = Boolean(options.production ?? (process.env.NODE_ENV === "production")) || sameSite === "none";
  return [
    `${REFRESH_COOKIE_NAME}=`,
    "Path=/api/admin/auth",
    "HttpOnly",
    `SameSite=${sameSite}`,
    "Max-Age=0",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}
