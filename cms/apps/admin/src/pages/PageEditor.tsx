/// <reference types="vite/client" />
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, getToken } from "../lib/api";

interface MediaAsset { id: string; filename: string; url: string; mime?: string; altText?: string | null; caption?: string | null; }
interface PageRevision { id: string; version: number; created_at: string; snapshot: { title: string; section_key: string; slug: string }; }

function inlineHtmlToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof Element)) return "";
  const content = Array.from(node.childNodes).map(inlineHtmlToMarkdown).join("");
  switch (node.tagName.toLowerCase()) {
    case "strong": case "b": return `**${content.trim()}**`;
    case "em": case "i": return `*${content.trim()}*`;
    case "a": return `[${content.trim()}](${node.getAttribute("href") ?? ""})`;
    case "br": return "\n";
    case "img": return `[Image: ${node.getAttribute("alt") ?? "image"}]`;
    default: return content;
  }
}

function docxHtmlToMarkdown(html: string): string {
  const parsedDocument = new DOMParser().parseFromString(html, "text/html");
  const renderBlock = (element: Element): string => {
    const tag = element.tagName.toLowerCase();
    const content = inlineHtmlToMarkdown(element).trim();
    if (/^h[1-6]$/.test(tag)) return `${"#".repeat(Number(tag[1]))} ${content}`;
    if (tag === "p") return content;
    if (tag === "ul" || tag === "ol") {
      return Array.from(element.children).filter((child) => child.tagName.toLowerCase() === "li")
        .map((item, index) => `${tag === "ol" ? `${index + 1}.` : "-"} ${inlineHtmlToMarkdown(item).trim()}`).join("\n");
    }
    if (tag === "table") {
      const rows = Array.from(element.querySelectorAll("tr")).map((row) =>
        `| ${Array.from(row.querySelectorAll("th,td")).map((cell) => inlineHtmlToMarkdown(cell).trim()).join(" | ")} |`
      );
      if (rows.length > 1) rows.splice(1, 0, `| ${Array.from(element.querySelectorAll("tr")[0]?.querySelectorAll("th,td") ?? []).map(() => "---").join(" | ")} |`);
      return rows.join("\n");
    }
    return content;
  };
  return Array.from(parsedDocument.body.children).map(renderBlock).filter(Boolean).join("\n\n");
}

function pdfItemsToText(items: Array<{ str: string; transform: number[]; height: number; hasEOL: boolean }>): string {
  const lines: string[] = [];
  let line = "";
  let baseline: number | null = null;
  let lineHeight = 0;

  const finishLine = () => {
    if (line.trim()) lines.push(line.trim());
    line = "";
    baseline = null;
    lineHeight = 0;
  };

  for (const item of items) {
    const text = item.str;
    if (!text) continue;
    const itemBaseline = item.transform[5] ?? 0;
    const threshold = Math.max(2, lineHeight * 0.45, item.height * 0.45);
    if (line && baseline !== null && Math.abs(itemBaseline - baseline) > threshold) finishLine();

    if (!line) {
      baseline = itemBaseline;
      lineHeight = item.height;
    }
    if (line && !/\s$/.test(line) && !/^\s/.test(text) && !/^[,.;:!?%)\]}]/.test(text) && !/[([{]$/.test(line)) {
      line += " ";
    }
    line += text;
    if (item.hasEOL) finishLine();
  }
  finishLine();
  return lines.join("\n");
}

type PreviewSectionData = { type: string; data: any };
type PreviewBlock = { type: "section"; section: PreviewSectionData } | { type: "content-section"; heading: PreviewSectionData; children: PreviewSectionData[] };

function renderPreviewMarkdown(value: unknown): ReactNode {
  const text = String(value ?? "");
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/(?!\/)[^\s)]*)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  const parts: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    if (match[3] !== undefined) parts.push(<strong key={match.index}>{match[3]}</strong>);
    else if (match[4] !== undefined) parts.push(<em key={match.index}>{match[4]}</em>);
    else {
      const href = match[2];
      const external = /^https?:\/\//i.test(href);
      parts.push(<a key={match.index} href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>{match[1]}</a>);
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function groupPreviewSections(sections: PreviewSectionData[]): PreviewBlock[] {
  const blocks: PreviewBlock[] = [];
  let active: Extract<PreviewBlock, { type: "content-section" }> | null = null;
  for (const section of sections) {
    if (section.type === "heading" && section.data?.level === 2) {
      active = { type: "content-section", heading: section, children: [] };
      blocks.push(active);
    } else if (active) {
      active.children.push(section);
    } else {
      blocks.push({ type: "section", section });
    }
  }
  return blocks;
}

function PreviewSection({ section }: { section: PreviewSectionData }) {
  const headingLevel = Math.min(Math.max(Number(section.data?.level) || 3, 3), 6);
  const HeadingTag = `h${headingLevel}` as "h3" | "h4" | "h5" | "h6";
  return (
    <section style={{ borderTop: "1px solid #e5e7eb", padding: "12px 0" }}>
      <strong className="badge">{section.type}</strong>
      {section.type === "hero" ? <><h1>{renderPreviewMarkdown(section.data.h1)}</h1><p>{renderPreviewMarkdown(section.data.subheadline)}</p></> : null}
      {section.type === "cta" ? <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "12px 0" }}>{(section.data.actions ?? [{ label: section.data.label, href: section.data.href }]).map((action: { label: string; href: string }, actionIndex: number) => <a key={actionIndex} href={action.href} style={{ display: "inline-block", padding: "10px 16px", borderRadius: 6, background: "#1a4d8f", color: "white", fontWeight: 600 }}>{renderPreviewMarkdown(action.label)}</a>)}</div> : null}
      {section.type === "booking" ? <div className="card"><h3>{renderPreviewMarkdown(section.data.title)}</h3>{section.data.subtitle && <p>{renderPreviewMarkdown(section.data.subtitle)}</p>}<p style={{ color: "#64748b" }}>The configured quote form will appear here on the live page.</p></div> : null}
      {section.type === "heading" ? <HeadingTag>{renderPreviewMarkdown(section.data.text)}</HeadingTag> : null}
      {section.type === "image" ? <figure><img src={section.data.src} alt={section.data.alt} style={{ maxWidth: "100%" }} />{section.data.caption && <figcaption>{renderPreviewMarkdown(section.data.caption)}</figcaption>}</figure> : null}
      {section.type === "text" ? <p style={{ whiteSpace: "pre-wrap" }}>{renderPreviewMarkdown(section.data.content)}</p> : null}
      {section.type === "faqs" ? <div style={{ display: "grid", gap: 10 }}>{section.data.items.map((item: any, itemIndex: number) => <details key={itemIndex} className="card" style={{ margin: 0 }}><summary style={{ cursor: "pointer", fontWeight: 600 }}>{renderPreviewMarkdown(item.question)}</summary><p>{renderPreviewMarkdown(item.answer)}</p></details>)}</div> : null}
      {section.type === "locations" ? <ul style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, padding: 0, listStyle: "none" }}>{section.data.areas.map((area: string, itemIndex: number) => <li key={itemIndex} className="card" style={{ margin: 0 }}>{renderPreviewMarkdown(area)}</li>)}</ul> : null}
      {section.type === "list" ? (
        section.data.items.length > 0 && section.data.items.every((item: string) => /^(?:\*\*)?Review\s+\d+:/i.test(item))
          ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>{section.data.items.map((item: string, itemIndex: number) => <blockquote key={itemIndex} className="card" style={{ margin: 0 }}>{renderPreviewMarkdown(item.replace(/^(?:\*\*)?Review\s+\d+:(?:\*\*)?\s*/, ""))}</blockquote>)}</div>
          : section.data.ordered ? <ol>{section.data.items.map((item: string, itemIndex: number) => <li key={itemIndex}>{renderPreviewMarkdown(item)}</li>)}</ol> : <ul>{section.data.items.map((item: string, itemIndex: number) => <li key={itemIndex}>{renderPreviewMarkdown(item)}</li>)}</ul>
      ) : null}
      {section.type === "table" ? <div style={{ overflowX: "auto" }}><table><thead><tr>{section.data.headers.map((header: string, cellIndex: number) => <th key={cellIndex}>{renderPreviewMarkdown(header)}</th>)}</tr></thead><tbody>{section.data.rows.map((row: string[], rowIndex: number) => <tr key={rowIndex}>{section.data.headers.map((_: string, cellIndex: number) => <td key={cellIndex}>{renderPreviewMarkdown(row[cellIndex] ?? "")}</td>)}</tr>)}</tbody></table></div> : null}
    </section>
  );
}


export default function PageEditor() {
  const { siteId, pageId } = useParams();
  const nav = useNavigate();
  
  const [sectionKey, setSectionKey] = useState("services");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [rawText, setRawText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [importingDocument, setImportingDocument] = useState(false);
  const [preview, setPreview] = useState<{ sections: Array<{ type: string; data: any }>; seo: Record<string, string>; warnings: string[] } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [expectedVersion, setExpectedVersion] = useState<number | null>(null);
  const [revisions, setRevisions] = useState<PageRevision[]>([]);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [restoringRevisionId, setRestoringRevisionId] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(Boolean(pageId));
  const [mediaItems, setMediaItems] = useState<MediaAsset[]>([]);
  const [selectedMediaId, setSelectedMediaId] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [imageCaption, setImageCaption] = useState("");
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!siteId || !pageId) return;
    api<{ page: any }>(`/api/admin/sites/${siteId}/pages/${pageId}`)
      .then(({ page }) => {
        setSectionKey(page.section_key);
        setTitle(page.title);
        setSlug(page.slug);
        setRawText(page.raw_content ?? "");
        setExpectedVersion(page.version);
      })
      .catch((e) => setImportError(e instanceof Error ? e.message : "Could not load page"))
      .finally(() => setLoadingPage(false));
  }, [siteId, pageId]);

  useEffect(() => {
    if (!siteId || !pageId) return;
    api<{ revisions: PageRevision[] }>(`/api/admin/sites/${siteId}/pages/${pageId}/revisions`)
      .then((result) => setRevisions(Array.isArray(result.revisions) ? result.revisions : []))
      .catch((e) => setRevisionError(e instanceof Error ? e.message : "Could not load revision history"));
  }, [siteId, pageId]);

  useEffect(() => {
    if (!siteId) return;
    api<{ media: MediaAsset[] }>(`/api/admin/sites/${siteId}/media`)
      .then(({ media }) => setMediaItems((media ?? []).filter((item) => !item.mime || item.mime.startsWith("image/"))))
      .catch((e) => setMediaError(e instanceof Error ? e.message : "Could not load media library"));
  }, [siteId]);
  const [loading, setLoading] = useState(false);

  function insertImageBlock(asset?: MediaAsset) {
    const selected = asset ?? mediaItems.find((item) => item.id === selectedMediaId);
    if (!selected) {
      setMediaError("Choose an image from the media library first.");
      return;
    }
    const alt = (imageAlt || selected.altText || "").replace(/\]/g, "\\]");
    const caption = imageCaption || selected.caption || "";
    const escapedCaption = caption.replace(/"/g, "'");
    const markdown = `![${alt}](${selected.url}${escapedCaption ? ` "${escapedCaption}"` : ""})`;
    const textarea = textAreaRef.current;
    const cursor = textarea?.selectionStart ?? rawText.length;
    const before = rawText.slice(0, cursor);
    const after = rawText.slice(cursor);
    const prefix = before && !before.endsWith("\n") ? "\n" : "";
    const suffix = after && !after.startsWith("\n") ? "\n" : "";
    const insertion = `${prefix}${markdown}${suffix}`;
    const nextText = `${before}${insertion}${after}`;
    setRawText(nextText);
    setPreview(null);
    setMediaError(null);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(before.length + insertion.length, before.length + insertion.length);
    });
  }

  async function uploadAndInsertImage(file?: File) {
    if (!siteId || !file) return;
    setUploadingMedia(true);
    setMediaError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("altText", imageAlt);
      const response = await fetch(`/api/admin/sites/${siteId}/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Image upload failed");
      }
      const { media } = await response.json() as { media: MediaAsset };
      setMediaItems((current) => [media, ...current]);
      setSelectedMediaId(media.id);
      insertImageBlock(media);
    } catch (e) {
      setMediaError(e instanceof Error ? e.message : "Image upload failed");
    } finally {
      setUploadingMedia(false);
      if (imageFileRef.current) imageFileRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!title || !slug || !rawText) {
      alert("Please fill all fields");
      return;
    }
    setLoading(true);
    try {
      if (pageId && expectedVersion !== null) {
        await api(`/api/admin/sites/${siteId}/pages/${pageId}`, {
          method: "PUT",
          body: JSON.stringify({ sectionKey, title, slug, rawText, expectedVersion }),
        });
      } else {
        await api(`/api/admin/sites/${siteId}/pages`, {
          method: "POST",
          body: JSON.stringify({ sectionKey, title, slug, rawText }),
        });
      }
      nav(`/sites/${siteId}`); // Go back to dashboard on success
    } catch (e: any) {
      // Show the exact error from the API (e.g. "Already exists")
      alert(e.message || "Failed to save page");
    } finally {
      setLoading(false);
    }
  }

  async function restoreRevision(revision: PageRevision) {
    if (!siteId || !pageId || expectedVersion === null) return;
    if (!window.confirm(`Restore version ${revision.version}? The current version will remain in history.`)) return;
    setRestoringRevisionId(revision.id);
    setRevisionError(null);
    try {
      const result = await api<{ page: any }>(`/api/admin/sites/${siteId}/pages/${pageId}/revisions/${revision.id}/restore`, {
        method: "POST",
        body: JSON.stringify({ expectedVersion }),
      });
      setSectionKey(result.page.section_key);
      setTitle(result.page.title);
      setSlug(result.page.slug);
      setRawText(result.page.raw_content ?? "");
      setExpectedVersion(result.page.version);
      setPreview(null);
      const history = await api<{ revisions: PageRevision[] }>(`/api/admin/sites/${siteId}/pages/${pageId}/revisions`);
      setRevisions(history.revisions ?? []);
    } catch (e) {
      setRevisionError(e instanceof Error ? e.message : "Could not restore this revision");
    } finally {
      setRestoringRevisionId(null);
    }
  }

  async function importDocument(file?: File) {
    if (!file) return;
    setImportError(null);
    setImportNotice(null);
    setImportingDocument(true);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("Choose a document smaller than 20 MB.");
      const filename = file.name.toLowerCase();
      if (!/\.(txt|md|markdown|docx|pdf)$/.test(filename)) {
        throw new Error("Choose a .txt, .md, .markdown, .docx, or .pdf file.");
      }
      let extractedText: string;
      let notice: string | null = null;
      if (filename.endsWith(".docx")) {
        const { default: mammoth } = await import("mammoth");
        const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
        const imageCount = result.value.match(/<img\b/gi)?.length ?? 0;
        extractedText = docxHtmlToMarkdown(result.value);
        if (imageCount > 0) notice = `This DOCX contains ${imageCount} embedded image${imageCount === 1 ? "" : "s"}. Image files are not copied to the media library; add them with the image block below.`;
      } else if (filename.endsWith(".pdf")) {
        const pdfjsLib = await import("pdfjs-dist");
        const { default: pdfWorker } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
        const document = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        const pages: string[] = [];
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          const page = await document.getPage(pageNumber);
          const content = await page.getTextContent();
          pages.push(pdfItemsToText(content.items.filter((item): item is typeof item & { str: string; transform: number[]; height: number; hasEOL: boolean } => "str" in item)));
        }
        extractedText = pages.join("\n\n");
        notice = "PDF import extracts selectable text only. Add any images using the image block below.";
      } else {
        extractedText = await file.text();
      }
      if (!extractedText.trim()) throw new Error("No selectable text was found. Scanned PDFs need OCR before import.");
      if (rawText.trim() && rawText.trim() !== extractedText.trim() && !window.confirm("Importing this file will replace the text currently in the editor. Continue?")) return;
      setRawText(extractedText);
      setImportNotice(notice);
      setPreview(null);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Could not read this document.");
    } finally {
      setImportingDocument(false);
    }
  }

  if (loadingPage) return <p>Loading page...</p>;

  async function previewDocument() {
    if (!siteId || !rawText.trim()) return;
    setPreviewing(true);
    setImportError(null);
    try {
      setPreview(await api(`/api/admin/sites/${siteId}/pages/preview`, {
        method: "POST",
        body: JSON.stringify({ rawText }),
      }));
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Could not preview document");
    } finally {
      setPreviewing(false);
    }
  }

  const previewBlocks = preview ? groupPreviewSections(preview.sections) : [];

  return (
    <div>
      <h1>{pageId ? "Edit Draft Page" : "Create New Page"}</h1>
      
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
              const cleanSlug = e.target.value
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9-]+/g, "-")
                .replace(/-+/g, "-")
                .replace(/^-|-$/g, "");
              setSlug(cleanSlug);
            }} 
            placeholder="lizard-control" 
          />
        </label>
      </div>

      <div className="card">
        <h2>Paste Your Document</h2>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          Paste text or Markdown, or import a .txt, .md, .docx, or text-based .pdf file (up to 20 MB). Scanned PDFs need OCR before import. The CMS parses the content when you preview or save.
        </p>
        <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
          {importingDocument ? "Reading document…" : "Import a document"}
          <input type="file" disabled={importingDocument} accept=".txt,.md,.markdown,.docx,.pdf,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            void importDocument(file);
          }} />
        </label>
        {importingDocument && <p role="status" aria-live="polite">Extracting document text…</p>}
        {importError && <p role="alert" style={{ color: "#b91c1c" }}>{importError}</p>}
        {importNotice && <p role="status" style={{ color: "#475569" }}>{importNotice}</p>}
        <textarea 
          ref={textAreaRef}
          rows={20} 
          style={{ width: '100%', fontFamily: 'monospace', padding: 10 }}
          value={rawText}
          onChange={e => {
            setRawText(e.target.value);
            setPreview(null);
          }}
          placeholder="Paste the markdown/text here..."
        />
        <div className="card" style={{ marginTop: 16, background: "#f8fafc" }}>
          <h3>Add an image block</h3>
          <div className="form-grid">
            <label>Media library image
              <select value={selectedMediaId} onChange={(e) => {
                const id = e.target.value;
                setSelectedMediaId(id);
                const asset = mediaItems.find((item) => item.id === id);
                setImageAlt(asset?.altText ?? "");
                setImageCaption(asset?.caption ?? "");
              }}>
                <option value="">Choose an image</option>
                {mediaItems.map((item) => <option key={item.id} value={item.id}>{item.filename}</option>)}
              </select>
            </label>
            <label>Alt text<input value={imageAlt} onChange={(e) => setImageAlt(e.target.value)} placeholder="Describe the image" /></label>
            <label>Caption<input value={imageCaption} onChange={(e) => setImageCaption(e.target.value)} placeholder="Optional caption" /></label>
            <div className="row">
              <button type="button" onClick={() => insertImageBlock()} disabled={!selectedMediaId}>Insert image at cursor</button>
              <label>Upload and insert
                <input ref={imageFileRef} type="file" accept="image/*" onChange={(e) => uploadAndInsertImage(e.target.files?.[0])} disabled={uploadingMedia} />
              </label>
            </div>
          </div>
          {mediaError && <p role="alert" style={{ color: "#b91c1c" }}>{mediaError}</p>}
          {selectedMediaId && <img src={mediaItems.find((item) => item.id === selectedMediaId)?.url} alt={imageAlt} style={{ maxWidth: 220, maxHeight: 140, objectFit: "contain", marginTop: 12 }} />}
        </div>
        <button type="button" className="secondary" onClick={previewDocument} disabled={previewing || !rawText.trim()} style={{ marginTop: 12 }}>
          {previewing ? "Parsing..." : "Preview parsed content"}
        </button>
      </div>

      {preview && <div className="card" style={{ marginTop: 16 }}>
        <h2>Parsed preview</h2>
        {preview.warnings?.length > 0 && <div role="alert" className="card" style={{ borderColor: "#f59e0b", color: "#92400e" }}>
          Replace these placeholders before publishing: {preview.warnings.join(", ")}
        </div>}
        {Object.entries(preview.seo).length > 0 && <p>SEO: {Object.entries(preview.seo).map(([key, value]) => `${key}: ${value}`).join(" · ")}</p>}
        {preview.sections.length === 0 ? <p>No page sections were recognized.</p> : previewBlocks.map((block, index) => block.type === "content-section" ? (
          <section key={`preview-section-${index}`} className="card">
            <h2>{block.heading.data.text}</h2>
            {block.children.map((section, childIndex) => <PreviewSection key={`${section.type}-${childIndex}`} section={section} />)}
          </section>
        ) : <PreviewSection key={`${block.section.type}-${index}`} section={block.section} />)}
      </div>}

      {pageId && <section className="card" style={{ marginTop: 16 }}>
        <h2>Revision history</h2>
        {revisionError && <p role="alert" style={{ color: "#b91c1c" }}>{revisionError}</p>}
        {revisions.length === 0 ? <p>No saved revisions yet. Earlier versions appear here after the page is edited.</p> : <ul style={{ paddingLeft: 20 }}>
          {revisions.map((revision) => <li key={revision.id} style={{ marginBottom: 12 }}>
            <strong>Version {revision.version}</strong> · {revision.snapshot?.title || "Untitled"} · {new Date(revision.created_at).toLocaleString()}{" "}
            <button type="button" className="secondary" onClick={() => restoreRevision(revision)} disabled={restoringRevisionId !== null || expectedVersion === null}>
              {restoringRevisionId === revision.id ? "Restoring…" : "Restore"}
            </button>
          </li>)}
        </ul>}
      </section>}

      <button onClick={handleSave} disabled={loading} style={{ marginTop: 20, padding: "10px 20px", fontSize: "16px" }}>
        {loading ? "Saving..." : pageId ? "Update Draft" : "Save Draft"}
      </button>
    </div>
  );
}
