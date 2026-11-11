"use server";

import { createTheme as createThemeService } from "@/server/services/theme";

export async function createThemeAction(
  websiteId: string,
  name: string,
  tokens: unknown,
) {
  await createThemeService(websiteId, name, tokens);
  return { success: true };
}
