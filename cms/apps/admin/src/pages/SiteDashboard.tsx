import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { normalizePublicSiteUrl } from "../lib/siteUrl";
import { pagePathForSection } from "../lib/pagePath";

interface CreatedSiteNotice {
  site: { id: string; name: string };
  keys: { read: string; write: string; preview: string };
  warning: string;
}

export default function SiteDashboard() {
  const { siteId } = useParams<{ siteId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [createdSite, setCreatedSite] = useState<CreatedSiteNotice | null>(() => {
    const state = location.state as { createdSite?: CreatedSiteNotice } | null;
    const candidate = state?.createdSite;
    if (candidate && siteId && candidate.site.id === siteId) return candidate;
    return null;
  });
  const [keyNotice, setKeyNotice] = useState("");
  const [pages, setPages] = useState<any[]>([]);
  const [pageAction, setPageAction] = useState<{ id: string; action: "duplicate" | "delete" } | null>(null);
  const [pageActionError, setPageActionError] = useState("");
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [publicUrl, setPublicUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const state = location.state as { createdSite?: CreatedSiteNotice } | null;
    const candidate = state?.createdSite;
    if (candidate && siteId && candidate.site.id === siteId) setCreatedSite(candidate);
    else setCreatedSite(null);
    setKeyNotice("");
  }, [location.key, location.state, siteId]);

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    Promise.allSettled([
      api<{ pages: any[] }>(`/api/admin/sites/${siteId}/pages`),
      api<{ submissions: any[] }>(`/api/admin/sites/${siteId}/submissions`),
      api<{ deployments: any[] }>(`/api/admin/sites/${siteId}/deployments`),
      api<{ settings: Array<{ key: string; value: unknown }> }>(`/api/admin/sites/${siteId}/settings`),
    ])
      .then(([pRes, sRes, dRes, cfgRes]) => {
        if (pRes.status === "fulfilled") {
          setPages(Array.isArray(pRes.value.pages) ? pRes.value.pages : []);
        } else {
          setError(pRes.reason?.message ?? "Failed to load pages");
        }
        if (sRes.status === "fulfilled") {
          setSubmissions(sRes.value.submissions ?? []);
        }
        if (dRes.status === "fulfilled") {
          setDeployments(dRes.value.deployments ?? []);
        }
        if (cfgRes.status === "fulfilled") {
          const val = cfgRes.value.settings?.find((s) => s.key === "public_url")?.value;
          setPublicUrl(normalizePublicSiteUrl(val));
        }
      })
      .finally(() => setLoading(false));
  }, [siteId]);

  const publishedCount = pages.filter((p) => p.status === "published").length;
  const draftCount = pages.filter((p) => p.status === "draft").length;
  const reviewCount = pages.filter((p) => p.approval_status === "in_review").length;
  const latestDeployment = deployments[0];

  async function copyKey(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setKeyNotice(`${label} API key copied.`);
    } catch {
      setKeyNotice("Copy was unavailable. Select the key field and copy it manually.");
    }
  }

  function dismissCreatedKeys() {
    setCreatedSite(null);
    navigate(location.pathname, { replace: true, state: null });
  }

  async function duplicatePage(page: any) {
    if (!siteId) return;
    setPageAction({ id: page.id, action: "duplicate" });
    setPageActionError("");
    try {
      const result = await api<{ page: { id: string } }>(`/api/admin/sites/${siteId}/pages/${page.id}/duplicate`, { method: "POST" });
      navigate(`/sites/${siteId}/pages/${result.page.id}/edit`);
    } catch (duplicateError) {
      setPageActionError(duplicateError instanceof Error ? duplicateError.message : "Could not duplicate page");
    } finally {
      setPageAction(null);
    }
  }

  async function deletePage(page: any) {
    if (!siteId || !window.confirm(`Delete “${page.title}” permanently? This also removes it from the public website.`)) return;
    setPageAction({ id: page.id, action: "delete" });
    setPageActionError("");
    try {
      await api(`/api/admin/sites/${siteId}/pages/${page.id}`, { method: "DELETE" });
      setPages((current) => current.filter((item) => item.id !== page.id));
    } catch (deleteError) {
      setPageActionError(deleteError instanceof Error ? deleteError.message : "Could not delete page");
    } finally {
      setPageAction(null);
    }
  }

  return (
    <div>
      <h1>Overview</h1>

      {createdSite && (
        <section className="card" role="status" style={{ marginBottom: 20, borderColor: "#86efac" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h2 style={{ marginTop: 0 }}>{createdSite.site.name} created</h2>
              <p>{createdSite.warning} These keys are shown once; save them in your password manager.</p>
            </div>
            <button type="button" className="secondary" onClick={dismissCreatedKeys}>Close</button>
          </div>
          <div className="form-grid">
            {Object.entries(createdSite.keys).map(([type, key]) => (
              <label key={type}>{type} API key
                <div className="row" style={{ flexWrap: "wrap" }}>
                  <input readOnly value={key} onFocus={(event) => event.currentTarget.select()} aria-label={`${type} API key`} />
                  <button type="button" className="secondary" onClick={() => void copyKey(type, key)}>Copy</button>
                </div>
              </label>
            ))}
          </div>
          {keyNotice && <p role="status">{keyNotice}</p>}
        </section>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <div className="card">
          <div style={{ fontSize: 12, color: "#64748b" }}>Published Pages</div>
          <strong style={{ fontSize: 24 }}>{publishedCount}</strong>
        </div>
        <div className="card">
          <div style={{ fontSize: 12, color: "#64748b" }}>Draft Pages</div>
          <strong style={{ fontSize: 24 }}>{draftCount}</strong>
        </div>
        <div className="card">
          <div style={{ fontSize: 12, color: "#64748b" }}>Pages in Review</div>
          <strong style={{ fontSize: 24 }}>{reviewCount}</strong>
        </div>
        <div className="card">
          <div style={{ fontSize: 12, color: "#64748b" }}>Form Submissions</div>
          <strong style={{ fontSize: 24 }}>{submissions.length}</strong>
        </div>
        <div className="card">
          <div style={{ fontSize: 12, color: "#64748b" }}>Latest Deployment</div>
          <strong style={{ fontSize: 18 }}>{latestDeployment?.status ?? "None"}</strong>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h2>Pages</h2>
        {pageActionError && <p role="alert" style={{ color: "#b91c1c" }}>{pageActionError}</p>}
        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p style={{ color: "red" }}>{error}</p>
        ) : pages.length === 0 ? (
          <p>No pages yet. Click "+ Add New Page" to create one.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Section</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Review</th>
                <th>Scheduled action</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => {
                const liveHref = publicUrl
                  ? `${publicUrl.replace(/\/+$/, "")}${pagePathForSection(p.section_key, p.slug)}`
                  : null;
                const scheduledAt = p.scheduled_publish_at ?? p.scheduled_unpublish_at;
                const scheduledAction = p.scheduled_publish_at ? "Publish" : p.scheduled_unpublish_at ? "Unpublish" : null;
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.title}</strong>
                      {p.has_unpublished_changes && (
                        <span className="badge" style={{ marginLeft: 8, background: "#fef3c7", color: "#92400e" }}>
                          Unpublished edits
                        </span>
                      )}
                    </td>
                    <td><span className="badge">{p.section_key}</span></td>
                    <td><code>{p.slug}</code></td>
                    <td><span className="badge">{p.status}</span></td>
                    <td><span className="badge" style={p.approval_status === "in_review" ? { background: "#dbeafe", color: "#1e40af" } : undefined}>{String(p.approval_status ?? "draft").replace("_", " ")}</span></td>
                    <td>{scheduledAt && scheduledAction ? <><strong>{scheduledAction}</strong><br /><time dateTime={scheduledAt}>{new Date(scheduledAt).toLocaleString()}</time></> : <span style={{ color: "#64748b" }}>—</span>}</td>
                    <td>
                      <Link to={`/sites/${siteId}/pages/${p.id}/edit`} style={{ marginRight: 10 }}>
                        Edit
                      </Link>
                      {liveHref && p.status === "published" && (
                        <a href={liveHref} target="_blank" rel="noreferrer">View ↗</a>
                      )}
                      <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
                        <button type="button" className="secondary" disabled={pageAction !== null} onClick={() => void duplicatePage(p)}>
                          {pageAction?.id === p.id && pageAction?.action === "duplicate" ? "Duplicating…" : "Duplicate"}
                        </button>
                        <button type="button" className="danger" disabled={pageAction !== null} onClick={() => void deletePage(p)}>
                          {pageAction?.id === p.id && pageAction?.action === "delete" ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
