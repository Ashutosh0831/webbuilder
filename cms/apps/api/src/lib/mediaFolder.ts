export class InvalidMediaFolderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMediaFolderError";
  }
}

export function normalizeMediaFolder(raw: string): string {
  const segments = raw.replace(/\\/g, "/").split("/").map((part) => part.trim()).filter(Boolean);
  if (segments.some((part) => part === "." || part === ".." || /[\u0000-\u001f\u007f]/.test(part) || part.length > 80)) {
    throw new InvalidMediaFolderError("Folder names cannot contain traversal or control characters and each segment must be 80 characters or fewer");
  }
  const folder = segments.join("/");
  if (folder.length > 255) throw new InvalidMediaFolderError("Folder path must be 255 characters or fewer");
  return folder;
}
