import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntry, getPageBySlug, getPublicSiteSettings } from "@/lib/cms";
import PageSections from "@/components/PageSections";

export const revalidate = 3600;

async function getServicePage(slug: string) {
  for (const section of ["services", "service"]) {
    try { return await getPageBySlug(section, slug); } catch { /* Try the other supported section name. */ }
  }
  return null;
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const page = await getServicePage(params.slug);
  if (page) {
    return { title: page.seo_title || page.title, description: page.seo_description || "" };
  }
  try {
    const { seo } = await getEntry("service", params.slug);
    return { title: seo.title, description: seo.description, alternates: { canonical: seo.canonical }, robots: seo.robots };
  } catch {
    return { title: "Service" };
  }
}

export default async function ServicePage({ params }: { params: { slug: string } }) {
  const page = await getServicePage(params.slug);
  if (page) return <PageSections sections={page.parsed_sections || []} />;

  let result;
  try {
    result = await getEntry("service", params.slug);
  } catch {
    notFound();
  }
  const { entry, relations } = result;
  const [settings] = await Promise.all([getPublicSiteSettings()]);
  const title = String(entry.data.title ?? entry.slug);
  const description = String(entry.data.description ?? "Our local team is ready to help you find a solution that fits your home.");
  const imageValue = entry.data.image ?? entry.data.imageUrl;
  const image = typeof imageValue === "string" && /^https?:\/\//i.test(imageValue) ? imageValue : null;
  const phoneHref = settings.phone?.replace(/[^\d+]/g, "");

  return <div className="page-wrap">
    <section className="inner-hero"><div className="container"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/services">Services</Link><span>/</span><span>{title}</span></nav><p className="eyebrow">Thoughtful help for your home</p><h1>{title}</h1><p>{description}</p></div></section>
    <section className="section"><div className="container detail-layout">
      <article className="detail-content">
        {image ? <img className="detail-image" src={image} alt={String(entry.data.imageAlt ?? title)} /> : null}
        {entry.data.body ? <div className="detail-copy">{String(entry.data.body).split(/\n{2,}/).map((paragraph: string, index: number) => <p key={index}>{paragraph}</p>)}</div> : <p className="detail-lead">We’ll listen to what’s happening, explain your options, and make a clear plan to help you feel comfortable in your space again.</p>}
        {Array.isArray(entry.data.benefits) && entry.data.benefits.length ? <><h2>What you can expect</h2><ul className="check-list">{entry.data.benefits.map((benefit: unknown, index: number) => <li key={index}>{String(benefit)}</li>)}</ul></> : null}
        {relations.related_faq?.length ? <div className="related-faq"><h2>Common questions</h2>{relations.related_faq.map((faq: any) => <details className="cms-faq-item" key={faq.id}><summary>{String(faq.data.question ?? "")}</summary><p>{String(faq.data.answer ?? "")}</p></details>)}</div> : null}
      </article>
      <aside className="detail-aside"><p className="card-kicker">Let’s get started</p><h2>Get a plan that fits your home.</h2><p>Tell us what you need and our team will help you choose a practical next step.</p>{entry.data.price ? <p className="card-price">Starting at {String(entry.data.price)}</p> : null}<Link className="button" href="/contact">Request an estimate <span aria-hidden="true">↗</span></Link>{settings.phone ? <a className="aside-phone" href={`tel:${phoneHref}`}>Or call {settings.phone}</a> : null}</aside>
    </div></section>
  </div>;
}
