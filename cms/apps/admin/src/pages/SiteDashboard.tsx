import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";

export default function SiteDashboard() {
  const { siteId } = useParams<{ siteId: string }>();
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) return;
    api<{ pages: any[] }>(`/api/admin/sites/${siteId}/pages`)
      .then((r) => {
        // Ensure it's an array. If the API fails, default to []
        setPages(Array.isArray(r?.pages) ? r.pages : []);
      })
      .catch((e) => {
        console.error(e);
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [siteId]);

  return (
    <div>
      <h1>Overview</h1>
      
      <div className="card" style={{ marginBottom: 24 }}>
        <h2>Published Pages</h2>
        <p style={{ color: "#64748b", fontSize: 14 }}>
          These pages are live on your website and appear in the navigation menu.
        </p>
        
        {loading ? (
          <p>Loading pages...</p>
        ) : error ? (
          <p style={{ color: "red" }}>Error loading pages: {error}</p>
        ) : pages.length === 0 ? (
          <p>No pages yet. Click "+ Add New Page" to create one.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Section</th>
                <th>URL</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.title}</strong></td>
                  <td><span className="badge">{p.section_key}</span></td>
                  <td><code>/{p.section_key}/{p.slug}</code></td>
                  <td>
                    <a href={`http://localhost:3000/${p.section_key}/${p.slug}`} target="_blank" rel="noreferrer">
                      View Live ↗
                    </a>
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