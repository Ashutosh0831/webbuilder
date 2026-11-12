import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "@/server/storage/s3";
import { generateStorageKey } from "@/server/storage/keys";
import { requireAuth, requireWebsitePermission } from "@/server/authz";
import { z } from "zod";

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "image/svg+xml",
  "application/pdf", "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const initSchema = z.object({
  websiteId: z.string().uuid(),
  filename: z.string().max(255),
  contentType: z.string(),
  size: z.number().int().positive().max(20 * 1024 * 1024), // 20 MB cap
});

export async function POST(req: Request) {
  const user = await requireAuth();
  const parsed = initSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { websiteId, filename, contentType, size } = parsed.data;

  // Server-side permission — never trust the client
  await requireWebsitePermission(user.id, websiteId, { resource: "media", action: "upload" }, user.role ?? "editor");

  // Reject declared MIME types that aren't allowed
  if (!ALLOWED_MIME.has(contentType)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
  }

  // Presign with the declared type; actual type is verified after upload
  const tempExt = filename.split(".").pop()?.toLowerCase() ?? "bin";
  const key = generateStorageKey(websiteId, tempExt);

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
    // Prevent the file from being served with an executable content type
    ContentDisposition: "attachment",
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  return NextResponse.json({ uploadUrl, key });
}