"use client";

import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MediaItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

export function MediaLibrary({ websiteId, initial }: { websiteId: string; initial: MediaItem[] }) {
  const [items, setItems] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      // 1. Initialize: get presigned URL
      const initRes = await fetch("/api/media/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
      if (!initRes.ok) throw new Error((await initRes.json()).error);
      const { uploadUrl, key } = await initRes.json();

      // 2. Upload directly to S3 (with progress via XHR if desired)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.setRequestHeader("Content-Disposition", file.type.startsWith("image/") ? "inline" : "attachment");
        xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error("Upload failed")));
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(file);
      });

      // 3. Confirm: server verifies magic bytes and writes DB row
      const confirmRes = await fetch("/api/media/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          key,
          filename: file.name,
          declaredType: file.type,
          size: file.size,
        }),
      });
      if (!confirmRes.ok) throw new Error((await confirmRes.json()).error);
      const { media } = await confirmRes.json();
      setItems((prev) => [media, ...prev]);
      toast.success("Uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const filtered = items.filter((i) =>
    i.filename.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="Search media..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="cursor-pointer rounded-md bg-primary px-4 py-2 text-primary-foreground">
          {uploading ? "Uploading..." : "Upload"}
          <input
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/gif,image/webp,image/avif,application/pdf,.docx,.xlsx"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            disabled={uploading}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {filtered.map((item) => (
          <div key={item.id} className="rounded-lg border p-2">
            {item.mimeType.startsWith("image/") ? (
              <Image
                src={item.url}
                alt={item.filename}
                width={256}
                height={128}
                unoptimized
                className="h-32 w-full rounded object-cover"
              />
            ) : (
              <div className="flex h-32 items-center justify-center rounded bg-muted text-xs">
                {item.mimeType}
              </div>
            )}
            <p className="mt-2 truncate text-sm">{item.filename}</p>
            <p className="text-xs text-muted-foreground">{(item.size / 1024).toFixed(1)} KB</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(item.url);
                  toast.success("Image URL copied. Paste it into the Image block.");
                } catch {
                  toast.error("Could not copy the URL. Open the image and copy its address.");
                }
              }}
            >
              Copy URL
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}