import { Image } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/server/db/prisma";
import { requireAuth } from "@/server/authz";

export const instant = false;

function formatBytes(bytes: bigint) {
  if (bytes < BigInt(1024)) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = Number(bytes);
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export default async function MediaPage() {
  const user = await requireAuth();
  const files = await prisma.media.findMany({
    where: {
      deletedAt: null,
      website: {
        deletedAt: null,
        ...(user.role === "super_admin" ? {} : { members: { some: { userId: user.id } } }),
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { website: { select: { id: true, name: true } } },
  });

  if (files.length === 0) {
    return (
      <EmptyState
        icon={Image}
        title="No media files yet"
        description="Media uploaded to your websites will appear here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Media library</h1>
        <p className="text-muted-foreground">Files stored across your websites.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent files ({files.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {files.map((file) => (
              <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{file.filename}</p>
                  <p className="text-sm text-muted-foreground">
                    {file.website.name} · {file.mimeType} · {formatBytes(file.size)}
                  </p>
                  {file.altText && <p className="mt-1 text-xs text-muted-foreground">Alt: {file.altText}</p>}
                </div>
                <time className="text-xs text-muted-foreground" dateTime={file.createdAt.toISOString()}>
                  {file.createdAt.toLocaleDateString()}
                </time>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">Showing up to 100 most recent files.</p>
        </CardContent>
      </Card>
    </div>
  );
}
