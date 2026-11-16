import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";

const endpoint = process.env.S3_ENDPOINT!;
const accessKeyId = process.env.S3_ACCESS_KEY!;
const secretAccessKey = process.env.S3_SECRET_KEY!;
const bucket = process.env.S3_BUCKET!;
const region = process.env.S3_REGION ?? "us-east-1";

if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
  throw new Error(
    "S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET must be set"
  );
}

export const s3 = new S3Client({
  endpoint,
  region,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true, // required for MinIO / Silo
});

export async function ensureBucket(): Promise<void> {
  const { CreateBucketCommand, HeadBucketCommand } = await import(
    "@aws-sdk/client-s3"
  );
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

export function buildStorageKey(
  siteId: string,
  originalName: string
): string {
  const ext = originalName.includes(".")
    ? "." + originalName.split(".").pop()!.toLowerCase()
    : "";
  const hash = crypto.randomBytes(12).toString("hex");
  return `${siteId}/${hash}${ext}`;
}

export function publicUrlForKey(key: string): string {
  return `${endpoint}/${bucket}/${key}`;
}

export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function getPresignedGetUrl(key: string, expiresIn = 3600) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn }
  );
}