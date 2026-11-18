import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { getAllPages, getMenu, getPublicSiteSettings } from "@/lib/cms";
import "./globals.css";

function readableSiteName(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function safeMenuUrl(value?: string) {
  if (typeof value !== "string") return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return safeExternalUrl(value);
}

function safeExternalUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSiteSettings();
  const brand = settings.brand_name || readableSiteName(process.env.NEXT_PUBLIC_SITE_NAME ?? "Local Service Company");
  const description = settings.home_intro || `Local service and helpful support from ${brand}.`;
  const heroImage = settings.home_hero_image_url && /^https?:\/\//i.test(settings.home_hero_image_url) ? settings.home_hero_image_url : undefined;
  const logoImage = settings.logo_url && /^https?:\/\//i.test(settings.logo_url) ? settings.logo_url : undefined;
  let metadataBase: URL | undefined;
  try {
    if (settings.public_url) {
      const url = new URL(settings.public_url);
      if (url.protocol === "http:" || url.protocol === "https:") metadataBase = url;
    }
  } catch {
    metadataBase = undefined;
  }
  return {
    title: { default: brand, template: `%s | ${brand}` },
    description,
    metadataBase,
    ...(logoImage ? { icons: { icon: logoImage, apple: logoImage } } : {}),
    openGraph: {
      type: "website",
      siteName: brand,
      title: brand,
      description,
      ...(heroImage ? { images: [{ url: heroImage, alt: settings.home_hero_image_alt || brand }] } : {}),
    },
    twitter: {
      card: heroImage ? "summary_large_image" : "summary",
      title: brand,
      description,
      ...(heroImage ? { images: [heroImage] } : {}),
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, pages, mainMenu] = await Promise.all([getPublicSiteSettings(), getAllPages(), getMenu("main").catch(() => null)]);
  
  // Group pages into sections (services, locations, etc.)
  const groupedPages = pages.reduce((acc: any, page: any) => {
    if (!acc[page.section_key]) acc[page.section_key] = [];
    acc[page.section_key].push(page);
    return acc;
  }, {});

  const siteName = settings.brand_name || readableSiteName(process.env.NEXT_PUBLIC_SITE_NAME ?? "Local Service Company");
  const siteTagline = settings.tagline || "Local care. Lasting results.";
  const logoUrl = settings.logo_url && /^https?:\/\//i.test(settings.logo_url) ? settings.logo_url : null;
  const phoneHref = settings.phone?.replace(/[^\d+]/g, "");
  const contactEmail = settings.contact_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.contact_email) ? settings.contact_email : null;
  
  const socialLinks = [
    { label: "Facebook", href: safeExternalUrl(settings.facebook_url) },
    { label: "Instagram", href: safeExternalUrl(settings.instagram_url) },
    { label: "LinkedIn", href: safeExternalUrl(settings.linkedin_url) },
  ].filter((link): link is { label: string; href: string } => Boolean(link.href));
  
  const primaryColor = settings.primary_color && /^#[\da-f]{6}$/i.test(settings.primary_color) ? settings.primary_color : "#176d50";
  const accentColor = settings.accent_color && /^#[\da-f]{6}$/i.test(settings.accent_color) ? settings.accent_color : "#c8913f";
  const fonts = settings.font_style === "classic"
    ? { body: "Arial, sans-serif", heading: "Georgia, serif" }
    : settings.font_style === "friendly"
      ? { body: "Trebuchet MS, Arial, sans-serif", heading: "Trebuchet MS, Arial, sans-serif" }
      : { body: "'DM Sans', Arial, sans-serif", heading: "'Manrope', 'DM Sans', Arial, sans-serif" };
      
  const themeStyle = {
    "--green": primaryColor,
    "--gold": accentColor,
    "--site-font-body": fonts.body,
    "--site-font-heading": fonts.heading,
  } as CSSProperties;

  return (
    <html lang="en">
      <body style={themeStyle}>
        <div className="announcement-bar">
          <div className="container announcement-inner">
            <span>{settings.announcement_text || settings.service_area || settings.area_name || "Locally owned. Here when you need us."}</span>
            {settings.phone ? <a href={`tel:${phoneHref}`}>{settings.announcement_phone_label || "Call our team:"} {settings.phone}</a> : <span>{settings.announcement_fallback_text || "Trusted local service, with care in every visit."}</span>}
          </div>
        </div>
        <header className="site-header">
          <div className="container nav-inner">
            <Link className="brand" href="/" aria-label={`${siteName} home`}>
              {logoUrl ? <img className="brand-logo" src={logoUrl} alt="" /> : <span className="brand-mark" aria-hidden="true">{siteName.slice(0, 1).toUpperCase()}</span>}
              <span>{siteName}<small>{siteTagline}</small></span>
            </Link>
            <nav className="main-nav" aria-label="Main navigation">
              {Array.isArray(mainMenu?.items) && mainMenu.items.length ? (
                // If you manually configured a menu in the database, use it
                mainMenu.items.map((item: any) => {
                  const href = safeMenuUrl(item.url);
                  const children = Array.isArray(item.children) ? item.children.filter((child: any) => safeMenuUrl(child.url)) : [];
                  if (!href) return null;
                  if (!children.length) return <Link key={item.id} href={href}>{item.label}</Link>;
                  return <details className="nav-pages" key={item.id}><summary>{item.label} <span aria-hidden="true">⌄</span></summary><div className="nav-page-menu"><Link href={href}>{item.label}</Link>{children.map((child: any) => <Link key={child.id} href={safeMenuUrl(child.url)!}>{child.label}</Link>)}</div></details>;
                })
              ) : (
                // OTHERWISE: Render the dynamic pages grouped by section
                <>
                  <Link href="/">Home</Link>
                  {Object.entries(groupedPages).map(([sectionKey, sectionPages]: any) => (
                    <details className="nav-pages" key={sectionKey}>
                      <summary style={{ textTransform: "capitalize" }}>
                        {sectionKey} <span aria-hidden="true">⌄</span>
                      </summary>
                      <div className="nav-page-menu">
                        {sectionPages.map((p: any) => (
                          <Link key={p.id} href={`/${p.section_key}/${p.slug}`}>
                            {p.title}
                          </Link>
                        ))}
                      </div>
                    </details>
                  ))}
                </>
              )}
            </nav>
            <div className="nav-actions">
              {settings.phone ? <a className="nav-phone" href={`tel:${phoneHref}`}>{settings.phone}</a> : null}
              <Link className="button button-small" href="/contact">{settings.header_cta_label || "Get a free estimate"} <span aria-hidden="true">↗</span></Link>
            </div>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="container footer-grid">
            <div>
              <Link className="brand footer-brand" href="/">
                {logoUrl ? <img className="brand-logo" src={logoUrl} alt="" /> : <span className="brand-mark" aria-hidden="true">{siteName.slice(0, 1).toUpperCase()}</span>}
                <span>{siteName}<small>{siteTagline}</small></span>
              </Link>
              <p className="footer-note">{settings.footer_note || "Reliable service from a local team that puts your home and family first."}</p>
            </div>
            <div>
              <h2>{settings.footer_explore_title || "Explore"}</h2>
              <Link href="/services">{settings.footer_services_label || "Our services"}</Link>
              <Link href="/locations">{settings.footer_locations_label || "Areas we serve"}</Link>
              <Link href="/blog">{settings.footer_resources_label || "Helpful resources"}</Link>
              <Link href="/faq">{settings.footer_faq_label || "Common questions"}</Link>
            </div>
            <div>
              <h2>{settings.footer_contact_title || "Get in touch"}</h2>
              {settings.phone ? <a href={`tel:${phoneHref}`}>{settings.phone}</a> : null}
              {contactEmail ? <a href={`mailto:${contactEmail}`}>{contactEmail}</a> : null}
              <Link href="/contact">{settings.footer_estimate_label || "Request an estimate"}</Link>
              {settings.service_area || settings.area_name ? <p>{settings.service_area || settings.area_name}</p> : null}
              {socialLinks.length ? <div className="social-links" aria-label="Social media">{socialLinks.map((link) => <a key={link.label} href={link.href} target="_blank" rel="noreferrer">{link.label}</a>)}</div> : null}
            </div>
          </div>
          <div className="container footer-bottom"><span>© {new Date().getFullYear()} {siteName}. {settings.footer_copyright_text || "All rights reserved."}</span><Link href="/contact">Contact</Link></div>
        </footer>
      </body>
    </html>
  );
}