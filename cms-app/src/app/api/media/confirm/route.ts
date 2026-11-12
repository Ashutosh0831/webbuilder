import { NextResponse } from "next/server";
import { GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { fileTypeFromBuffer } from "file-type";
import { s3 } from "@/server/storage/s3";
import { prisma } from "@/server/db/prisma";
import { requireAuth, requireWebsitePermission } from "@/server/authz";
import { z } from "zod";

const confirmSchema = z.object({
  websiteId: z.string().uuid(),
  key: z.string(),
  filename: z.string(),
  declaredType: z.string(),
  size: z.number().int().positive(),
});

const ALLOWED_DETECTED = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/avif",
  "application/pdf", "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export async function POST(req: Request) {
  const user = await requireAuth();
  const parsed = confirmSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { websiteId, key, filename, declaredType, size } = parsed.data;
  await requireWebsitePermission(user.id, websiteId, { resource: "media", action: "upload" }, user.role ?? "editor");

  // Verify the object exists and the key belongs to this website prefix
  if (!key.startsWith(`media/${websiteId}/`)) {
    return NextResponse.json({ error: "Key does not belong to this website" }, { status: 403 });
  }

  const head = await s3.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }));
  if (head.ContentLength !== size) {
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }));
    return NextResponse.json({ error: "Size mismatch" }, { status: 400 });
  }

  // Download first 4 KB for magic-byte detection
  const obj = await s3.send(new GetObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    Range: "bytes=0-4095",
  }));
  const chunks: Uint8Array[] = [];
  for await (const chunk of obj.Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_DETECTED.has(detected.mime)) {
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }));
    return NextResponse.json({ error: "File content does not match an allowed type" }, { status: 400 });
  }

  // If the declared type doesn't match the detected type, reject
  if (declaredType !== detected.mime && detected.mime !== "application/octet-stream") {
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }));
    return NextResponse.json({ error: "Declared type does not match actual content" }, { status: 400 });
  }

  const media = await prisma.media.create({
    data: {
      websiteId,
      filename,
      mimeType: detected.mime,
      size: BigInt(size),
      url: process.env.S3_PUBLIC_URL
        ? `${process.env.S3_PUBLIC_URL}/${key}`
        : `/api/media/download?key=${encodeURIComponent(key)}`,
    },
  });

  return NextResponse.json({ media });
}