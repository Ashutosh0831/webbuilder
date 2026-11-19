import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";

export default function UsersKeysPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const [members, setMembers] = useState<any[]>([]);
  const [keys, setKeys] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [siteRole, setSiteRole] = useState("editor");
  const [rotatedKey, setRotatedKey] = useState<{ type: string; key: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadAll() {
    if (!siteId) return;
    const [mRes, kRes, aRes] = await Promise.allSettled([
      api<{ members: any[] }>(`/api/admin/sites/${siteId}/members`),
      api<{ keys: any[] }>(`/api/admin/sites/${siteId}/keys`),
      api<{ logs: any[] }>(`/api/admin/sites/${siteId}/audit-logs`),
    ]);
    if (mRes.status === "fulfilled") setMembers(mRes.value.members ?? []);
    if (kRes.status === "fulfilled") setKeys(kRes.value.keys ?? []);
    if (aRes.status === "fulfilled") setAuditLogs(aRes.value.logs ?? []);
  }

  useEffect(() => {
    loadAll();
  }, [siteId]);

  async function addMember() {
    if (!siteId || !email.trim()) return;
    setMsg(null);
    try {
      await api(`/api/admin/sites/${siteId}/members`, {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), siteRole }),
      });
      setEmail("");
      setMsg("Member role updated.");
      await loadAll();
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    }
  }

  async function removeMember(userId: string) {
    if (!siteId) return;
    try {
      await api(`/api/admin/sites/${siteId}/members/${userId}`, { method: "DELETE" });
      await loadAll();
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    }
  }

  async function rotateKey(type: "read" | "write" | "preview") {
    if (!siteId) return;
    try {
      const res = await api<{ type: string; key: string }>(`/api/admin/sites/${siteId}/keys/rotate`, {
        method: "POST",
        body: JSON.stringify({ type }),
      });
      setRotatedKey(res);
      await loadAll();
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    }
  }

  return (
    <div>
      <h1>Users, API Keys & Activity</h1>
      {msg && <div className="card" style={{ marginBottom: 16 }}>{msg}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <h2>Site Members & Permissions</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="User email" />
          <select value={siteRole} onChange={(e) => setSiteRole(e.target.value)}>
            <option value="viewer">Read-Only User (viewer)</option>
            <option value="editor">Content Editor (editor)</option>
            <option value="client_admin">Site Administrator (client_admin)</option>
            <option value="client_owner">Client Owner (client_owner)</option>
          </select>
          <button type="button" onClick={addMember}>Assign Role</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.email}</td>
                <td><span className="badge">{m.siteRole}</span></td>
                <td>
                  <button type="button" onClick={() => removeMember(m.userId)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2>API Keys</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button type="button" onClick={() => rotateKey("read")}>Rotate Read Key</button>
          <button type="button" onClick={() => rotateKey("preview")}>Rotate Preview Key</button>
          <button type="button" onClick={() => rotateKey("write")}>Rotate Write Key</button>
        </div>
        {rotatedKey && (
          <div style={{ padding: 12, background: "#fffbeb", marginBottom: 12 }}>
            <strong>New {rotatedKey.type} key (shown once):</strong>{" "}
            <code>{rotatedKey.key}</code>
          </div>
        )}
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Label</th>
              <th>Last Used</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id}>
                <td><span className="badge">{k.type}</span></td>
                <td>{k.label}</td>
                <td>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}</td>
                <td>{k.revokedAt ? "Revoked" : "Active"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Activity Logs</h2>
        {auditLogs.length === 0 ? (
          <p>No activity recorded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Entity</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td><code>{log.action}</code></td>
                  <td>{log.entityType}</td>
                  <td>{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
