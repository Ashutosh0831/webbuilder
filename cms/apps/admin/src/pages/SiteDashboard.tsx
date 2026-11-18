import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";

export default function SiteDashboard() {
  const { siteId } = useParams<{ siteId: string }>();
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) return;
    api<{ pages: any[] }>(`/api/admin/sites/${siteId}/pages`)
      .then((r) => setPages(Array.isArray(r.pages) ? r.pages : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [siteId]);

  return (
    <div>
      <h1>Overview</h1>
      <div className="card" style={{ marginBottom: 24 }}>
        <h2>Pages</h2>
        {loading ? <p>Loading...</p> : error ? <p style={{ color: "red" }}>{error}</p> : pages.length === 0 ? (
          <p>No pages yet. Click "+ Add New Page" to create one.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Section</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.title}</strong></td>
                  <td><span className="badge">{p.section_key}</span></td>
                  <td><code>{p.slug}</code></td>
                  <td><span className="badge">{p.status}</span></td>
                  <td>
                    <Link to={`/sites/${siteId}/pages/${p.id}/edit`} style={{ marginRight: 10 }}>Edit</Link>
                    <a href={`http://localhost:3000/${p.section_key}/${p.slug}`} target="_blank" rel="noreferrer">View ↗</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}