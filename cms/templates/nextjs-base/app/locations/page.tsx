import Link from "next/link";
import { getAllPages, getEntries, getPageBySlug, getPublicSiteSettings } from "@/lib/cms";
import PageSections from "@/components/PageSections";

export const revalidate = 0;
async function getLocationsPage() {
  for (const section of ["locations", "location"]) {
    for (const slug of ["locations", "location"]) {
      try { return await getPageBySlug(section, slug); } catch { /* Try the next common locations page key. */ }
    }
  }
  return null;
}

export async function generateMetadata() {
  const page = await getLocationsPage();
  return { title: page?.seo_title || page?.title || "Areas We Serve", description: page?.seo_description || undefined };
}

export default async function LocationsPage() {
  const page = await getLocationsPage();
  if (Array.isArray(page?.parsed_sections) && page.parsed_sections.length) {
    return <PageSections sections={page.parsed_sections} />;
  }
  const [locations, pages, settings] = await Promise.all([
    getEntries("location").catch(() => []),
    getAllPages(),
    getPublicSiteSettings(),
  ]);
  const locationSlugs = new Set(locations.map((location) => location.slug));
  const pageLocations = pages.filter((page: any) => ["location", "locations"].includes(String(page.section_key).toLowerCase()) && !locationSlugs.has(page.slug));
  const items = [
    ...locations.map((location) => ({ id: location.id, slug: location.slug, name: String(location.data.city ?? location.data.name ?? location.slug), description: String(location.data.localProof ?? location.data.description ?? "") })),
    ...pageLocations.map((page: any) => ({ id: `page-${page.id}`, slug: page.slug, name: page.title, description: "Local support from our team. Explore service information for this area." })),
  ];
  const brand = settings.brand_name || process.env.NEXT_PUBLIC_SITE_NAME || "Our team";
  return (
    <div className="page-wrap">
      <section className="inner-hero"><div className="container"><p className="eyebrow">Local and close by</p><h1>Here for the communities we call home.</h1><p>{brand} proudly serves {settings.service_area || settings.area_name || "the surrounding area"}. Find your community below to learn more.</p></div></section>
      <section className="section"><div className="container">
        {items.length ? <div className="card-grid">{items.map((location) => <article className="location-card" key={location.id}><div className="card-body"><p className="card-kicker">Local service area</p><h2>{location.name}</h2><p>{location.description || `Friendly, dependable support from ${brand}.`}</p><Link className="text-link" href={`/locations/${location.slug}`}>Explore {location.name} <span aria-hidden="true">→</span></Link></div></article>)}</div> : <div className="empty-state">Our service areas are being updated. Contact us and we’ll let you know if we serve your neighborhood.</div>}
      </div></section>
      <section className="section section-soft"><div className="container cta-band"><div><p className="eyebrow">Not sure if we come to you?</p><h2>Ask us about your neighborhood.</h2><p>Our team is happy to help you find out.</p></div><Link className="button" href="/contact">Check availability <span aria-hidden="true">↗</span></Link></div></section>
    </div>
  );
}
