import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, getToken } from "../lib/api";

export default function MediaPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const [media, setMedia] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    if (!siteId) return;
    api<{ media: any[] }>(`/api/admin/sites/${siteId}/media`).then((r) =>
      setMedia(r.media)
    );
  }

  useEffect(load, [siteId]);

  async function upload() {
    if (!siteId || !fileRef.current?.files?.[0]) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", fileRef.current.files[0]);
    try {
      await fetch(`/api/admin/sites/${siteId}/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      load();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <h1>Media</h1>
      <div className="card">
        <input type="file" ref={fileRef} />
        <button onClick={upload} disabled={busy} style={{ marginLeft: 12 }}>
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>
      <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
        {media.map((m) => (
          <div key={m.id} className="card" style={{ padding: 8 }}>
            <img src={m.url} alt={m.altText ?? ""} style={{ width: "100%", height: 120, objectFit: "cover" }} />
            <div style={{ fontSize: 12, wordBreak: "break-all", marginTop: 4 }}>{m.filename}</div>
          </div>
        ))}
      </div>
    </div>
  );
}