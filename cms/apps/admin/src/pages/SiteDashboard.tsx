import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { buildPublicPageUrl, normalizePublicSiteUrl } from "../lib/siteUrl";

interface Page {
  id: string;
  title: string;
  section_key: string;
  slug: string;
  status: string;
}

export default function SiteDashboard() {
  const { siteId } = useParams<{ siteId: string }>();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState("");

  useEffect(() => {
    if (!siteId) return;
    setPublicUrl("");
    api<{ pages: Page[] }>(`/api/admin/sites/${siteId}/pages`)
      .then((result) => setPages(Array.isArray(result?.pages) ? result.pages : []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load pages"))
      .finally(() => setLoading(false));
    api<{ settings: Array<{ key: string; value: unknown }> }>(`/api/admin/sites/${siteId}/settings`)
      .then((result) => setPublicUrl(normalizePublicSiteUrl(result.settings?.find((setting) => setting.key === "public_url")?.value)))
      .catch(() => setPublicUrl(""));
  }, [siteId]);

  async function changePageStatus(pageId: string, action: "publish" | "unpublish") {
    if (!siteId) return;
    setPublishingId(pageId);
    setError(null);
    try {
      const result = await api<{ page: { id: string; status: string } }>(
        `/api/admin/sites/${siteId}/pages/${pageId}/${action}`,
        { method: "POST" },
      );
      setPages((current) => current.map((page) =>
        page.id === result.page.id ? { ...page, status: result.page.status } : page
      ));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish page");
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <div>
      <h1>Overview</h1>
      <div className="card" style={{ marginBottom: 24 }}>
        <h2>Pages</h2>
        <p style={{ color: "#64748b", fontSize: 14 }}>
          Drafts are only visible in the admin. Published pages are live on your website.
        </p>
        {loading ? (
          <p>Loading pages...</p>
        ) : error && pages.length === 0 ? (
          <p style={{ color: "red" }}>Error loading pages: {error}</p>
        ) : pages.length === 0 ? (
          <p>No pages yet. Click "+ Add New Page" to create one.</p>
        ) : (
          <>
            {error && <p style={{ color: "red" }}>{error}</p>}
            <table>
              <thead>
                <tr><th>Title</th><th>Section</th><th>URL</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page.id}>
                    <td><strong>{page.title}</strong></td>
                    <td><span className="badge">{page.section_key}</span></td>
                    <td><code>/{page.section_key}/{page.slug}</code></td>
                    <td><span className="badge">{page.status}</span></td>
                    <td>
                    {page.status === "draft" ? (
                        <>
                          <Link to={`/sites/${siteId}/pages/${page.id}/edit`}>Edit</Link>{" "}
                          <button onClick={() => changePageStatus(page.id, "publish")} disabled={publishingId === page.id}>
                            {publishingId === page.id ? "Publishing..." : "Publish"}
                          </button>
                        </>
                      ) : page.status === "published" ? (
                      <>
                        {publicUrl ? <a href={buildPublicPageUrl(publicUrl, page.section_key, page.slug)} target="_blank" rel="noreferrer">View Live</a> : <Link to={`/sites/${siteId}/settings`}>Set site URL</Link>}{" "}
                        <button className="secondary" onClick={() => changePageStatus(page.id, "unpublish")} disabled={publishingId === page.id}>
                          {publishingId === page.id ? "Unpublishing..." : "Unpublish"}
                        </button>
                      </>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
