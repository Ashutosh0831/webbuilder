import Link from "next/link";
import { getAllPages, getEntries, getPageBySlug, getPublicSiteSettings } from "@/lib/cms";
import PageSections from "@/components/PageSections";

export const revalidate = 3600;

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function imageFor(data: Record<string, unknown>) {
  const value = data.image ?? data.imageUrl ?? data.featuredImage;
  return typeof value === "string" && /^https?:\/\//i.test(value) ? value : null;
}

function pageSummary(page: any) {
  if (typeof page.seo_description === "string" && page.seo_description) return page.seo_description;
  const sections = Array.isArray(page.parsed_sections) ? page.parsed_sections : [];
  const hero = sections.find((section: any) => section.type === "hero");
  if (hero?.data?.subheadline) return String(hero.data.subheadline);
  const textBlock = sections.find((section: any) => section.type === "text");
  return textBlock?.data?.content ? String(textBlock.data.content).slice(0, 150) : "Learn how our local team can help.";
}

export default async function HomePage() {
  const [services, locations, pages, settings] = await Promise.all([
    getEntries("service").catch(() => []),
    getEntries("location").catch(() => []),
    getAllPages(),
    getPublicSiteSettings(),
  ]);
  const serviceSlugs = new Set(services.map((service) => service.slug));
  const servicePages = pages.filter((page: any) => ["service", "services"].includes(String(page.section_key).toLowerCase()) && !serviceSlugs.has(page.slug));
  const cmsHome = pages.find((page: any) => ["home", "homepage"].includes(String(page.section_key).toLowerCase()));
  if (cmsHome) {
    try {
      const page = await getPageBySlug(cmsHome.section_key, cmsHome.slug);
      if (Array.isArray(page.parsed_sections) && page.parsed_sections.length) {
        return <PageSections sections={page.parsed_sections} />;
      }
    } catch {
      // Fall through to the designed homepage if the CMS page is unavailable.
    }
  }
  const brand = settings.brand_name || process.env.NEXT_PUBLIC_SITE_NAME || "Your local service team";
  const area = settings.service_area || settings.area_name || "Your neighborhood";
  const heroHeading = settings.home_heading || "Feel at home again. We’ll take care of the rest.";
  const heroIntro = settings.home_intro || `${brand} helps protect the people and places you care about with dependable service, clear advice, and a team that knows ${area}.`;
  const heroImage = settings.home_hero_image_url && /^https?:\/\//i.test(settings.home_hero_image_url) ? settings.home_hero_image_url : null;

  return (
    <div className="page-wrap">
      <section className="hero">
        <div className={heroImage ? "container hero-layout hero-layout-with-image" : "container hero-content"}>
          <div className="hero-copy">
            <p className="eyebrow">Local experts. Thoughtful service.</p>
            <h1>{heroHeading}</h1>
            <p>{heroIntro}</p>
            <div className="hero-actions">
              <Link className="button" href="/contact">{settings.home_cta_label || "Request a free estimate"} <span aria-hidden="true">↗</span></Link>
              <Link className="button button-outline" href="/services">Explore our services</Link>
            </div>
            <div className="hero-proof"><span>Friendly local professionals</span><span>Clear recommendations</span><span>Service that fits your home</span></div>
          </div>
          {heroImage ? <div className="hero-media"><img src={heroImage} alt={settings.home_hero_image_alt || ""} /></div> : null}
        </div>
      </section>

      <div className="trust-strip">
        <div className="trust-items">
          <div className="trust-item"><span className="trust-icon" aria-hidden="true">✓</span>Respectful, careful service</div>
          <div className="trust-item"><span className="trust-icon" aria-hidden="true">⌂</span>Solutions for your home</div>
          <div className="trust-item"><span className="trust-icon" aria-hidden="true">♡</span>A team that cares</div>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <div><p className="eyebrow">What we can help with</p><h2>Practical solutions for a more comfortable home.</h2><p>Explore our most requested services and find the right next step for your home or business.</p></div>
            <Link className="text-link" href="/services">View all services <span aria-hidden="true">→</span></Link>
          </div>
          {services.length || servicePages.length ? (
            <div className="card-grid">
              {services.slice(0, 3).map((service) => {
                const title = text(service.data.title, service.slug);
                const image = imageFor(service.data);
                return <article className="service-card" key={service.id}>
                  {image ? <img className="card-image" src={image} alt={text(service.data.imageAlt, title)} /> : null}
                  <div className="card-body"><p className="card-kicker">Our services</p><h3>{title}</h3><p>{text(service.data.description, "Personalized service from a local team that puts your needs first.").slice(0, 150)}</p>{service.data.price ? <span className="card-price">Starting at {text(service.data.price)}</span> : null}<Link className="text-link" href={`/services/${service.slug}`}>Explore service <span aria-hidden="true">→</span></Link></div>
                </article>;
              })}
              {servicePages.slice(0, Math.max(0, 3 - services.length)).map((page: any) => <article className="service-card" key={`page-${page.id}`}><div className="card-body"><p className="card-kicker">Our services</p><h3>{page.title}</h3><p>{pageSummary(page)}</p><Link className="text-link" href={`/services/${page.slug}`}>Explore service <span aria-hidden="true">→</span></Link></div></article>)}
            </div>
          ) : <div className="empty-state">Our service information is being prepared. Contact our team and we’ll help you find the right solution.</div>}
        </div>
      </section>

      <section className="section section-soft">
        <div className="container split-section">
          <div className="split-visual" aria-hidden="true"><div className="visual-badge"><strong>Local</strong><span>service you can feel good about</span></div></div>
          <div className="split-copy"><p className="eyebrow">A better kind of service</p><h2>Good work starts with listening.</h2><p>Every home is different. Our team takes time to understand what’s happening, explain your options, and recommend a plan that makes sense for you.</p><ul className="check-list"><li>Thoughtful recommendations, never guesswork</li><li>Respect for your home and your time</li><li>Helpful people you can reach when you need us</li></ul><Link className="button" href="/contact">Talk with our team <span aria-hidden="true">↗</span></Link></div>
        </div>
      </section>

      {locations.length ? <section className="section">
        <div className="container">
          <div className="section-heading"><div><p className="eyebrow">Close to home</p><h2>Proud to serve our local communities.</h2><p>Find your area and learn more about the help available near you.</p></div><Link className="text-link" href="/locations">All service areas <span aria-hidden="true">→</span></Link></div>
          <div className="card-grid">{locations.slice(0, 3).map((location) => <article className="location-card" key={location.id}><div className="card-body"><p className="card-kicker">Service area</p><h3>{text(location.data.city ?? location.data.name, location.slug)}</h3><p>{text(location.data.localProof ?? location.data.description, `Local support from ${brand}.`)}</p><Link className="text-link" href={`/locations/${location.slug}`}>Explore this area <span aria-hidden="true">→</span></Link></div></article>)}</div>
        </div>
      </section> : null}

      <section className="section section-soft">
        <div className="container cta-band"><div><p className="eyebrow">Ready when you are</p><h2>Let’s make your space feel like yours again.</h2><p>Tell us what’s going on. We’ll help you figure out what to do next.</p></div><Link className="button" href="/contact">Get a free estimate <span aria-hidden="true">↗</span></Link></div>
      </section>
    </div>
  );
}
