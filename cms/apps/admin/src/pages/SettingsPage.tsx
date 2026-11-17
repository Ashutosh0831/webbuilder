import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";

export default function SettingsPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) return;
    api<{ settings: any[] }>(`/api/admin/sites/${siteId}/settings`).then((r) => {
      const obj: Record<string, string> = {};
      for (const s of r.settings) obj[s.key] = typeof s.value === "string" ? s.value : JSON.stringify(s.value);
      setSettings(obj);
    });
  }, [siteId]);

  function set(key: string, value: string) {
    setSettings({ ...settings, [key]: value });
  }

  async function save() {
    if (!siteId) return;
    setBusy(true);
    try {
      const items = Object.entries(settings).map(([key, value]) => ({ key, value }));
      await api(`/api/admin/sites/${siteId}/settings`, {
        method: "PUT",
        body: JSON.stringify({ settings: items }),
      });
      setMsg("Saved");
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  const keys = ["area_name", "brand_name", "phone", "service_area"];
  return (
    <div>
      <h1>Settings</h1>
      {msg && <div className="card">{msg}</div>}
      <div className="card">
        <div className="form-grid">
          {keys.map((k) => (
            <label key={k}>
              {k}
              <input
                value={settings[k] ?? ""}
                onChange={(e) => set(k, e.target.value)}
              />
            </label>
          ))}
        </div>
        <button onClick={save} disabled={busy} style={{ marginTop: 12 }}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}