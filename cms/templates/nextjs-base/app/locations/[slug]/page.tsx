import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntry, getPageBySlug, getPublicSiteSettings } from "@/lib/cms";
import PageSections from "@/components/PageSections";

export const revalidate = 3600;

async function getLocationPage(slug: string) {
  for (const section of ["locations", "location"]) {
    try { return await getPageBySlug(section, slug); } catch { /* Try the other supported section name. */ }
  }
  return null;
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const page = await getLocationPage(params.slug);
  if (page) return { title: page.seo_title || page.title, description: page.seo_description || "" };
  try {
    const { seo } = await getEntry("location", params.slug);
    return { title: seo.title, description: seo.description, alternates: { canonical: seo.canonical } };
  } catch {
    return { title: "Service Area" };
  }
}

export default async function LocationPage({ params }: { params: { slug: string } }) {
  const page = await getLocationPage(params.slug);
  if (page) return <PageSections sections={page.parsed_sections || []} />;

  let result;
  try {
    result = await getEntry("location", params.slug);
  } catch {
    notFound();
  }
  const [settings] = await Promise.all([getPublicSiteSettings()]);
  const { entry } = result;
  const city = String(entry.data.city ?? entry.data.name ?? entry.slug);
  const address = String(entry.data.address ?? "");
  const phone = String(entry.data.phone ?? settings.phone ?? "");
  const phoneHref = phone.replace(/[^\d+]/g, "");
  const mapHref = address ? `https://maps.google.com/?q=${encodeURIComponent(address)}` : null;
  const imageValue = entry.data.image ?? entry.data.imageUrl;
  const image = typeof imageValue === "string" && /^https?:\/\//i.test(imageValue) ? imageValue : null;

  return <div className="page-wrap">
    <section className="inner-hero"><div className="container"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/locations">Locations</Link><span>/</span><span>{city}</span></nav><p className="eyebrow">Neighbors helping neighbors</p><h1>Local service in {city}.</h1><p>{String(entry.data.localProof ?? entry.data.description ?? `Our team is proud to help homeowners in ${city} with dependable, thoughtful service.`)}</p></div></section>
    <section className="section"><div className="container detail-layout">
      <article className="detail-content">{image ? <img className="detail-image" src={image} alt={String(entry.data.imageAlt ?? `${city} service area`)} /> : null}<h2>Here when you need a hand.</h2><p className="detail-lead">When something doesn’t feel right at home, getting help should feel simple. Our local team will listen, answer your questions, and recommend a plan for your space.</p>{entry.data.body ? <div className="detail-copy">{String(entry.data.body).split(/\n{2,}/).map((paragraph: string, index: number) => <p key={index}>{paragraph}</p>)}</div> : null}</article>
      <aside className="detail-aside"><p className="card-kicker">Serving {city}</p><h2>Reach your local team.</h2>{address ? <div className="info-row"><span aria-hidden="true">⌖</span><div><strong>Address</strong>{mapHref ? <a href={mapHref} target="_blank" rel="noreferrer">{address}</a> : address}</div></div> : null}{phone ? <div className="info-row"><span aria-hidden="true">☎</span><div><strong>Call</strong><a href={`tel:${phoneHref}`}>{phone}</a></div></div> : null}<Link className="button" href="/contact">Request an estimate <span aria-hidden="true">↗</span></Link></aside>
    </div></section>
  </div>;
}
