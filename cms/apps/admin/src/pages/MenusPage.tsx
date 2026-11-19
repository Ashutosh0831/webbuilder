import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";

interface Menu { id: string; key: string; name: string; }
interface MenuItem { id: string; menuId: string; label: string; url: string | null; parentId: string | null; position: number; }

export default function MenusPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState("");
  const [menuName, setMenuName] = useState("");
  const [menuKey, setMenuKey] = useState("main");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("/");
  const [parentId, setParentId] = useState("");
  const [position, setPosition] = useState(0);
  const [editingId, setEditingId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadMenus = useCallback(async () => {
    if (!siteId) return;
    try {
      const result = await api<{ menus: Menu[] }>(`/api/admin/sites/${siteId}/menus`);
      const nextMenus = Array.isArray(result.menus) ? result.menus : [];
      setMenus(nextMenus);
      setSelectedMenuId((current) => nextMenus.some((menu) => menu.id === current) ? current : nextMenus.find((menu) => menu.key === "main")?.id ?? nextMenus[0]?.id ?? "");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load menus");
    }
  }, [siteId]);

  const loadItems = useCallback(async () => {
    if (!selectedMenuId) { setItems([]); return; }
    try {
      const result = await api<{ items: MenuItem[] }>(`/api/admin/menus/${selectedMenuId}/items`);
      setItems(Array.isArray(result.items) ? result.items : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load menu items");
    }
  }, [selectedMenuId]);

  useEffect(() => { void loadMenus(); }, [loadMenus]);
  useEffect(() => { void loadItems(); }, [loadItems]);

  async function createMenu(event: FormEvent) {
    event.preventDefault();
    if (!siteId || !menuName.trim() || !menuKey.trim()) return;
    setBusy(true); setMessage("");
    try {
      const result = await api<{ menu: Menu }>(`/api/admin/sites/${siteId}/menus`, { method: "POST", body: JSON.stringify({ name: menuName.trim(), key: menuKey.trim().toLowerCase() }) });
      setMenuName(""); setMenuKey("");
      await loadMenus(); setSelectedMenuId(result.menu.id); setMessage("Menu created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create menu");
    } finally { setBusy(false); }
  }

  function startEdit(item: MenuItem) {
    setEditingId(item.id); setLabel(item.label); setUrl(item.url ?? ""); setParentId(item.parentId ?? ""); setPosition(item.position);
  }

  function clearItemForm() {
    setEditingId(""); setLabel(""); setUrl("/"); setParentId(""); setPosition(items.length);
  }

  async function saveItem(event: FormEvent) {
    event.preventDefault();
    if (!selectedMenuId || !label.trim()) return;
    setBusy(true); setMessage("");
    const payload = { label: label.trim(), url: url.trim() || undefined, parentId: parentId || undefined, position };
    try {
      if (editingId) {
        await api(`/api/admin/menus/${selectedMenuId}/items/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
        setMessage("Menu item updated.");
      } else {
        await api(`/api/admin/menus/${selectedMenuId}/items`, { method: "POST", body: JSON.stringify(payload) });
        setMessage("Menu item added.");
      }
      clearItemForm(); await loadItems();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save menu item");
    } finally { setBusy(false); }
  }

  async function deleteItem(item: MenuItem) {
    if (!selectedMenuId) return;
    setBusy(true); setMessage("");
    try {
      await api(`/api/admin/menus/${selectedMenuId}/items/${item.id}`, { method: "DELETE" });
      if (editingId === item.id) clearItemForm();
      await loadItems(); setMessage("Menu item deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete menu item");
    } finally { setBusy(false); }
  }

  const selectedMenu = menus.find((menu) => menu.id === selectedMenuId);
  return <div>
    <h1>Navigation menus</h1>
    <p>Create the menu with key <code>main</code> to control the public website header.</p>
    {message && <div className="card" role="status">{message}</div>}
    <section className="card">
      <h2>Menus</h2>
      {menus.length ? <label style={{ display: "grid", gap: 6, maxWidth: 520 }}>Choose a menu
        <select value={selectedMenuId} onChange={(event) => { setSelectedMenuId(event.target.value); clearItemForm(); }}>
          {menus.map((menu) => <option key={menu.id} value={menu.id}>{menu.name} ({menu.key})</option>)}
        </select>
      </label> : <p>No menus created for this website yet.</p>}
      <form onSubmit={createMenu} className="row" style={{ marginTop: 16, flexWrap: "wrap" }}>
        <input aria-label="Menu name" placeholder="Menu name" value={menuName} onChange={(event) => setMenuName(event.target.value)} required />
        <input aria-label="Menu key" placeholder="Menu key (e.g. main)" value={menuKey} onChange={(event) => setMenuKey(event.target.value)} pattern="[a-z0-9-]+" required />
        <button disabled={busy}>{busy ? "Saving…" : "Create menu"}</button>
      </form>
    </section>

    {selectedMenu && <>
      <section className="card">
        <h2>{selectedMenu.name} items</h2>
        {items.length ? <table><thead><tr><th>Position</th><th>Label</th><th>URL</th><th>Parent</th><th>Actions</th></tr></thead><tbody>
          {items.map((item) => <tr key={item.id}><td>{item.position}</td><td>{item.label}</td><td><code>{item.url || "(entry link)"}</code></td><td>{items.find((candidate) => candidate.id === item.parentId)?.label || "—"}</td><td><button className="secondary" onClick={() => startEdit(item)} disabled={busy}>Edit</button> <button className="danger" onClick={() => void deleteItem(item)} disabled={busy}>Delete</button></td></tr>)}
        </tbody></table> : <p>This menu has no items yet.</p>}
      </section>

      <form className="card form-grid" onSubmit={saveItem}>
        <h2>{editingId ? "Edit menu item" : "Add menu item"}</h2>
        <label>Label<input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={100} required /></label>
        <label>URL<input value={url} onChange={(event) => setUrl(event.target.value)} maxLength={500} placeholder="/services or https://example.com" /></label>
        <label>Parent item<select value={parentId} onChange={(event) => setParentId(event.target.value)}><option value="">Top level</option>{items.filter((item) => item.id !== editingId && !items.some((candidate) => candidate.id === item.parentId)).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>Position<input type="number" min={0} value={position} onChange={(event) => setPosition(Number(event.target.value))} /></label>
        <div className="row"><button disabled={busy || !label.trim()}>{busy ? "Saving…" : editingId ? "Save item" : "Add item"}</button>{editingId && <button type="button" className="secondary" onClick={clearItemForm} disabled={busy}>Cancel</button>}</div>
      </form>
    </>}
  </div>;
}
