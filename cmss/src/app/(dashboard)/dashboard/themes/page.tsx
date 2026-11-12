import { Suspense } from "react";
import { requireAuth } from "@/server/authz";
import { prisma } from "@/server/db/prisma";
import { ThemeEditor } from "@/features/themes/theme-editor";
import { defaultTokens } from "@/features/themes/default-tokens";
import { notFound } from "next/navigation";

export default function ThemesPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading theme...</div>}>
      <ThemeLoader />
    </Suspense>
  );
}

async function ThemeLoader() {
  const user = await requireAuth();
  
  // Get the first website belonging to this user (or all, if super admin)
  const website = await prisma.website.findFirst({
    where: user.role === "super_admin" ? {} : { customer: { users: { some: { id: user.id } } } },
    include: {
      themes: { where: { isActive: true }, include: { theme: true } },
    },
  });

  if (!website) {
    return <div className="p-8">Create a website first to edit its theme.</div>;
  }

  const activeTheme = website.themes[0]?.theme;
  // Fallback to default tokens if the DB is empty
  const tokens = (activeTheme?.tokens as any) || defaultTokens;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Theme Editor</h1>
        <p className="text-muted-foreground">Editing theme for {website.name}</p>
      </div>
      <ThemeEditor websiteId={website.id} initial={tokens} />
    </div>
  );
}