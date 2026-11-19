export interface DetectedImageSignature {
  mime: "image/png" | "image/jpeg" | "image/gif" | "image/webp" | "image/avif";
  ext: ".png" | ".jpg" | ".gif" | ".webp" | ".avif";
  width?: number;
  height?: number;
}

/**
 * Validate uploaded image buffers by inspecting actual file signature (magic bytes)
 * rather than trusting client-supplied MIME types or extensions.
 * Explicitly blocks SVG/HTML/script payloads to prevent stored XSS.
 */
export function validateImageSignature(buffer: Buffer): DetectedImageSignature | null {
  if (buffer.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    const width = buffer.length >= 24 ? buffer.readUInt32BE(16) : undefined;
    const height = buffer.length >= 24 ? buffer.readUInt32BE(20) : undefined;
    return { mime: "image/png", ext: ".png", width, height };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    const dims = parseJpegDimensions(buffer);
    return { mime: "image/jpeg", ext: ".jpg", ...dims };
  }

  // GIF: GIF87a or GIF89a
  const header6 = buffer.subarray(0, 6).toString("ascii");
  if (header6 === "GIF87a" || header6 === "GIF89a") {
    const width = buffer.readUInt16LE(6);
    const height = buffer.readUInt16LE(8);
    return { mime: "image/gif", ext: ".gif", width, height };
  }

  // WebP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { mime: "image/webp", ext: ".webp" };
  }

  // AVIF: ....ftypavif or ....ftypavis
  const ftyp = buffer.subarray(4, 12).toString("ascii");
  if (ftyp === "ftypavif" || ftyp === "ftypavis") {
    return { mime: "image/avif", ext: ".avif" };
  }

  return null;
}

function parseJpegDimensions(buffer: Buffer): { width?: number; height?: number } {
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    // SOF0..SOF3 markers contain image dimensions
    if (marker >= 0xc0 && marker <= 0xc3) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return { width, height };
    }
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const segLen = buffer.readUInt16BE(offset + 2);
    if (segLen < 2) break;
    offset += 2 + segLen;
  }
  return {};
}
