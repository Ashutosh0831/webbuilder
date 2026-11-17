import { useEffect, useState } from "react";
import { NavLink, Outlet, useParams, Link } from "react-router-dom";
import { api } from "../lib/api";

export default function SiteLayout() {
  const { siteId } = useParams<{ siteId: string }>();
  const [siteName, setSiteName] = useState<string>("Loading...");

  useEffect(() => {
    if (!siteId) return;
    // Catch errors so the layout doesn't crash if the API fails
    api<{ site: any }>(`/api/admin/sites/${siteId}`)
      .then((r) => {
        if (r?.site?.name) setSiteName(r.site.name);
        else setSiteName("Unknown Site");
      })
      .catch(() => setSiteName("Error loading site"));
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
          href="http://localhost:3000"
          target="_blank"
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
          🔗 View Live Site
        </a>

        <div style={{ marginBottom: 4, fontSize: 12, color: "#64748b", fontWeight: "bold" }}>MENU</div>
        <NavLink to={`/sites/${siteId}`} end style={({ isActive }) => ({ display: "block", padding: "8px 12px", background: isActive ? "#eee" : "transparent" })}>
          Overview
        </NavLink>
        
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
            textDecoration: "none"
          })}
        >
          + Add New Page
        </NavLink>

        <NavLink to={`/sites/${siteId}/media`} style={{ display: "block", padding: "8px 12px" }}>Media</NavLink>
        <NavLink to={`/sites/${siteId}/submissions`} style={{ display: "block", padding: "8px 12px" }}>Submissions</NavLink>
        <NavLink to={`/sites/${siteId}/settings`} style={{ display: "block", padding: "8px 12px" }}>Settings</NavLink>
      </aside>
      
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}