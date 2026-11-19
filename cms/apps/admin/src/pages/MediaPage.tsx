import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";

interface MediaAsset { id: string; filename: string; url: string; mime: string; folder?: string; altText?: string | null; caption?: string | null; }

export default function MediaPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadAltText, setUploadAltText] = useState("");
  const [uploadFolder, setUploadFolder] = useState("");
  const [search, setSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
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
    fd.append("altText", uploadAltText.trim());
    fd.append("folder", uploadFolder.trim());
    try {
      await api<{ media: MediaAsset }>(`/api/admin/sites/${siteId}/media`, {
        method: "POST",
        body: fd,
      });
      setUploadAltText("");
      setUploadFolder("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveDetails(asset: MediaAsset) {
    setSavingId(asset.id);
    setError(null);
    try {
      const result = await api<{ media: MediaAsset }>(`/api/admin/media/${asset.id}`, {
        method: "PUT",
        body: JSON.stringify({ altText: asset.altText ?? "", caption: asset.caption ?? "", folder: asset.folder ?? "" }),
      });
      setMedia((current) => current.map((item) => item.id === asset.id ? result.media : item));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save image details");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteAsset(asset: MediaAsset) {
    if (!window.confirm(`Delete ${asset.filename}?`)) return;
    setDeletingId(asset.id);
    setError(null);
    try {
      await api(`/api/admin/media/${asset.id}`, { method: "DELETE" });
      setMedia((current) => current.filter((item) => item.id !== asset.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete this image");
    } finally {
      setDeletingId(null);
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setError(null);
    } catch {
      setError("Could not copy the image URL. Select and copy it from the field instead.");
    }
  }

  const folders = [...new Set(media.map((asset) => asset.folder ?? "").filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const visibleMedia = media.filter((asset) => {
    const query = search.trim().toLocaleLowerCase();
    const matchesSearch = !query || [asset.filename, asset.altText, asset.caption, asset.folder].some((value) => value?.toLocaleLowerCase().includes(query));
    const matchesFolder = folderFilter === "all" || (asset.folder ?? "") === folderFilter;
    const matchesType = typeFilter === "all" || (typeFilter === "images" ? asset.mime.startsWith("image/") : !asset.mime.startsWith("image/"));
    return matchesSearch && matchesFolder && matchesType;
  });

  return (
    <div>
      <h1>Media</h1>
      <div className="card">
        <input type="file" ref={fileRef} accept="image/*" disabled={busy} />
        <label style={{ display: "grid", gap: 4, marginTop: 12, maxWidth: 480 }}>
          Image alt text
          <input value={uploadAltText} onChange={(event) => setUploadAltText(event.target.value)} maxLength={500} placeholder="Describe the image for screen readers" disabled={busy} />
        </label>
        <label style={{ display: "grid", gap: 4, marginTop: 12, maxWidth: 480 }}>
          Folder
          <input value={uploadFolder} onChange={(event) => setUploadFolder(event.target.value)} maxLength={255} placeholder="e.g. Services / Pest Control" disabled={busy} />
        </label>
        <button onClick={upload} disabled={busy || !siteId} style={{ marginLeft: 12 }}>
          {busy ? "Uploading…" : "Upload"}
        </button>
        {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
      </div>
      <div className="card form-grid" style={{ margin: "16px 0" }}>
        <label>Search<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filename, alt text, caption, folder" /></label>
        <label>Folder<select value={folderFilter} onChange={(event) => setFolderFilter(event.target.value)}><option value="all">All folders</option><option value="">Unfiled</option>{folders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}</select></label>
        <label>Type<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All files</option><option value="images">Images</option><option value="other">Other files</option></select></label>
        <div role="status" style={{ alignSelf: "end", paddingBottom: 8 }}>{visibleMedia.length} of {media.length} assets</div>
      </div>
      <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
        {visibleMedia.map((m) => (
          <div key={m.id} className="card" style={{ padding: 12 }}>
            {m.mime?.startsWith("image/") ? <img src={m.url} alt={m.altText ?? ""} style={{ width: "100%", height: 120, objectFit: "cover" }} /> : <a href={m.url} target="_blank" rel="noreferrer">Open file</a>}
            <div style={{ fontSize: 12, wordBreak: "break-all", marginTop: 4 }}>{m.filename}</div>
            <label style={{ display: "grid", gap: 4, marginTop: 10 }}>
              Alt text
              <input value={m.altText ?? ""} maxLength={500} onChange={(event) => setMedia((current) => current.map((item) => item.id === m.id ? { ...item, altText: event.target.value } : item))} />
            </label>
            <label style={{ display: "grid", gap: 4, marginTop: 8 }}>
              Folder
              <input value={m.folder ?? ""} maxLength={255} placeholder="Unfiled" onChange={(event) => setMedia((current) => current.map((item) => item.id === m.id ? { ...item, folder: event.target.value } : item))} />
            </label>
            <label style={{ display: "grid", gap: 4, marginTop: 8 }}>
              Caption
              <textarea value={m.caption ?? ""} maxLength={2000} rows={2} onChange={(event) => setMedia((current) => current.map((item) => item.id === m.id ? { ...item, caption: event.target.value } : item))} />
            </label>
            <label style={{ display: "grid", gap: 4, marginTop: 8 }}>
              Image URL
              <input readOnly value={m.url} onFocus={(event) => event.currentTarget.select()} />
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => void saveDetails(m)} disabled={savingId === m.id || deletingId === m.id}>{savingId === m.id ? "Saving…" : "Save details"}</button>
              <button onClick={() => void copyUrl(m.url)} disabled={deletingId === m.id}>Copy URL</button>
              <button onClick={() => void deleteAsset(m)} disabled={savingId === m.id || deletingId === m.id}>{deletingId === m.id ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
