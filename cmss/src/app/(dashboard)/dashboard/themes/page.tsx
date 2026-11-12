import { Palette } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/server/db/prisma";
import { requireAuth } from "@/server/authz";

export const instant = false;

export default async function ThemesPage() {
  const user = await requireAuth();
  const themes = await prisma.theme.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    take: 100,
    include: {
      websiteThemes: {
        where: {
          website: {
            deletedAt: null,
            ...(user.role === "super_admin" ? {} : { members: { some: { userId: user.id } } }),
          },
        },
        include: { website: { select: { id: true, name: true } } },
      },
    },
  });

  if (themes.length === 0) {
    return (
      <EmptyState
        icon={Palette}
        title="No themes available"
        description="Themes will appear here when they are added to the platform."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Themes</h1>
        <p className="text-muted-foreground">Theme catalog and assignments for your websites.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {themes.map((theme) => (
          <Card key={theme.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>{theme.name}</span>
                {theme.isDefault && <span className="text-xs font-normal text-muted-foreground">Default</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {theme.websiteThemes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not assigned to your websites.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {theme.websiteThemes.map((assignment) => (
                    <li key={assignment.id} className="flex items-center justify-between gap-2">
                      <span>{assignment.website.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {assignment.isActive ? "Active" : "Available"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
