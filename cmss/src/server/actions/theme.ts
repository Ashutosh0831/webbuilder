"use server";

import { requireAuth, requireWebsitePermission } from "@/server/authz";
import { prisma } from "@/server/db/prisma";
import { themeTokensSchema } from "@/lib/validations/themes";
import { revalidatePath } from "next/cache";

export async function createThemeAction(websiteId: string, name: string, tokens: unknown) {
  const user = await requireAuth();
  
  // Make sure they have permission to edit this website
  await requireWebsitePermission(user.id, websiteId, { resource: "website", action: "update" }, user.role ?? "editor");

  // Validate the JSON
  const parsed = themeTokensSchema.safeParse(tokens);
  if (!parsed.success) {
    return { error: "Invalid theme data: " + parsed.error.issues[0].message };
  }

  try {
    // 1. Create the theme
    const theme = await prisma.theme.create({
      data: { name, tokens: parsed.data },
    });

    // 2. Set it as active for this website
    await prisma.websiteTheme.updateMany({
      where: { websiteId },
      data: { isActive: false },
    });
    
    await prisma.websiteTheme.create({
      data: { websiteId, themeId: theme.id, isActive: true },
    });

    revalidatePath("/dashboard/themes");
    return { success: true };
  } catch (e) {
    return { error: "Failed to save theme." };
  }
}