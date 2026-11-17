import Link from "next/link";
import { getAllPages, getEntries, getPageBySlug } from "@/lib/cms";
import PageSections from "@/components/PageSections";

export const revalidate = 0;
async function getServicesPage() {
  for (const section of ["services", "service"]) {
    for (const slug of ["services", "service"]) {
      try { return await getPageBySlug(section, slug); } catch { /* Try the next common services page key. */ }
    }
  }
  return null;
}

export async function generateMetadata() {
  const page = await getServicesPage();
  return { title: page?.seo_title || page?.title || "Our Services", description: page?.seo_description || undefined };
}

export default async function ServicesPage() {
  const page = await getServicesPage();
  if (Array.isArray(page?.parsed_sections) && page.parsed_sections.length) {
    return <PageSections sections={page.parsed_sections} />;
  }
  const [services, pages] = await Promise.all([
    getEntries("service").catch(() => []),
    getAllPages(),
  ]);
  const serviceSlugs = new Set(services.map((service) => service.slug));
  const pageServices = pages.filter((page: any) => ["service", "services"].includes(String(page.section_key).toLowerCase()) && !serviceSlugs.has(page.slug));
  const items = [
    ...services.map((service) => ({
      id: service.id,
      slug: service.slug,
      title: String(service.data.title ?? service.slug),
      description: String(service.data.description ?? "Learn how our local team can help."),
      price: service.data.price ? String(service.data.price) : "",
      image: typeof (service.data.image ?? service.data.imageUrl) === "string" ? String(service.data.image ?? service.data.imageUrl) : "",
    })),
    ...pageServices.map((page: any) => ({ id: `page-${page.id}`, slug: page.slug, title: page.title, description: "Learn about this service and how our local team can help.", price: "", image: "" })),
  ];
  return <div className="page-wrap">
    <section className="inner-hero"><div className="container"><p className="eyebrow">How we can help</p><h1>Services for a happier, healthier home.</h1><p>Explore our services and find a practical solution that fits your space, schedule, and needs.</p></div></section>
    <section className="section"><div className="container">
      {items.length ? <div className="card-grid">{items.map((service) => {
        const image = /^https?:\/\//i.test(service.image) ? service.image : "";
        return <article className="service-card" key={service.id}>{image ? <img className="card-image" src={image} alt={service.title} /> : null}<div className="card-body"><p className="card-kicker">Personalized service</p><h2>{service.title}</h2><p>{service.description.slice(0, 190)}</p>{service.price ? <span className="card-price">Starting at {service.price}</span> : null}<Link className="text-link" href={`/services/${service.slug}`}>View service details <span aria-hidden="true">→</span></Link></div></article>;
      })}</div> : <div className="empty-state">Service details are being prepared. Contact our team for help with your needs.</div>}
    </div></section>
    <section className="section section-soft"><div className="container cta-band"><div><p className="eyebrow">Need a recommendation?</p><h2>We’ll help you choose the right service.</h2><p>Tell us what you’re noticing and our local team will guide you from there.</p></div><Link className="button" href="/contact">Talk with us <span aria-hidden="true">↗</span></Link></div></section>
  </div>;
}
