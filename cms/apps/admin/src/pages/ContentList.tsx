import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";

interface Entry {
  id: string;
  contentTypeId: string;
  slug: string;
  status: string;
  data: any;
  updatedAt: string;
}

export default function ContentList() {
  const { siteId, typeKey } = useParams<{ siteId: string; typeKey: string }>();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [typeId, setTypeId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) return;
    Promise.all([
      api<{ contentTypes: any[] }>(`/api/admin/sites/${siteId}/content-types`),
      api<{ entries: Entry[] }>(`/api/admin/sites/${siteId}/content`),
    ]).then(([typesResult, entriesResult]) => {
        const contentTypes = typesResult.contentTypes ?? [];
        setTypes(contentTypes);
        const t = contentTypes.find((x: any) => x.key === typeKey);
        setTypeId(t?.id ?? "");
        setEntries(entriesResult.entries ?? []);
      }).catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load content");
      });
  }, [siteId, typeKey]);

  const filtered = entries.filter((entry) => !typeId || entry.contentTypeId === typeId);

  async function createNew() {
    if (!siteId || !typeId || !newSlug) return;
    setError(null);
    try {
    const res = await api<{ entry: Entry }>(
      `/api/admin/sites/${siteId}/content`,
      {
        method: "POST",
        body: JSON.stringify({
          contentTypeId: typeId,
          slug: newSlug,
          data: {},
        }),
      }
    );
    setCreating(false);
    setNewSlug("");
    navigate(`/sites/${siteId}/content/${typeKey}/${res.entry.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create entry");
    }
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>{typeKey} entries</h1>
        <button onClick={() => setCreating(true)}>+ New entry</button>
      </div>
      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}

      {creating && (
        <div className="card">
          <h3>New entry</h3>
          <div className="form-grid">
            <label>
              Slug
              <input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""))}
                placeholder="my-new-entry"
              />
            </label>
            <div className="row">
              <button onClick={createNew}>Create</button>
              <button className="secondary" onClick={() => setCreating(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Slug</th>
            <th>Status</th>
            <th>Updated</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((e) => (
            <tr key={e.id}>
              <td><code>{e.slug}</code></td>
              <td><span className={`badge ${e.status}`}>{e.status}</span></td>
              <td>{new Date(e.updatedAt).toLocaleString()}</td>
              <td>
                <Link to={`/sites/${siteId}/content/${typeKey}/${e.id}`}>Edit →</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
