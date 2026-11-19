import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";

export default function DeploymentsPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const [deployments, setDeployments] = useState<any[]>([]);
  const [target, setTarget] = useState<"local" | "docker" | "vercel">("local");
  const [domain, setDomain] = useState("");
  const [selectedLogs, setSelectedLogs] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    if (!siteId) return;
    try {
      const res = await api<{ deployments: any[] }>(`/api/admin/sites/${siteId}/deployments`);
      setDeployments(res.deployments ?? []);
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  useEffect(() => {
    load();
  }, [siteId]);

  async function triggerDeploy() {
    if (!siteId) return;
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/admin/sites/${siteId}/deployments`, {
        method: "POST",
        body: JSON.stringify({ target, domain: domain.trim() || undefined }),
      });
      setMsg("Deployment job queued. Follow its status and logs here.");
      await load();
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function retryDeployment(deploymentId: string) {
    if (!siteId) return;
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/admin/sites/${siteId}/deployments/${deploymentId}/retry`, { method: "POST" });
      setMsg("Deployment retry queued.");
      await load();
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function rollbackDeployment(deploymentId: string) {
    if (!siteId) return;
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/admin/sites/${siteId}/deployments/${deploymentId}/rollback`, { method: "POST" });
      setMsg("Rollback completed and health-checked. The selected version is now active.");
      await load();
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Deployments</h1>
      {msg && <div className="card" style={{ marginBottom: 16 }}>{msg}</div>}

      <div className="card" role="note">
        Local deployment generates and builds the Next.js site, starts a local server, and marks it ready only after an HTTP health check succeeds. Docker builds the site in a container and serves it on this machine after a health check. Vercel requires provider configuration. Sites created before encrypted read-key storage may need their read key rotated before deployment.
      </div>

      <div className="card form-grid" style={{ marginBottom: 20 }}>
        <label>
          Target
          <select value={target} onChange={(e) => setTarget(e.target.value as any)}>
            <option value="local">Local Build and Server</option>
            <option value="docker">Docker (local container)</option>
            <option value="vercel">Vercel</option>
          </select>
        </label>
        <label>
          Requested domain (Vercel provider setup required)
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" />
        </label>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <button onClick={triggerDeploy} disabled={busy} style={{ padding: "8px 16px", background: "#10b981", color: "white" }}>
            {busy ? "Recording..." : "Check setup & record request"}
          </button>
          <button onClick={load} type="button">Refresh</button>
        </div>
      </div>

      <div className="card">
        <h2>Deployment History</h2>
        {deployments.length === 0 ? (
          <p>No deployments yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Target</th>
                <th>Domain / URL</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((d) => (
                <tr key={d.id}>
                  <td><span className="badge">{d.status}</span></td>
                  <td>{d.target}</td>
                  <td>{d.liveUrl || d.domain || "—"}</td>
                  <td>{new Date(d.createdAt).toLocaleString()}</td>
                  <td>
                    <button type="button" onClick={() => setSelectedLogs(d.logs || "No logs")} style={{ marginRight: 8 }}>
                      Logs
                    </button>
                    {d.status === "READY" && (
                      d.target === "local" || d.target === "docker" ? (
                        <button type="button" disabled={busy} onClick={() => void rollbackDeployment(d.id)}>
                          Roll back to this version
                        </button>
                      ) : (
                        <button type="button" disabled title={`Rollback is not configured for ${d.target}`}>
                          Rollback unavailable
                        </button>
                      )
                    )}
                    {d.status === "FAILED" && (
                      <button type="button" disabled={busy} onClick={() => void retryDeployment(d.id)}>
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedLogs !== null && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h3>Build Logs</h3>
            <button type="button" onClick={() => setSelectedLogs(null)}>Close</button>
          </div>
          <pre style={{ background: "#0f172a", color: "#e2e8f0", padding: 12, borderRadius: 6, overflow: "auto" }}>
            {selectedLogs}
          </pre>
        </div>
      )}
    </div>
  );
}
