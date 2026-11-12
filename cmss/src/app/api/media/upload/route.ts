import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "@/server/storage/s3";
import { generateStorageKey } from "@/server/storage/keys";
import { requireAuth, requireWebsitePermission } from "@/server/authz";
import { z } from "zod";

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/avif",
  "application/pdf",
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

  const { websiteId, contentType, size } = parsed.data;

  // Server-side permission — never trust the client
  await requireWebsitePermission(user.id, websiteId, { resource: "media", action: "upload" }, user.role ?? "editor");

  // Reject declared MIME types that aren't allowed
  if (!ALLOWED_MIME.has(contentType)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
  }

  // Derive the storage extension from the declared MIME type, not the user
  // supplied filename. The actual file signature is verified on confirmation.
  const extensionByMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/avif": "avif",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  };
  const extension = extensionByMime[contentType];
  if (!extension) {
    return NextResponse.json({ error: "File type not supported" }, { status: 400 });
  }
  const key = generateStorageKey(websiteId, extension);

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
    // Images must be displayable by the visual builder; documents download as attachments.
    ContentDisposition: contentType.startsWith("image/") ? "inline" : "attachment",
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  return NextResponse.json({ uploadUrl, key });
}