import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { normalizePublicSiteUrl } from "../lib/siteUrl";

const themePresets = [
  { id: "forest", label: "Forest", primary: "#176d50", accent: "#c8913f" },
  { id: "ocean", label: "Ocean", primary: "#155e75", accent: "#e7a35b" },
  { id: "terracotta", label: "Terracotta", primary: "#9a4e35", accent: "#d3a54e" },
  { id: "plum", label: "Plum", primary: "#624377", accent: "#d6a66f" },
];
const fontPresets = [
  { id: "modern", label: "Modern" },
  { id: "classic", label: "Classic" },
  { id: "friendly", label: "Friendly" },
];
const layoutPresets = [
  { id: "modern", label: "Modern" },
  { id: "editorial", label: "Editorial" },
  { id: "rounded", label: "Rounded" },
  { id: "bold", label: "Bold" },
];
type MediaAsset = { id: string; url: string; filename: string; altText?: string | null };

export default function SettingsPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg(null);
    api<{ settings: any[] }>(`/api/admin/sites/${siteId}/settings`)
      .then((r) => {
        const obj: Record<string, string> = {};
        for (const s of r.settings) {
          if ((s.key === "primary_color" || s.key === "accent_color") &&
              (typeof s.value !== "string" || !/^#[\da-f]{6}$/i.test(s.value))) continue;
          obj[s.key] = typeof s.value === "string" ? s.value : JSON.stringify(s.value);
        }
        setSettings(obj);
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        setMsg(`Error loading settings: ${message}`);
      })
      .finally(() => setLoading(false));
  }, [siteId]);

  useEffect(() => {
    if (!siteId) {
      setMediaAssets([]);
      return;
    }
    api<{ media: MediaAsset[] }>(`/api/admin/sites/${siteId}/media`)
      .then((result) => setMediaAssets(result.media))
      .catch(() => setMediaAssets([]));
  }, [siteId]);

  function set(key: string, value: string) {
    setSettings({ ...settings, [key]: value });
  }

  async function save() {
    if (!siteId) return;
    if (settings.public_url && !normalizePublicSiteUrl(settings.public_url)) {
      setMsg("Enter a valid public website URL starting with http:// or https://.");
      return;
    }
    for (const key of ["facebook_url", "instagram_url", "linkedin_url"]) {
      const value = settings[key];
      if (!value) continue;
      try {
        const url = new URL(value);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      } catch {
        setMsg(`Enter a valid http:// or https:// link for ${key.replace("_url", "")}.`);
        return;
      }
    }
    if (settings.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.contact_email)) {
      setMsg("Enter a valid contact email address.");
      return;
    }
    if (["primary_color", "accent_color"].some((key) => settings[key] && !/^#[\da-f]{6}$/i.test(settings[key]))) {
      setMsg("Choose valid primary and accent colors.");
      return;
    }
    if (settings.layout_style && !layoutPresets.some((preset) => preset.id === settings.layout_style)) {
      setMsg("Choose a supported website layout.");
      return;
    }
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

  const keys = ["area_name", "brand_name", "tagline", "announcement_text", "announcement_phone_label", "announcement_fallback_text", "nav_services_label", "nav_locations_label", "nav_resources_label", "nav_faq_label", "nav_more_label", "header_cta_label", "footer_note", "footer_explore_title", "footer_services_label", "footer_locations_label", "footer_resources_label", "footer_faq_label", "footer_contact_title", "footer_estimate_label", "footer_copyright_text", "home_heading", "home_intro", "home_cta_label", "logo_url", "home_hero_image_url", "home_hero_image_alt", "phone", "contact_email", "service_area", "facebook_url", "instagram_url", "linkedin_url", "public_url", "primary_color", "accent_color", "font_style", "layout_style"];
  const labels: Record<string, string> = { area_name: "Area name", brand_name: "Brand name", tagline: "Website tagline", announcement_text: "Announcement bar text", announcement_phone_label: "Announcement phone label", announcement_fallback_text: "Announcement text when no phone is set", nav_services_label: "Navigation: services", nav_locations_label: "Navigation: locations", nav_resources_label: "Navigation: resources", nav_faq_label: "Navigation: FAQs", nav_more_label: "Navigation: more pages", header_cta_label: "Header button text", footer_note: "Footer introduction", footer_explore_title: "Footer explore heading", footer_services_label: "Footer: services", footer_locations_label: "Footer: locations", footer_resources_label: "Footer: resources", footer_faq_label: "Footer: FAQs", footer_contact_title: "Footer contact heading", footer_estimate_label: "Footer estimate link", footer_copyright_text: "Footer copyright text", home_heading: "Homepage headline", home_intro: "Homepage introduction", home_cta_label: "Homepage button text", logo_url: "Logo image URL", home_hero_image_url: "Homepage hero image URL", home_hero_image_alt: "Homepage hero image alt text", phone: "Phone", contact_email: "Contact email", service_area: "Service area", facebook_url: "Facebook URL", instagram_url: "Instagram URL", linkedin_url: "LinkedIn URL", public_url: "Public website URL", primary_color: "Theme primary color", accent_color: "Theme accent color", font_style: "Website typography", layout_style: "Website layout" };
  const currentPreset = themePresets.find((preset) =>
    (settings.primary_color || "#176d50").toLowerCase() === preset.primary &&
    (settings.accent_color || "#c8913f").toLowerCase() === preset.accent
  )?.id ?? "custom";
  const previewPrimary = settings.primary_color || "#176d50";
  const previewAccent = settings.accent_color || "#c8913f";
  const previewLogo = settings.logo_url && /^https?:\/\//i.test(settings.logo_url) ? settings.logo_url : null;
  const previewHeroImage = settings.home_hero_image_url && /^https?:\/\//i.test(settings.home_hero_image_url) ? settings.home_hero_image_url : null;
  const previewFonts = settings.font_style === "classic"
    ? { body: "Arial, sans-serif", heading: "Georgia, serif" }
    : settings.font_style === "friendly"
      ? { body: "Trebuchet MS, Arial, sans-serif", heading: "Trebuchet MS, Arial, sans-serif" }
      : { body: "'DM Sans', Arial, sans-serif", heading: "'Manrope', 'DM Sans', Arial, sans-serif" };
  return (
    <div>
      <h1>Settings</h1>
      {loading && <p role="status">Loading settingsâ€¦</p>}
      {msg && <div className="card" role={msg.startsWith("Error:") || msg.startsWith("Error loading") ? "alert" : "status"}>{msg}</div>}
      <div className="card">
        <div className="form-grid">
          <label>
            Website theme
            <select
              value={currentPreset}
              onChange={(e) => {
                const preset = themePresets.find((item) => item.id === e.target.value);
                if (preset) setSettings({ ...settings, primary_color: preset.primary, accent_color: preset.accent });
              }}
              disabled={loading || busy}
            >
              <option value="custom">Custom colors</option>
              {themePresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
            </select>
          </label>
          {keys.map((k) => (
            <label key={k}>
              {labels[k] ?? k}
              {k === "layout_style" ? <select
                value={settings.layout_style || "modern"}
                onChange={(e) => set("layout_style", e.target.value)}
                disabled={loading || busy}
              >
                {layoutPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
              </select> : k === "font_style" ? <select
                value={settings.font_style || "modern"}
                onChange={(e) => set("font_style", e.target.value)}
                disabled={loading || busy}
              >
                {fontPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
              </select> : (k === "home_intro" || k === "announcement_text" || k === "footer_note") ? <textarea
                rows={3}
                value={settings[k] ?? ""}
                onChange={(e) => set(k, e.target.value)}
                disabled={loading || busy}
                placeholder="A short introduction to this business and the people it serves."
              /> : <input
                type={k === "contact_email" ? "email" : k === "public_url" || k === "logo_url" || k === "home_hero_image_url" || k.endsWith("_url") ? "url" : k === "primary_color" || k === "accent_color" ? "color" : "text"}
                value={k === "primary_color" ? settings[k] || "#176d50" : k === "accent_color" ? settings[k] || "#c8913f" : settings[k] ?? ""}
                onChange={(e) => set(k, e.target.value)}
                disabled={loading || busy}
                placeholder={k === "public_url" ? "https://www.example.com" : k === "logo_url" ? "https://example.com/logo.png" : k === "home_hero_image_url" ? "https://example.com/homepage-image.jpg" : k === "home_hero_image_alt" ? "Describe the main image" : undefined}
              />}
              {k === "logo_url" || k === "home_hero_image_url" ? <select
                aria-label={`Choose ${k === "logo_url" ? "a logo" : "a homepage hero image"} from this site's media library`}
                value={mediaAssets.find((asset) => asset.url === settings[k])?.id ?? ""}
                onChange={(e) => {
                  const selected = mediaAssets.find((asset) => asset.id === e.target.value);
                  if (selected) {
                    setSettings({
                      ...settings,
                      [k]: selected.url,
                      ...(k === "home_hero_image_url" && selected.altText ? { home_hero_image_alt: selected.altText } : {}),
                    });
                  }
                }}
                disabled={loading || busy || mediaAssets.length === 0}
              >
                <option value="">{mediaAssets.length ? "Or choose an uploaded imageâ€¦" : "No uploaded images available"}</option>
                {mediaAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.altText || asset.filename}</option>)}
              </select> : null}
            </label>
          ))}
        </div>
        <section className="card" aria-label="Live website theme preview" style={{ marginTop: 20, borderColor: previewAccent }}>
          <p style={{ margin: "0 0 12px", color: previewPrimary, fontWeight: 700 }}>Live website preview</p>
          <div className="settings-site-preview" data-layout={settings.layout_style || "modern"} style={{ padding: 20, borderRadius: 10, background: `color-mix(in srgb, ${previewPrimary} 5%, #fff)`, border: `1px solid color-mix(in srgb, ${previewPrimary} 18%, #fff)`, fontFamily: previewFonts.body }}>
            {previewLogo ? <img src={previewLogo} alt="Logo preview" style={{ display: "block", maxWidth: 150, maxHeight: 48, objectFit: "contain", marginBottom: 12 }} /> : null}
            {previewHeroImage ? <img src={previewHeroImage} alt={settings.home_hero_image_alt || "Homepage hero preview"} style={{ display: "block", width: "100%", maxHeight: 130, objectFit: "cover", borderRadius: 7, marginBottom: 12 }} /> : null}
            <span style={{ display: "inline-block", marginBottom: 10, padding: "4px 9px", borderRadius: 20, background: previewAccent, color: "#fff", fontSize: 12, fontWeight: 700 }}>LOCAL SERVICE</span>
            <p style={{ margin: "0 0 6px", color: previewPrimary, fontWeight: 700 }}>{settings.brand_name || "Your website name"}</p>
            <h2 style={{ margin: "0 0 8px", color: "#142822", fontFamily: previewFonts.heading }}>{settings.home_heading || "Feel at home again. Weâ€™ll take care of the rest."}</h2>
            <p style={{ margin: "0 0 16px", color: "#60736b" }}>{settings.home_intro || `${settings.service_area || settings.area_name || "Your service area"} Â· ${settings.tagline || "Local care. Lasting results."}`}</p>
            <button type="button" style={{ padding: "10px 16px", border: 0, borderRadius: 6, background: previewPrimary, color: "#fff", fontWeight: 700 }}>{settings.home_cta_label || "Request an estimate"}</button>
          </div>
        </section>
        <button onClick={save} disabled={loading || busy} style={{ marginTop: 12 }}>
          {loading ? "Loadingâ€¦" : busy ? "Savingâ€¦" : "Save"}
        </button>
      </div>
    </div>
  );
}
