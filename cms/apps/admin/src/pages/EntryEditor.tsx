import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";

export default function EntryEditor() {
  const { siteId, typeKey, entryId } = useParams<{
    siteId: string;
    typeKey: string;
    entryId: string;
  }>();
  const nav = useNavigate();

  const [entry, setEntry] = useState<any>(null);
  const [type, setType] = useState<any>(null);
  const [data, setData] = useState<Record<string, any>>({});
  const [seo, setSeo] = useState({
    title: "",
    description: "",
    canonical: "",
    ogImage: "",
    robots: "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId || !entryId) return;
    api<{ entries: any[] }>(`/api/admin/sites/${siteId}/content`).then((r) => {
      const e = r.entries.find((x) => x.id === entryId);
      if (!e) return;
      setEntry(e);
      setData(e.data ?? {});
      setSeo({
        title: e.seoTitle ?? "",
        description: e.seoDescription ?? "",
        canonical: e.seoCanonical ?? "",
        ogImage: e.seoOgImage ?? "",
        robots: e.seoRobots ?? "",
      });
    });
    api<{ contentTypes: any[] }>(`/api/admin/sites/${siteId}/content-types`).then(
      (r) => {
        const t = r.contentTypes.find((x) => x.key === typeKey);
        setType(t);
      }
    );
  }, [siteId, entryId, typeKey]);

  async function save() {
    if (!entry) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await api<any>(`/api/admin/content/${entry.id}`, {
        method: "PUT",
        body: JSON.stringify({
          data,
          seoTitle: seo.title || null,
          seoDescription: seo.description || null,
          seoCanonical: seo.canonical || null,
          seoOgImage: seo.ogImage || null,
          seoRobots: seo.robots || null,
          expectedVersion: entry.version,
        }),
      });
      setEntry(res.entry);
      setMsg("Saved");
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!entry) return;
    setBusy(true);
    try {
      const res = await api<any>(`/api/admin/content/${entry.id}/publish`, {
        method: "POST",
        body: "{}",
      });
      setEntry(res.entry);
      setMsg("Published");
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!entry || !confirm("Delete this entry?")) return;
    await api(`/api/admin/content/${entry.id}`, { method: "DELETE" });
    nav(`/sites/${siteId}/content/${typeKey}`);
  }

  if (!entry || !type) return <p>Loading…</p>;

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>{entry.slug}</h1>
        <div className="row">
          <span className={`badge ${entry.status}`}>{entry.status}</span>
          {entry.status !== "published" ? (
            <button onClick={publish} disabled={busy}>Publish</button>
          ) : null}
          <button className="danger" onClick={remove}>Delete</button>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <div className="card">
        <h2>Content</h2>
        <div className="form-grid">
          {type.fieldSchema.fields.map((f: any) => (
            <label key={f.key}>
              {f.label} {f.required && <span style={{ color: "red" }}>*</span>}
              {f.type === "textarea" || f.type === "richtext" ? (
                <textarea
                  rows={5}
                  value={data[f.key] ?? ""}
                  onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                />
              ) : (
                <input
                  value={data[f.key] ?? ""}
                  onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                />
              )}
              <small>key: {f.key} · type: {f.type}</small>
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>SEO</h2>
        <div className="form-grid">
          <label>
            SEO Title
            <input
              value={seo.title}
              onChange={(e) => setSeo({ ...seo, title: e.target.value })}
            />
          </label>
          <label>
            SEO Description
            <textarea
              rows={3}
              value={seo.description}
              onChange={(e) => setSeo({ ...seo, description: e.target.value })}
            />
          </label>
          <label>
            Canonical URL
            <input
              value={seo.canonical}
              onChange={(e) => setSeo({ ...seo, canonical: e.target.value })}
            />
          </label>
        </div>
      </div>

      <button onClick={save} disabled={busy}>
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}