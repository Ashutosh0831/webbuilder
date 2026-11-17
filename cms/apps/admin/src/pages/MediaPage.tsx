import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, getToken } from "../lib/api";

interface MediaAsset { id: string; filename: string; url: string; mime: string; altText?: string | null; caption?: string | null; }

export default function MediaPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!siteId) return;
    try {
      const result = await api<{ media: MediaAsset[] }>(`/api/admin/sites/${siteId}/media`);
      setMedia(Array.isArray(result.media) ? result.media : []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the media library");
    }
  }

  useEffect(() => { void load(); }, [siteId]);

  async function upload() {
    if (!siteId || !fileRef.current?.files?.[0]) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", fileRef.current.files[0]);
    try {
      const response = await fetch(`/api/admin/sites/${siteId}/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Image upload failed");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <h1>Media</h1>
      <div className="card">
        <input type="file" ref={fileRef} accept="image/*" disabled={busy} />
        <button onClick={upload} disabled={busy || !siteId} style={{ marginLeft: 12 }}>
          {busy ? "Uploading…" : "Upload"}
        </button>
        {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
      </div>
      <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
        {media.map((m) => (
          <div key={m.id} className="card" style={{ padding: 8 }}>
            {m.mime?.startsWith("image/") ? <img src={m.url} alt={m.altText ?? ""} style={{ width: "100%", height: 120, objectFit: "cover" }} /> : <a href={m.url} target="_blank" rel="noreferrer">Open file</a>}
            <div style={{ fontSize: 12, wordBreak: "break-all", marginTop: 4 }}>{m.filename}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
