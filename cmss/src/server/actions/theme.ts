"use server";

import { createTheme as createThemeService } from "@/server/services/theme";

export async function createThemeAction(
  websiteId: string,
  name: string,
  tokens: unknown,
  expectedVersion?: number,
) {
  const theme = await createThemeService(websiteId, name, tokens, expectedVersion);
  return { success: true, version: theme.version };
}
