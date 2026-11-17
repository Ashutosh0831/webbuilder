import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

interface Client { id: string; name: string; email?: string; status: string; }
interface Site { id: string; name: string; siteSlug: string; clientId: string; status: string; }

export default function SitesList() {
  const { user, logout } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<{ clients: Client[] }>("/api/admin/clients"),
      api<{ sites: Site[] }>("/api/admin/sites"),
    ])
      .then(([c, s]) => {
        setClients(c.clients);
        setSites(s.sites);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="header">
        <h2 style={{ margin: 0 }}>CMS Admin</h2>
        <div className="row">
          <span>{user?.email}</span>
          <button className="secondary" onClick={logout}>Sign out</button>
        </div>
      </div>
      <div className="content">
        <h1>Sites</h1>
        {loading && <p>Loading…</p>}
        {!loading && sites.length === 0 && (
          <p>No sites yet. Create a client + site via the API.</p>
        )}
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Client</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => {
              const client = clients.find((c) => c.id === s.clientId);
              return (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td><code>{s.siteSlug}</code></td>
                  <td>{client?.name ?? "—"}</td>
                  <td><span className="badge">{s.status}</span></td>
                  <td>
                    <Link to={`/sites/${s.id}`}>Open →</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}