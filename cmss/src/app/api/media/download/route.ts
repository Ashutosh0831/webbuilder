import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/server/db/prisma";
import { s3 } from "@/server/storage/s3";
import { requireWebsitePermission } from "@/server/authz";

/**
 * Streams a stored media object. Authenticated CMS users need media read access;
 * anonymous visitors may fetch assets only for an active website that has a
 * published page. The database URL lookup prevents arbitrary bucket-key reads.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const key = requestUrl.searchParams.get("key");
  if (!key || !key.startsWith("media/") || key.includes("..")) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const storedUrl = `/api/media/download?key=${encodeURIComponent(key)}`;
  const media = await prisma.media.findFirst({
    where: { url: storedUrl, deletedAt: null },
    select: { id: true, websiteId: true, filename: true, mimeType: true },
  });
  if (!media || !key.startsWith(`media/${media.websiteId}/`)) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  let isPublicAsset = false;
  if (session) {
    await requireWebsitePermission(
      session.user.id,
      media.websiteId,
      { resource: "media", action: "read" },
      session.user.role ?? "editor",
    );
  } else {
    const publicWebsite = await prisma.website.findFirst({
      where: {
        id: media.websiteId,
        status: "ACTIVE",
        deletedAt: null,
        customer: { status: "ACTIVE", deletedAt: null },
        pages: {
          some: {
            status: "PUBLISHED",
            deletedAt: null,
            publishedVersionId: { not: null },
          },
        },
      },
      select: { id: true },
    });
    if (!publicWebsite) return NextResponse.json({ error: "Media not found" }, { status: 404 });
    isPublicAsset = true;
  }

  const object = await s3.send(new GetObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
  }));
  if (!object.Body) return NextResponse.json({ error: "Media not found" }, { status: 404 });

  const safeFilename = media.filename.replace(/[\r\n"\\]/g, "_");
  const asciiFilename = safeFilename.replace(/[^\x20-\x7E]/g, "_");
  const isImage = media.mimeType.startsWith("image/");
  const responseHeaders = new Headers({
    "Content-Type": media.mimeType,
    "Content-Disposition": `${isImage ? "inline" : "attachment"}; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`,
    "Cache-Control": isPublicAsset ? "public, max-age=3600, stale-while-revalidate=86400" : "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (object.ContentLength !== undefined) {
    responseHeaders.set("Content-Length", String(object.ContentLength));
  }

  return new NextResponse(object.Body.transformToWebStream(), { headers: responseHeaders });
}
