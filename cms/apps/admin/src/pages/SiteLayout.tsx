import { useEffect, useState } from "react";
import { NavLink, Outlet, useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { normalizePublicSiteUrl } from "../lib/siteUrl";

export default function SiteLayout() {
  const { siteId } = useParams<{ siteId: string }>();
  const [siteName, setSiteName] = useState<string>("Loading...");
  const [publicUrl, setPublicUrl] = useState("");
  const [contentTypes, setContentTypes] = useState<Array<{ key: string; label: string }>>([]);

  useEffect(() => {
    if (!siteId) return;
    setPublicUrl("");
    api<{ site: any }>(`/api/admin/sites/${siteId}`)
      .then((r) => {
        if (r?.site?.name) setSiteName(r.site.name);
        else setSiteName("Unknown Site");
      })
      .catch(() => setSiteName("Error loading site"));
    api<{ settings: Array<{ key: string; value: unknown }> }>(`/api/admin/sites/${siteId}/settings`)
      .then((result) => {
        const value = result.settings?.find((setting) => setting.key === "public_url")?.value;
        setPublicUrl(normalizePublicSiteUrl(value));
      })
      .catch(() => setPublicUrl(""));
    api<{ contentTypes: Array<{ key: string; label: string }> }>(`/api/admin/sites/${siteId}/content-types`)
      .then((result) => setContentTypes(result.contentTypes ?? []))
      .catch(() => setContentTypes([]));
  }, [siteId]);

  if (!siteId) return <div>Missing site ID</div>;

  return (
    <div className="layout">
      <aside className="sidebar">
        <Link to="/" style={{ marginBottom: 16, display: "block", fontWeight: "bold" }}>
          ← Back to Sites
        </Link>

        <h3 style={{ marginTop: 0, color: "#1a4d8f" }}>{siteName}</h3>

        <a
          href={publicUrl || `/sites/${siteId}/settings`}
          target={publicUrl ? "_blank" : undefined}
          rel="noopener noreferrer"
          style={{
            display: "block",
            padding: "8px 12px",
            marginBottom: 16,
            background: "#10b981",
            color: "white",
            borderRadius: 6,
            textDecoration: "none",
            textAlign: "center",
            fontWeight: "bold",
          }}
        >
          {publicUrl ? "View Live Site" : "Set public site URL"}
        </a>

        <div style={{ marginBottom: 4, fontSize: 12, color: "#64748b", fontWeight: "bold" }}>MENU</div>
        <NavLink to={`/sites/${siteId}`} end style={({ isActive }) => ({ display: "block", padding: "8px 12px", background: isActive ? "#eee" : "transparent" })}>
          Overview & Pages
        </NavLink>
        {contentTypes.map((type) => (
          <NavLink key={type.key} to={`/sites/${siteId}/content/${type.key}`} style={{ display: "block", padding: "8px 12px" }}>
            {type.label}
          </NavLink>
        ))}

        <NavLink
          to={`/sites/${siteId}/pages/new`}
          style={({ isActive }) => ({
            display: "block",
            padding: "10px",
            marginTop: 10,
            marginBottom: 10,
            background: isActive ? "#1a4d8f" : "#e0e7ff",
            color: isActive ? "white" : "#1a4d8f",
            borderRadius: 6,
            fontWeight: "bold",
            textAlign: "center",
            textDecoration: "none",
          })}
        >
          + Add New Page
        </NavLink>

        <NavLink to={`/sites/${siteId}/media`} style={{ display: "block", padding: "8px 12px" }}>Media Library</NavLink>
        <NavLink to={`/sites/${siteId}/menus`} style={{ display: "block", padding: "8px 12px" }}>Navigation Menus</NavLink>
        <NavLink to={`/sites/${siteId}/submissions`} style={{ display: "block", padding: "8px 12px" }}>Form Submissions</NavLink>
        <NavLink to={`/sites/${siteId}/deployments`} style={{ display: "block", padding: "8px 12px" }}>Deployments</NavLink>
        <NavLink to={`/sites/${siteId}/users-keys`} style={{ display: "block", padding: "8px 12px" }}>Users, Keys & Logs</NavLink>
        <NavLink to={`/sites/${siteId}/settings`} style={{ display: "block", padding: "8px 12px" }}>Site Settings</NavLink>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
