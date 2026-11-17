import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

interface Client { id: string; name: string; email?: string; status: string; }
interface Site { id: string; name: string; siteSlug: string; clientId: string; status: string; }
interface CreatedSite { site: Site; keys: { read: string; write: string; preview: string }; warning: string; }

export default function SitesList() {
  const { user, logout } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedSite | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientId, setClientId] = useState("");
  const [siteName, setSiteName] = useState("");
  const [siteSlug, setSiteSlug] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [clientResult, siteResult] = await Promise.all([
        api<{ clients: Client[] }>("/api/admin/clients"),
        api<{ sites: Site[] }>("/api/admin/sites"),
      ]);
      setClients(clientResult.clients);
      setSites(siteResult.sites);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sites");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function createSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setCreated(null);
    try {
      let selectedClientId = clientId;
      if (!selectedClientId) {
        const result = await api<{ client: Client }>("/api/admin/clients", {
          method: "POST",
          body: JSON.stringify({ name: clientName.trim(), email: clientEmail.trim() || undefined }),
        });
        selectedClientId = result.client.id;
        setClients((current) => [...current, result.client]);
        setClientId(result.client.id);
        setClientName("");
        setClientEmail("");
      }
      const result = await api<CreatedSite>("/api/admin/sites", {
        method: "POST",
        body: JSON.stringify({ clientId: selectedClientId, name: siteName.trim(), siteSlug: siteSlug.trim() }),
      });
      setCreated(result);
      setClientName("");
      setClientEmail("");
      setClientId("");
      setSiteName("");
      setSiteSlug("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create site");
    } finally {
      setSaving(false);
    }
  }

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
        {error && <div className="card" role="alert" style={{ color: "#b91c1c" }}>{error}</div>}
        {created && (
          <div className="card" role="status">
            <h2>{created.site.name} created</h2>
            <p>{created.warning} Copy and store these keys now; they cannot be retrieved later.</p>
            <div className="form-grid">
              {Object.entries(created.keys).map(([type, key]) => (
                <label key={type}>{type} API key
                  <input readOnly value={key} onFocus={(e) => e.currentTarget.select()} />
                </label>
              ))}
            </div>
          </div>
        )}

        <section className="card">
          <h2>Create a website</h2>
          <form className="form-grid" onSubmit={createSite}>
            <label>
              Existing client (optional)
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Create a new client</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </label>
            {!clientId && <>
              <label>Client name<input required value={clientName} onChange={(e) => setClientName(e.target.value)} /></label>
              <label>Client email<input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} /></label>
            </>}
            <label>Website name<input required value={siteName} onChange={(e) => setSiteName(e.target.value)} /></label>
            <label>
              Website slug
              <input required pattern="[a-z0-9-]+" value={siteSlug} onChange={(e) => setSiteSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))} placeholder="example-site" />
              <small>Lowercase letters, numbers, and hyphens.</small>
            </label>
            <button type="submit" disabled={saving}>{saving ? "Creating..." : "Create website"}</button>
          </form>
        </section>

        <h2>Your websites</h2>
        {loading ? <p>Loading sites...</p> : sites.length === 0 ? <p>No websites yet.</p> : (
          <table>
            <thead><tr><th>Name</th><th>Slug</th><th>Client</th><th>Status</th><th></th></tr></thead>
            <tbody>{sites.map((site) => {
              const client = clients.find((item) => item.id === site.clientId);
              return <tr key={site.id}>
                <td>{site.name}</td><td><code>{site.siteSlug}</code></td><td>{client?.name ?? "—"}</td>
                <td><span className="badge">{site.status}</span></td><td><Link to={`/sites/${site.id}`}>Open</Link></td>
              </tr>;
            })}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
