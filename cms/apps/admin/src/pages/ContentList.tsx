import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";

interface Entry {
  id: string;
  slug: string;
  status: string;
  data: any;
  updatedAt: string;
}

export default function ContentList() {
  const { siteId, typeKey } = useParams<{ siteId: string; typeKey: string }>();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [typeId, setTypeId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [newSlug, setNewSlug] = useState("");

  useEffect(() => {
    if (!siteId) return;
    api<{ contentTypes: any[] }>(`/api/admin/sites/${siteId}/content-types`).then(
      (r) => {
        setTypes(r.contentTypes);
        const t = r.contentTypes.find((x: any) => x.key === typeKey);
        setTypeId(t?.id ?? "");
      }
    );
    api<{ entries: Entry[] }>(`/api/admin/sites/${siteId}/content`).then((r) =>
      setEntries(r.entries)
    );
  }, [siteId, typeKey]);

  const filtered = entries.filter((e) => !typeId || e.data?.__typeId === typeId) ||
    entries;

  async function createNew() {
    if (!siteId || !typeId || !newSlug) return;
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
    window.location.href = `/sites/${siteId}/content/${typeKey}/${res.entry.id}`;
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>{typeKey} entries</h1>
        <button onClick={() => setCreating(true)}>+ New entry</button>
      </div>

      {creating && (
        <div className="card">
          <h3>New entry</h3>
          <div className="form-grid">
            <label>
              Slug
              <input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
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