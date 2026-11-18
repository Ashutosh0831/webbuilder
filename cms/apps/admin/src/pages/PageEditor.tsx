import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, getToken } from "../lib/api";

export default function PageEditor() {
  const { siteId, pageId } = useParams();
  const nav = useNavigate();
  
  const [sectionKey, setSectionKey] = useState("services");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [rawText, setRawText] = useState("");
  const [expectedVersion, setExpectedVersion] = useState<number | null>(null);
  const [loadingPage, setLoadingPage] = useState(Boolean(pageId));
  
  // Status tracking
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!siteId || !pageId) return;
    api<{ page: any }>(`/api/admin/sites/${siteId}/pages/${pageId}`)
      .then(({ page }) => {
        setSectionKey(page.section_key);
        setTitle(page.title);
        setSlug(page.slug);
        setRawText(page.raw_content ?? "");
        setExpectedVersion(page.version);
        setStatus(page.status); // Set the status here!
      })
      .catch((e) => alert(e.message))
      .finally(() => setLoadingPage(false));
  }, [siteId, pageId]);

  async function handleSave(isPublishing = false) {
    if (!title || !slug || !rawText) {
      alert("Please fill all fields");
      return;
    }
    setLoading(true);
    try {
      let currentId = pageId;

      // 1. Save the page (Create or Update)
      if (currentId && expectedVersion !== null) {
        await api(`/api/admin/sites/${siteId}/pages/${currentId}`, {
          method: "PUT",
          body: JSON.stringify({ sectionKey, title, slug, rawText, expectedVersion }),
        });
      } else {
        const res = await api<{ page: any }>(`/api/admin/sites/${siteId}/pages`, {
          method: "POST",
          body: JSON.stringify({ sectionKey, title, slug, rawText }),
        });
        currentId = res.page.id;
      }

      // 2. If the user clicked Publish, trigger the publish endpoint
      if (isPublishing && currentId) {
        await api(`/api/admin/sites/${siteId}/pages/${currentId}/publish`, {
          method: "POST",
        });
        alert("Page Published successfully!");
      } else {
        alert("Draft saved successfully!");
      }

      nav(`/sites/${siteId}`); // Go back to dashboard
    } catch (e: any) {
      // Show the exact API error (e.g., "Replace unresolved placeholders")
      alert(e.message || "Failed to save page");
    } finally {
      setLoading(false);
    }
  }

  if (loadingPage) return <p>Loading page...</p>;

  return (
    <div>
      <h1>{pageId ? "Edit Page" : "Create New Page"}</h1>
      
      <div className="card form-grid" style={{ marginBottom: 20 }}>
        <label>
          Section
          <select value={sectionKey} onChange={e => setSectionKey(e.target.value)}>
            <option value="services">Services</option>
            <option value="locations">Locations</option>
            <option value="blogs">Blogs</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label>
          Page Title
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Lizard Control" />
        </label>

        <label>
          URL Slug
          <input 
            value={slug} 
            onChange={e => {
              const cleanSlug = e.target.value.toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-");
              setSlug(cleanSlug);
            }} 
            placeholder="lizard-control" 
          />
        </label>
      </div>

      <div className="card">
        <h2>Paste Your Document</h2>
        <textarea 
          rows={20} 
          style={{ width: '100%', fontFamily: 'monospace', padding: 10 }}
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          placeholder="Paste the markdown/text here..."
        />
      </div>

      <div style={{ display: "flex", gap: "10px", marginTop: 20 }}>
        {/* Save Draft Button */}
        <button 
          onClick={() => handleSave(false)} 
          disabled={loading} 
          style={{ padding: "10px 20px", fontSize: "16px", background: "#e2e8f0", color: "#333" }}
        >
          {loading ? "Saving..." : "Save Draft"}
        </button>

        {/* Publish Button */}
        <button 
          onClick={() => handleSave(true)} 
          disabled={loading} 
          style={{ padding: "10px 20px", fontSize: "16px", background: "#10b981", color: "white" }}
        >
          {loading ? "Publishing..." : status === "published" ? "Update & Publish" : "Publish Page"}
        </button>
      </div>
    </div>
  );
}