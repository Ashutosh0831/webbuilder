import { randomUUID } from "crypto";

const SAFE_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "avif",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt",
]);

export function generateStorageKey(websiteId: string, detectedExt: string): string {
  if (!SAFE_EXTENSIONS.has(detectedExt)) {
    throw new Error(`Unsupported file extension: ${detectedExt}`);
  }
  return `media/${websiteId}/${randomUUID()}.${detectedExt}`;
}