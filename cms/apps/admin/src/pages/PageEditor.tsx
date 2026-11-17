import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function PageEditor() {
  const { siteId } = useParams();
  const nav = useNavigate();
  
  const [sectionKey, setSectionKey] = useState("services");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!title || !slug || !rawText) {
      alert("Please fill all fields");
      return;
    }
    setLoading(true);
    try {
      await api(`/api/admin/sites/${siteId}/pages`, {
        method: "POST",
        body: JSON.stringify({ sectionKey, title, slug, rawText }),
      });
      nav(`/sites/${siteId}`); // Go back to dashboard on success
    } catch (e: any) {
      // Show the exact error from the API (e.g. "Already exists")
      alert(e.message || "Failed to save page");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>Create New Page</h1>
      
      <div className="card form-grid" style={{ marginBottom: 20 }}>
        <label>
          Section (Where does this page belong?)
          <select value={sectionKey} onChange={e => setSectionKey(e.target.value)}>
            <option value="services">Services</option>
            <option value="locations">Locations</option>
            <option value="blogs">Blogs</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label>
          Page Title (Shown in Navbar)
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Lizard Control" />
        </label>

        <label>
          URL Slug (e.g., lizard-control)
          <input 
            value={slug} 
            onChange={e => {
              // Automatically clean the slug: lowercase, no spaces, no slashes
              const cleanSlug = e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '');
              setSlug(cleanSlug);
            }} 
            placeholder="lizard-control" 
          />
        </label>
      </div>

      <div className="card">
        <h2>Paste Your Document</h2>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          Paste the entire text (H1, FAQs, Locations). The CMS will parse it into sections automatically.
        </p>
        <textarea 
          rows={20} 
          style={{ width: '100%', fontFamily: 'monospace', padding: 10 }}
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          placeholder="Paste the markdown/text here..."
        />
      </div>

      <button onClick={handleSave} disabled={loading} style={{ marginTop: 20, padding: "10px 20px", fontSize: "16px" }}>
        {loading ? "Parsing & Publishing..." : "Publish Page"}
      </button>
    </div>
  );
}