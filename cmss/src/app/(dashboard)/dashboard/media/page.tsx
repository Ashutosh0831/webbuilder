import { Image } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { MediaLibrary } from "@/features/media/media-library";
import { prisma } from "@/server/db/prisma";
import { requireAuth } from "@/server/authz";

export const instant = false;

export default async function MediaPage() {
  const user = await requireAuth();
  const websites = await prisma.website.findMany({
    where: {
      deletedAt: null,
      ...(user.role === "super_admin" ? {} : { members: { some: { userId: user.id } } }),
    },
    orderBy: { name: "asc" },
    include: { media: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 100 } },
  });

  if (websites.length === 0) {
    return <EmptyState icon={Image} title="No websites available" description="A website must be assigned to your account before you can upload media." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Media library</h1>
        <p className="text-muted-foreground">Upload images and documents, then copy an image URL into the visual builder.</p>
      </div>
      {websites.map((website) => (
        <Card key={website.id}>
          <CardHeader><CardTitle>{website.name}</CardTitle></CardHeader>
          <CardContent>
            <MediaLibrary
              websiteId={website.id}
              initial={website.media.map((file) => ({
                id: file.id,
                filename: file.filename,
                mimeType: file.mimeType,
                size: Number(file.size),
                url: file.url,
              }))}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
