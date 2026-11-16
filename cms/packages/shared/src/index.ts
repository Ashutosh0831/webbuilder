export const CONTENT_STATUSES = [
  "draft",
  "review",
  "scheduled",
  "published",
  "archived",
] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const API_KEY_TYPES = ["read", "write", "preview"] as const;
export type ApiKeyType = (typeof API_KEY_TYPES)[number];

export const SITE_ROLES = ["client_admin", "editor", "viewer"] as const;
export type SiteRole = (typeof SITE_ROLES)[number];

export const PLATFORM_ROLES = ["super_admin"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];