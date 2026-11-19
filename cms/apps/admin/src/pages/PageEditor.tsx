import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { normalizePublicSiteUrl } from "../lib/siteUrl";
import { pagePathForSection } from "../lib/pagePath";

interface Diagnostic {
  code: string;
  message: string;
  line?: number;
}

interface PreviewResult {
  schemaVersion?: string;
  sections: PreviewSection[];
  seo: { title?: string; description?: string; canonical?: string };
  diagnostics?: Diagnostic[];
  errors?: Diagnostic[];
  unresolvedPlaceholders?: string[];
  unknownSections?: string[];
}

interface PreviewSection { type: string; data: Record<string, unknown>; }
interface MediaAsset { id: string; filename: string; url: string; mime: string; altText?: string | null; caption?: string | null; }
interface ReviewHistoryItem { id: string; action: string; actorId?: string | null; assignedReviewerId?: string | null; comment?: string | null; createdAt: string; pageVersion: number; }

function previewString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function previewUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch { return null; }
}

function localDateTimeInput(value: unknown): string {
  if (typeof value !== "string" && !(value instanceof Date)) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function requestErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const details = "details" in error ? error.details : undefined;
  if (typeof details === "object" && details !== null && "placeholders" in details && Array.isArray(details.placeholders)) {
    return `${error.message}. Replace these unresolved placeholders: ${details.placeholders.join(", ")}`;
  }
  if (details !== undefined) return `${error.message}. Details: ${JSON.stringify(details)}`;
  return error.message;
}

function renderPreviewSection(section: PreviewSection, index: number) {
  const data = section.data ?? {};
  const heading = previewString(data.h1 ?? data.headline ?? data.title);
  if (section.type === "hero") return <header className="cms-hero" key={index}><h1>{heading || "Page heading"}</h1>{data.subheadline ? <p>{previewString(data.subheadline)}</p> : null}</header>;
  if (section.type === "introduction" || section.type === "custom") return <section className="cms-content-section" key={index}>{data.title ? <h2>{previewString(data.title)}</h2> : null}<div className="cms-copy">{previewString(data.content).split(/\n{2,}/).map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}</div></section>;
  if (section.type === "services" || section.type === "features") {
    const items = Array.isArray(data.items) ? data.items : [];
    return <section className="cms-content-section" key={index}>{data.title ? <h2>{previewString(data.title)}</h2> : null}<ul className="cms-list">{items.map((value, itemIndex) => { const item = typeof value === "object" && value !== null ? value as Record<string, unknown> : {}; return <li key={itemIndex}><strong>{previewString(item.name ?? item.title ?? value)}</strong>{item.description ? ` — ${previewString(item.description)}` : ""}</li>; })}</ul></section>;
  }
  if (section.type === "testimonials") {
    const items = Array.isArray(data.items) ? data.items : [];
    return <section className="cms-content-section" key={index}>{data.title ? <h2>{previewString(data.title)}</h2> : null}<div className="cms-testimonial-grid">{items.map((value, itemIndex) => { const item = typeof value === "object" && value !== null ? value as Record<string, unknown> : {}; return <blockquote className="cms-testimonial" key={itemIndex}><p>{previewString(item.quote ?? value)}</p>{item.author ? <cite>— {previewString(item.author)}</cite> : null}</blockquote>; })}</div></section>;
  }
  if (section.type === "heading") {
    const level = Math.max(3, Math.min(6, Number(data.level) || 3));
    const Heading = `h${level}` as "h3" | "h4" | "h5" | "h6";
    return <Heading className="cms-subheading" key={index}>{previewString(data.text)}</Heading>;
  }
  if (section.type === "text") return <div className="cms-copy" key={index}>{previewString(data.content).split(/\n{2,}/).map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}</div>;
  if (section.type === "image") {
    const src = previewUrl(data.src);
    return <figure className="cms-image" key={index}>{src ? <img src={src} alt={previewString(data.alt)} /> : <div className="website-preview-image-empty">Image URL is missing or invalid</div>}{data.caption ? <figcaption>{previewString(data.caption)}</figcaption> : null}</figure>;
  }
  if (section.type === "list" || section.type === "locations") {
    const values = Array.isArray(data.items) ? data.items : Array.isArray(data.areas) ? data.areas : [];
    const List = data.ordered ? "ol" : "ul";
    return <List className={section.type === "locations" ? "cms-location-grid" : `cms-list ${data.ordered ? "cms-list-ordered" : ""}`} key={index}>{values.map((item, itemIndex) => <li key={itemIndex}>{previewString(item)}</li>)}</List>;
  }
  if (section.type === "faqs") {
    const items = Array.isArray(data.items) ? data.items : [];
    return <div className="cms-faq-list" key={index}>{items.map((item, itemIndex) => {
      const faq = typeof item === "object" && item !== null ? item as Record<string, unknown> : {};
      return <details className="cms-faq-item" key={itemIndex}><summary>{previewString(faq.question, "Question")}</summary><p>{previewString(faq.answer)}</p></details>;
    })}</div>;
  }
  if (section.type === "cta") {
    const actions = Array.isArray(data.actions) ? data.actions : [{ label: data.label, href: data.href }];
    return <div className="cms-cta" key={index}>{data.title ? <h2>{previewString(data.title)}</h2> : null}{data.text ? <p>{previewString(data.text)}</p> : null}<div className="cms-cta-buttons">{actions.map((item, actionIndex) => {
      const action = typeof item === "object" && item !== null ? item as Record<string, unknown> : {};
      const href = previewUrl(action.href);
      return href ? <a key={actionIndex} href={href}>{previewString(action.label, "Learn more")}</a> : <span className="website-preview-invalid-link" key={actionIndex}>{previewString(action.label, "Button")}: link missing or invalid</span>;
    })}</div></div>;
  }
  if (section.type === "table") {
    const headers = Array.isArray(data.headers) ? data.headers.map((item) => previewString(item)) : [];
    const rows = Array.isArray(data.rows) ? data.rows : [];
    return <div className="cms-table-wrap" key={index}><table className="cms-table"><thead><tr>{headers.map((cell, cellIndex) => <th key={cellIndex}>{cell}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, cellIndex) => <td key={cellIndex}>{Array.isArray(row) ? previewString(row[cellIndex]) : ""}</td>)}</tr>)}</tbody></table></div>;
  }
  if (section.type === "booking") return <div className="cms-booking-preview" key={index}><h2>{previewString(data.title, "Booking form")}</h2><p>{previewString(data.subtitle, "A booking form will appear here on the public site.")}</p></div>;
  return <details className="website-preview-unsupported" key={index}><summary>Unsupported block: {section.type || "unknown"}</summary><pre>{JSON.stringify(data, null, 2)}</pre></details>;
}

function groupPreviewSections(sections: PreviewSection[]) {
  const blocks: Array<{ heading?: PreviewSection; children?: PreviewSection[] } | PreviewSection> = [];
  let active: { heading: PreviewSection; children: PreviewSection[] } | undefined;
  for (const section of sections) {
    if (section.type === "heading" && Number(section.data?.level) === 2) {
      active = { heading: section, children: [] };
      blocks.push(active);
    } else if (active) active.children.push(section);
    else blocks.push(section);
  }
  return blocks;
}

export default function PageEditor() {
  const { siteId, pageId } = useParams();
  const nav = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [sectionKey, setSectionKey] = useState("services");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [rawText, setRawText] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoCanonical, setSeoCanonical] = useState("");
  const [seoOgImage, setSeoOgImage] = useState("");
  const [seoRobots, setSeoRobots] = useState("index,follow");

  const [expectedVersion, setExpectedVersion] = useState<number | null>(null);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [approvalStatus, setApprovalStatus] = useState<"draft" | "in_review" | "approved" | "rejected">("draft");
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [assignedReviewerId, setAssignedReviewerId] = useState("");
  const [reviewers, setReviewers] = useState<Array<{ userId: string; name: string; email: string; siteRole: string }>>([]);
  const [reviewHistory, setReviewHistory] = useState<ReviewHistoryItem[]>([]);
  const [scheduleInput, setScheduleInput] = useState("");
  const [scheduledPublishAt, setScheduledPublishAt] = useState("");
  const [scheduledUnpublishAt, setScheduledUnpublishAt] = useState("");
  const [publicUrl, setPublicUrl] = useState("");
  const [previewSettings, setPreviewSettings] = useState<Record<string, string>>({});

  const [loadingPage, setLoadingPage] = useState(Boolean(pageId));
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [compareRevision, setCompareRevision] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"editor" | "preview" | "seo" | "revisions">("editor");
  const [splitView, setSplitView] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    api<{ settings: Array<{ key: string; value: unknown }> }>(`/api/admin/sites/${siteId}/settings`)
      .then((res) => {
        const values = Object.fromEntries((res.settings ?? []).map(({ key, value }) => [key, typeof value === "string" ? value : ""]));
        setPreviewSettings(values);
        setPublicUrl(normalizePublicSiteUrl(values.public_url));
      })
      .catch(() => { setPublicUrl(""); setPreviewSettings({}); });
    api<{ members: Array<{ userId: string; name: string; email: string; siteRole: string }> }>(`/api/admin/sites/${siteId}/members`)
      .then((res) => setReviewers((res.members ?? []).filter((member) => ["client_admin", "client_owner"].includes(member.siteRole))))
      .catch(() => setReviewers([]));
  }, [siteId]);

  useEffect(() => {
    if (!siteId || !pageId) return;
    setLoadingPage(true);
    api<{ page: any }>(`/api/admin/sites/${siteId}/pages/${pageId}`)
      .then(({ page }) => {
        const draft = page.draft_content
          ? typeof page.draft_content === "string"
            ? JSON.parse(page.draft_content)
            : page.draft_content
          : null;

        setSectionKey(draft?.section_key ?? page.section_key);
        setTitle(draft?.title ?? page.title);
        setSlug(draft?.slug ?? page.slug);
        setRawText(draft?.raw_content ?? page.raw_content ?? "");
        setSeoTitle(draft?.seo_title ?? page.seo_title ?? "");
        setSeoDescription(draft?.seo_description ?? page.seo_description ?? "");
        setSeoCanonical(draft?.seo_canonical ?? page.seo_canonical ?? "");
        setSeoOgImage(draft?.seo_og_image ?? page.seo_og_image ?? "");
        setSeoRobots(draft?.seo_robots ?? page.seo_robots ?? "index,follow");
        setExpectedVersion(page.version);
        setStatus(page.status);
        setApprovalStatus(page.approval_status ?? "draft");
        setAssignedReviewerId(page.assigned_reviewer_id ?? "");
        setReviewComment(page.approval_status === "in_review" ? "" : page.review_comment ?? "");
        setHasUnpublishedChanges(Boolean(page.has_unpublished_changes));
        setScheduledPublishAt(page.scheduled_publish_at ?? "");
        setScheduledUnpublishAt(page.scheduled_unpublish_at ?? "");
        setScheduleInput(localDateTimeInput(page.scheduled_publish_at ?? page.scheduled_unpublish_at));
      })
      .catch((e) => setFeedback({ type: "err", text: e.message }))
      .finally(() => setLoadingPage(false));

    loadRevisions();
    loadReviewHistory();
  }, [siteId, pageId]);

  async function loadRevisions() {
    if (!siteId || !pageId) return;
    try {
      const res = await api<{ revisions: any[] }>(`/api/admin/sites/${siteId}/pages/${pageId}/revisions`);
      setRevisions(res.revisions ?? []);
    } catch {
      // ignore
    }
  }

  async function loadReviewHistory() {
    if (!siteId || !pageId) return;
    try {
      const result = await api<{ history: ReviewHistoryItem[] }>(`/api/admin/sites/${siteId}/pages/${pageId}/review-history`);
      setReviewHistory(result.history ?? []);
    } catch {
      setReviewHistory([]);
    }
  }

  async function runPreview() {
    if (!siteId || !rawText.trim()) return;
    setPreviewing(true);
    try {
      const res = await api<PreviewResult>(`/api/admin/sites/${siteId}/pages/preview`, {
        method: "POST",
        body: JSON.stringify({ rawText }),
      });
      setPreview(res);
      setActiveTab("preview");
    } catch (e: any) {
      setFeedback({ type: "err", text: e.message || "Preview failed" });
    } finally {
      setPreviewing(false);
    }
  }

  useEffect(() => {
    if (!splitView || activeTab !== "editor" || !siteId) return;
    if (!rawText.trim()) {
      setPreview(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      setPreviewing(true);
      try {
        const result = await api<PreviewResult>(`/api/admin/sites/${siteId}/pages/preview`, {
          method: "POST",
          body: JSON.stringify({ rawText }),
        });
        setPreview(result);
      } catch (error) {
        setFeedback({ type: "err", text: error instanceof Error ? error.message : "Preview failed" });
      } finally {
        setPreviewing(false);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [rawText, splitView, activeTab, siteId]);

  async function openMediaPicker() {
    if (!siteId) return;
    setMediaPickerOpen(true);
    setMediaLoading(true);
    try {
      const result = await api<{ media: MediaAsset[] }>(`/api/admin/sites/${siteId}/media`);
      setMediaAssets(result.media ?? []);
    } catch (e) {
      setFeedback({ type: "err", text: e instanceof Error ? e.message : "Could not load the media library." });
      setMediaPickerOpen(false);
    } finally {
      setMediaLoading(false);
    }
  }

  function insertImage(asset: MediaAsset) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? rawText.length;
    const end = textarea?.selectionEnd ?? rawText.length;
    const alt = (asset.altText?.trim() || asset.filename.replace(/\.[^.]+$/, "")).replace(/[\[\]\\]/g, " ").trim();
    const imageMarkdown = `![${alt}](${asset.url})`;
    const before = rawText.slice(0, start);
    const after = rawText.slice(end);
    const prefix = before.length === 0 || before.endsWith("\n") ? "" : "\n\n";
    const suffix = after.length === 0 || after.startsWith("\n") ? "" : "\n\n";
    const insertedText = `${prefix}${imageMarkdown}${suffix}`;
    const nextText = `${before}${insertedText}${after}`;
    setRawText(nextText);
    setMediaPickerOpen(false);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const cursor = before.length + insertedText.length;
      textareaRef.current?.setSelectionRange(cursor, cursor);
    });
  }

  async function handleSave(): Promise<string | null> {
    if (!title.trim() || !slug.trim() || !rawText.trim()) {
      setFeedback({ type: "err", text: "Title, slug, and document content are required." });
      return null;
    }
    setSaving(true);
    setFeedback(null);
    try {
      let currentId = pageId;
      const payload = {
        sectionKey,
        title: title.trim(),
        slug: slug.trim(),
        rawText,
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
        seoCanonical: seoCanonical.trim() || null,
        seoOgImage: seoOgImage.trim() || null,
        seoRobots: seoRobots.trim() || null,
      };

      if (currentId && expectedVersion !== null) {
        const res = await api<{ page: any }>(`/api/admin/sites/${siteId}/pages/${currentId}`, {
          method: "PUT",
          body: JSON.stringify({ ...payload, expectedVersion }),
        });
        setExpectedVersion(res.page.version);
        setHasUnpublishedChanges(Boolean(res.page.has_unpublished_changes));
        setApprovalStatus(res.page.approval_status ?? "draft");
      } else {
        const res = await api<{ page: any }>(`/api/admin/sites/${siteId}/pages`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        currentId = res.page.id;
        setExpectedVersion(res.page.version);
        setApprovalStatus(res.page.approval_status ?? "draft");
      }

      setFeedback({ type: "ok", text: status === "published" ? "Draft changes saved (live version unchanged)." : "Draft saved." });

      if (!pageId && currentId) {
        nav(`/sites/${siteId}/pages/${currentId}/edit`, { replace: true });
      } else {
        await loadRevisions();
      }
      return currentId ?? null;
    } catch (e: any) {
      setFeedback({ type: "err", text: requestErrorMessage(e) || "Failed to save page" });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitReview() {
    if (!siteId) return;
    const currentId = await handleSave();
    if (!currentId) return;
    setSaving(true);
    setFeedback(null);
    try {
      const result = await api<{ page: any }>(`/api/admin/sites/${siteId}/pages/${currentId}/submit-review`, {
        method: "POST",
        body: JSON.stringify({ assignedReviewerId: assignedReviewerId || null, comment: reviewComment.trim() || undefined }),
      });
      setApprovalStatus(result.page.approval_status);
      setExpectedVersion(result.page.version);
      setReviewComment("");
      setFeedback({ type: "ok", text: "Page submitted for review. The live version remains unchanged until approval and publishing." });
      await loadReviewHistory();
    } catch (e) {
      setFeedback({ type: "err", text: requestErrorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  async function handleReviewDecision(decision: "approve" | "reject") {
    if (!siteId || !pageId) return;
    if (decision === "reject" && !reviewComment.trim()) {
      setFeedback({ type: "err", text: "Add a review comment before rejecting this page." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const result = await api<{ page: any }>(`/api/admin/sites/${siteId}/pages/${pageId}/${decision}`, {
        method: "POST",
        body: JSON.stringify({ comment: reviewComment.trim() }),
      });
      setApprovalStatus(result.page.approval_status);
      setExpectedVersion(result.page.version);
      setReviewComment(result.page.review_comment ?? "");
      setFeedback({ type: "ok", text: decision === "approve" ? "Page approved. A site administrator can publish the approved version." : "Page rejected and returned for editing." });
      await loadReviewHistory();
    } catch (e) {
      setFeedback({ type: "err", text: requestErrorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!siteId || !pageId) return;
    setSaving(true);
    setFeedback(null);
    try {
      const result = await api<{ page: any }>(`/api/admin/sites/${siteId}/pages/${pageId}/publish`, { method: "POST" });
      setStatus(result.page.status);
      setApprovalStatus(result.page.approval_status ?? "draft");
      setExpectedVersion(result.page.version);
      setHasUnpublishedChanges(Boolean(result.page.has_unpublished_changes));
      setScheduledPublishAt(result.page.scheduled_publish_at ?? "");
      setScheduledUnpublishAt(result.page.scheduled_unpublish_at ?? "");
      setFeedback({ type: "ok", text: "Approved page published and website refresh queued." });
      await loadReviewHistory();
    } catch (e) {
      setFeedback({ type: "err", text: requestErrorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  async function handleSchedule(action: "publish" | "unpublish") {
    if (!siteId || !pageId || !scheduleInput) {
      setFeedback({ type: "err", text: "Choose a date and time first." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const endpoint = action === "publish" ? "schedule-publish" : "schedule-unpublish";
      const result = await api<{ page: any }>(`/api/admin/sites/${siteId}/pages/${pageId}/${endpoint}`, {
        method: "POST",
        body: JSON.stringify({ scheduledAt: new Date(scheduleInput).toISOString() }),
      });
      setScheduledPublishAt(result.page.scheduled_publish_at ?? "");
      setScheduledUnpublishAt(result.page.scheduled_unpublish_at ?? "");
      setScheduleInput(localDateTimeInput(result.page.scheduled_publish_at ?? result.page.scheduled_unpublish_at));
      setExpectedVersion(result.page.version);
      setFeedback({ type: "ok", text: action === "publish" ? "Publishing has been scheduled." : "Unpublishing has been scheduled." });
    } catch (e) {
      setFeedback({ type: "err", text: requestErrorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelSchedule() {
    if (!siteId || !pageId) return;
    setSaving(true);
    setFeedback(null);
    try {
      const result = await api<{ page: any }>(`/api/admin/sites/${siteId}/pages/${pageId}/cancel-schedule`, { method: "POST" });
      setScheduledPublishAt("");
      setScheduledUnpublishAt("");
      setScheduleInput("");
      setExpectedVersion(result.page.version);
      setFeedback({ type: "ok", text: "Scheduled page action cancelled." });
    } catch (e) {
      setFeedback({ type: "err", text: requestErrorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  async function handleUnpublish() {
    if (!siteId || !pageId) return;
    setSaving(true);
    try {
      const res = await api<{ page: any }>(`/api/admin/sites/${siteId}/pages/${pageId}/unpublish`, {
        method: "POST",
      });
      setStatus(res.page.status);
      setExpectedVersion(res.page.version);
      setScheduledPublishAt(res.page.scheduled_publish_at ?? "");
      setScheduledUnpublishAt(res.page.scheduled_unpublish_at ?? "");
      setScheduleInput(localDateTimeInput(res.page.scheduled_publish_at ?? res.page.scheduled_unpublish_at));
      setFeedback({ type: "ok", text: "Page unpublished." });
    } catch (e: any) {
      setFeedback({ type: "err", text: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleRestoreRevision(revisionId: string) {
    if (!siteId || !pageId || expectedVersion === null) return;
    setSaving(true);
    try {
      const res = await api<{ page: any }>(
        `/api/admin/sites/${siteId}/pages/${pageId}/revisions/${revisionId}/restore`,
        {
          method: "POST",
          body: JSON.stringify({ expectedVersion }),
        }
      );
      const p = res.page;
      const draft = p.draft_content
        ? typeof p.draft_content === "string"
          ? JSON.parse(p.draft_content)
          : p.draft_content
        : null;
      setSectionKey(draft?.section_key ?? p.section_key);
      setTitle(draft?.title ?? p.title);
      setSlug(draft?.slug ?? p.slug);
      setRawText(draft?.raw_content ?? p.raw_content ?? "");
      setExpectedVersion(p.version);
      setHasUnpublishedChanges(Boolean(p.has_unpublished_changes));
      setFeedback({ type: "ok", text: "Revision restored into editor." });
      await loadRevisions();
      setActiveTab("editor");
    } catch (e: any) {
      setFeedback({ type: "err", text: e.message });
    } finally {
      setSaving(false);
    }
  }

  if (loadingPage) return <p>Loading page...</p>;

  const livePageUrl = publicUrl ? `${publicUrl.replace(/\/+$/, "")}${pagePathForSection(sectionKey, slug)}` : null;
  const previewPrimary = /^#[\da-f]{6}$/i.test(previewSettings.primary_color ?? "") ? previewSettings.primary_color : "#176d50";
  const previewAccent = /^#[\da-f]{6}$/i.test(previewSettings.accent_color ?? "") ? previewSettings.accent_color : "#c8913f";
  const previewLogo = previewUrl(previewSettings.logo_url);
  const previewBrand = previewSettings.brand_name || title || "Your website";
  const previewLayout = ["modern", "editorial", "rounded", "bold"].includes(previewSettings.layout_style) ? previewSettings.layout_style : "modern";
  const previewBodyFont = previewSettings.font_style === "classic"
    ? "Arial, sans-serif"
    : previewSettings.font_style === "friendly"
      ? "Trebuchet MS, Arial, sans-serif"
      : "DM Sans, Arial, sans-serif";
  const previewHeadingFont = previewSettings.font_style === "classic"
    ? "Georgia, serif"
    : previewSettings.font_style === "friendly"
      ? "Trebuchet MS, Arial, sans-serif"
      : "Manrope, DM Sans, Arial, sans-serif";
  const previewStyle = {
    "--preview-primary": previewPrimary,
    "--preview-accent": previewAccent,
    "--preview-heading-font": previewHeadingFont,
    "--green": previewPrimary,
    "--green-dark": `color-mix(in srgb, ${previewPrimary} 82%, black)`,
    "--ink": previewPrimary,
    "--muted": "#52635b",
    "--line": `color-mix(in srgb, ${previewAccent} 24%, #dce6e0)`,
    "--cream": `color-mix(in srgb, ${previewAccent} 9%, white)`,
    "--mint": `color-mix(in srgb, ${previewAccent} 18%, white)`,
    "--gold": previewAccent,
    "--site-radius-card": previewLayout === "rounded" ? "22px" : previewLayout === "bold" ? "2px" : "10px",
    fontFamily: previewBodyFont,
  } as CSSProperties;
  const previewPanel = (
    <section className="card website-preview-panel">
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <h2>Website Preview {previewing && <small>Updating…</small>}</h2>
        <label className="website-preview-viewport">Preview size
          <select value={previewViewport} onChange={(event) => setPreviewViewport(event.target.value as "desktop" | "tablet" | "mobile")}>
            <option value="desktop">Desktop</option><option value="tablet">Tablet</option><option value="mobile">Mobile</option>
          </select>
        </label>
      </div>
      {!preview ? (
        <p>Enter document content to see the page preview.</p>
      ) : (
        <>
          {preview.errors && preview.errors.length > 0 && <div className="website-preview-diagnostic website-preview-error"><strong>Validation Errors</strong><ul>{preview.errors.map((item, index) => <li key={index}>{item.message}</li>)}</ul></div>}
          {preview.unresolvedPlaceholders && preview.unresolvedPlaceholders.length > 0 && <div className="website-preview-diagnostic website-preview-warning"><strong>Unresolved placeholders:</strong> {preview.unresolvedPlaceholders.join(", ")}</div>}
          {preview.diagnostics && preview.diagnostics.length > 0 && <div className="website-preview-diagnostic"><strong>Parser warnings</strong><ul>{preview.diagnostics.map((item, index) => <li key={index}>{item.message} {item.line ? `(line ${item.line})` : ""}</li>)}</ul></div>}
          <div className={`website-preview website-preview-${previewViewport}`}>
            <div className="website-preview-browser"><span></span><span></span><span></span><div>{publicUrl || "Website preview"}{sectionKey && slug ? pagePathForSection(sectionKey, slug) : ""}</div></div>
            <div className="website-preview-site" data-layout={previewLayout} style={previewStyle}>
              {previewSettings.announcement_text && <div className="website-preview-announcement">{previewSettings.announcement_text}</div>}
              <header className="website-preview-header">
                <div className="website-preview-brand">{previewLogo && <img src={previewLogo} alt="" />}{previewBrand}</div>
                <nav className="website-preview-nav" aria-label="Website navigation">
                  <span>{previewSettings.nav_services_label || "Services"}</span>
                  <span>{previewSettings.nav_locations_label || "Locations"}</span>
                  <span>{previewSettings.nav_resources_label || "Resources"}</span>
                </nav>
                {previewSettings.header_cta_label && <span className="website-preview-header-cta">{previewSettings.header_cta_label}</span>}
              </header>
              <main className="website-preview-content">
                <div className="website-preview-page-label">{sectionKey} · {slug || "page-slug"}</div>
                <div className="cms-page">
                  {preview.sections.length ? groupPreviewSections(preview.sections).map((block, index) => {
                    if ("heading" in block && block.heading) return <section className="cms-content-section" key={`group-${index}`}><h2>{previewString(block.heading.data.text)}</h2><div className="cms-content-grid">{(block.children ?? []).map((section, childIndex) => renderPreviewSection(section, childIndex))}</div></section>;
                    return renderPreviewSection(block as PreviewSection, index);
                  }) : <p>This document has no renderable sections.</p>}
                </div>
              </main>
              <footer className="website-preview-footer"><strong>{previewBrand}</strong>{previewSettings.footer_note && <p>{previewSettings.footer_note}</p>}<span>{previewSettings.footer_copyright_text || publicUrl || "Website footer"}</span></footer>
            </div>
          </div>
        </>
      )}
    </section>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>{pageId ? "Edit Page" : "Create New Page"}</h1>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <span className="badge">{status.toUpperCase()}</span>
            <span className="badge">Review: {approvalStatus.replace("_", " ").toUpperCase()}</span>
            {hasUnpublishedChanges && (
              <span className="badge" style={{ background: "#fef3c7", color: "#92400e" }}>
                Unpublished Draft Changes
              </span>
            )}
            {expectedVersion !== null && <span className="badge">v{expectedVersion}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {livePageUrl && status === "published" && (
            <a href={livePageUrl} target="_blank" rel="noreferrer" className="badge" style={{ padding: "8px 12px" }}>
              View Live Page ↗
            </a>
          )}
          <button onClick={runPreview} disabled={previewing || !rawText.trim()} style={{ padding: "8px 14px" }}>
            {previewing ? "Parsing..." : "Preview Parsed Sections"}
          </button>
          <button onClick={() => void handleSave()} disabled={saving} style={{ padding: "8px 14px", background: "#e2e8f0" }}>
            {saving ? "Saving..." : status === "published" ? "Save Draft Changes" : "Save Draft"}
          </button>
          {approvalStatus !== "in_review" && <button onClick={() => void handleSubmitReview()} disabled={saving} style={{ padding: "8px 14px", background: "#1d4ed8", color: "white" }}>{saving ? "Submitting..." : approvalStatus === "rejected" ? "Resubmit for Review" : "Submit for Review"}</button>}
          {approvalStatus === "in_review" && <>
            <button onClick={() => void handleReviewDecision("approve")} disabled={saving} style={{ padding: "8px 14px", background: "#15803d", color: "white" }}>Approve</button>
            <button onClick={() => void handleReviewDecision("reject")} disabled={saving} style={{ padding: "8px 14px", background: "#b91c1c", color: "white" }}>Reject</button>
          </>}
          {approvalStatus === "approved" && <button onClick={() => void handlePublish()} disabled={saving} style={{ padding: "8px 16px", background: "#10b981", color: "white" }}>{saving ? "Publishing..." : "Publish Approved Version"}</button>}
          {status === "published" && pageId && (
            <button onClick={handleUnpublish} disabled={saving} style={{ padding: "8px 12px", background: "#fee2e2", color: "#991b1b" }}>
              Unpublish
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            background: feedback.type === "ok" ? "#ecfdf5" : "#fef2f2",
            color: feedback.type === "ok" ? "#065f46" : "#991b1b",
          }}
        >
          {feedback.text}
        </div>
      )}

      {pageId && <section className="card" style={{ marginBottom: 16 }}>
        <h2>Review workflow</h2>
        <p>Current review state: <strong>{approvalStatus.replace("_", " ")}</strong>. A page that is already live stays live while its changes are reviewed.</p>
        {approvalStatus !== "in_review" ? <>
          {reviewers.length > 0 && <label style={{ display: "grid", gap: 4, maxWidth: 480, marginBottom: 10 }}>Assign reviewer
            <select value={assignedReviewerId} onChange={(event) => setAssignedReviewerId(event.target.value)}>
              <option value="">No specific reviewer</option>
              {reviewers.map((reviewer) => <option key={reviewer.userId} value={reviewer.userId}>{reviewer.name} ({reviewer.siteRole})</option>)}
            </select>
          </label>}
          <label style={{ display: "grid", gap: 4, maxWidth: 640 }}>Note for the reviewer
            <textarea rows={3} maxLength={2000} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Optional context for the reviewer" />
          </label>
        </> : <>
          {assignedReviewerId && <p>Assigned reviewer: {reviewers.find((reviewer) => reviewer.userId === assignedReviewerId)?.name ?? "Assigned reviewer"}</p>}
          <label style={{ display: "grid", gap: 4, maxWidth: 640 }}>Review comment
            <textarea rows={3} maxLength={2000} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Required when rejecting" />
          </label>
        </>}
        {reviewComment && approvalStatus === "rejected" && <p role="status"><strong>Reviewer feedback:</strong> {reviewComment}</p>}
        <h3>Approval history</h3>
        {reviewHistory.length ? <ol>{reviewHistory.map((item) => <li key={item.id}>{item.action.replace("_", " ")} · {new Date(item.createdAt).toLocaleString()} · version {item.pageVersion}{item.comment ? ` — ${item.comment}` : ""}</li>)}</ol> : <p>No review activity yet.</p>}
      </section>}

      {pageId && <section className="card" style={{ marginBottom: 16 }}>
        <h2>Publishing schedule</h2>
        {scheduledPublishAt && <p role="status">Publish scheduled for {new Date(scheduledPublishAt).toLocaleString()}.</p>}
        {scheduledUnpublishAt && <p role="status">Unpublish scheduled for {new Date(scheduledUnpublishAt).toLocaleString()}.</p>}
        {!scheduledUnpublishAt && (approvalStatus === "approved" && (status !== "published" || hasUnpublishedChanges || Boolean(scheduledPublishAt)) || status === "published" && Boolean(scheduledPublishAt)) && <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 4 }}>Date and time
            <input type="datetime-local" min={localDateTimeInput(new Date(Date.now() + 30_000))} value={scheduleInput} onChange={(event) => setScheduleInput(event.target.value)} />
          </label>
          <button type="button" onClick={() => void handleSchedule("publish")} disabled={saving}>{scheduledPublishAt ? "Update publish schedule" : "Schedule publish"}</button>
        </div>}
        {status === "published" && !scheduledPublishAt && <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 4 }}>Date and time
            <input type="datetime-local" min={localDateTimeInput(new Date(Date.now() + 30_000))} value={scheduleInput} onChange={(event) => setScheduleInput(event.target.value)} />
          </label>
          <button type="button" onClick={() => void handleSchedule("unpublish")} disabled={saving}>{scheduledUnpublishAt ? "Update unpublish schedule" : "Schedule unpublish"}</button>
        </div>}
        {(scheduledPublishAt || scheduledUnpublishAt) && <button type="button" onClick={() => void handleCancelSchedule()} disabled={saving} style={{ marginTop: 10 }}>Cancel scheduled action</button>}
        {!scheduledPublishAt && !scheduledUnpublishAt && approvalStatus !== "approved" && status !== "published" && <p>Approve the page before scheduling it to publish.</p>}
      </section>}

      <div className="card form-grid" style={{ marginBottom: 16 }}>
        <label>
          Section
          <select value={sectionKey} onChange={(e) => setSectionKey(e.target.value)}>
            <option value="services">Services</option>
            <option value="locations">Locations</option>
            <option value="blog">Blog</option>
            <option value="faq">FAQ</option>
            <option value="custom">Custom</option>
          </select>
        </label>

        <label>
          Page Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Cockroach Control"
          />
        </label>

        <label>
          URL Slug
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={slug}
              onChange={(e) =>
                setSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-"))
              }
              placeholder="cockroach-control"
            />
            <button
              type="button"
              onClick={() =>
                setSlug(
                  title
                    .toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "")
                )
              }
            >
              Generate
            </button>
          </div>
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {(["editor", "preview", "seo", "revisions"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 14px",
              fontWeight: activeTab === tab ? "bold" : "normal",
              background: activeTab === tab ? "#1a4d8f" : "#e2e8f0",
              color: activeTab === tab ? "white" : "#1e293b",
            }}
          >
            {tab === "editor"
              ? "Document Editor"
              : tab === "preview"
                ? `Parser Preview (${preview?.sections.length ?? 0})`
                : tab === "seo"
                  ? "SEO Settings"
                  : `Revisions (${revisions.length})`}
          </button>
        ))}
        {activeTab === "editor" && <button type="button" onClick={() => setSplitView((value) => !value)} aria-pressed={splitView}>{splitView ? "Hide split preview" : "Split editor and preview"}</button>}
      </div>

      {activeTab === "editor" && (
        <div className={splitView ? "page-editor-split" : undefined}>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h2>Page content</h2>
              <button type="button" onClick={() => void openMediaPicker()} disabled={!siteId}>Insert image</button>
            </div>
            <p>Use Markdown for headings and copy. Insert an uploaded image anywhere in the document.</p>
            <textarea
              ref={textareaRef}
              rows={22}
              style={{ width: "100%", fontFamily: "monospace", padding: 10 }}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="# Cockroach Control&#10;&#10;## Introduction&#10;..."
            />
          </div>
          {splitView && previewPanel}
        </div>
      )}

      {mediaPickerOpen && (
        <div role="presentation" onClick={() => setMediaPickerOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgb(15 23 42 / 55%)", display: "grid", placeItems: "center", padding: 20 }}>
          <section role="dialog" aria-modal="true" aria-labelledby="media-picker-title" onClick={(event) => event.stopPropagation()} style={{ background: "white", borderRadius: 12, padding: 20, width: "min(900px, 100%)", maxHeight: "85vh", overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h2 id="media-picker-title">Choose an image</h2>
              <button type="button" onClick={() => setMediaPickerOpen(false)}>Close</button>
            </div>
            {mediaLoading ? <p>Loading media…</p> : mediaAssets.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12 }}>
                {mediaAssets.filter((asset) => asset.mime.startsWith("image/")).map((asset) => (
                  <button key={asset.id} type="button" onClick={() => insertImage(asset)} style={{ textAlign: "left", padding: 8, border: "1px solid #cbd5e1", borderRadius: 8, background: "white", cursor: "pointer" }}>
                    <img src={asset.url} alt={asset.altText ?? ""} style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 5 }} />
                    <span style={{ display: "block", marginTop: 6, overflowWrap: "anywhere" }}>{asset.altText || asset.filename}</span>
                  </button>
                ))}
              </div>
            ) : <p>No uploaded images yet. <Link to={`/sites/${siteId}/media`} onClick={() => setMediaPickerOpen(false)}>Open the media library to upload one.</Link></p>}
          </section>
        </div>
      )}

      {activeTab === "preview" && previewPanel}

      {activeTab === "seo" && (
        <div className="card form-grid">
          <label>
            SEO Title
            <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="Defaults to parsed Meta Title" />
          </label>
          <label>
            Meta Description
            <textarea rows={3} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
          </label>
          <label>
            Canonical URL
            <input value={seoCanonical} onChange={(e) => setSeoCanonical(e.target.value)} placeholder="https://example.com/services/..." />
          </label>
          <label>
            Open Graph Image URL
            <input value={seoOgImage} onChange={(e) => setSeoOgImage(e.target.value)} />
          </label>
          <label>
            Robots Directive
            <select value={seoRobots} onChange={(e) => setSeoRobots(e.target.value)}>
              <option value="index,follow">index,follow</option>
              <option value="noindex,nofollow">noindex,nofollow</option>
              <option value="index,nofollow">index,nofollow</option>
            </select>
          </label>
        </div>
      )}

      {activeTab === "revisions" && (
        <div className="card">
          <h2>Revision History</h2>
          {revisions.length === 0 ? (
            <p>No revisions recorded yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Editor</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {revisions.map((rev) => (
                  <tr key={rev.id}>
                    <td>v{rev.version}</td>
                    <td>{rev.editor_name || rev.editor_email || "System"}</td>
                    <td>{new Date(rev.created_at).toLocaleString()}</td>
                    <td>
                      <button type="button" onClick={() => setCompareRevision(rev)} style={{ marginRight: 8 }}>
                        Compare
                      </button>
                      <button type="button" onClick={() => handleRestoreRevision(rev.id)} disabled={saving}>
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {compareRevision && (
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <h4>Selected Revision (v{compareRevision.version})</h4>
                <pre style={{ background: "#f8fafc", padding: 10, maxHeight: 300, overflow: "auto" }}>
                  {compareRevision.snapshot?.raw_content}
                </pre>
              </div>
              <div>
                <h4>Current Editor Content</h4>
                <pre style={{ background: "#f8fafc", padding: 10, maxHeight: 300, overflow: "auto" }}>
                  {rawText}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
