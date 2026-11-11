import { requireAuth, requireWebsitePermission } from "@/server/authz";
import { prisma } from "@/server/db/prisma";
import { themeTokensSchema } from "@/lib/validations/themes";

export async function createTheme(websiteId: string, name: string, tokens: unknown) {
  const user = await requireAuth();
  await requireWebsitePermission(user.id, websiteId, { resource: "website", action: "update" }, user.role ?? "editor");

  const parsed = themeTokensSchema.safeParse(tokens);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  // Create the theme row
  const theme = await prisma.theme.create({
    data: { name, tokens: parsed.data },
  });

  // Deactivate current active theme, activate new one
  await prisma.websiteTheme.updateMany({
    where: { websiteId },
    data: { isActive: false },
  });
  await prisma.websiteTheme.create({
    data: { websiteId, themeId: theme.id, isActive: true },
  });

  return theme;
}

export async function updateTheme(themeId: string, websiteId: string, tokens: unknown) {
  const user = await requireAuth();
  await requireWebsitePermission(user.id, websiteId, { resource: "website", action: "update" }, user.role ?? "editor");

  const parsed = themeTokensSchema.safeParse(tokens);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  return prisma.theme.update({
    where: { id: themeId },
    data: { tokens: parsed.data },
  });
}

export async function getActiveTheme(websiteId: string) {
  const link = await prisma.websiteTheme.findFirst({
    where: { websiteId, isActive: true },
    include: { theme: true },
  });
  if (!link) return null;
  const parsed = themeTokensSchema.safeParse(link.theme.tokens);
  return parsed.success ? { ...link.theme, tokens: parsed.data } : null;
}