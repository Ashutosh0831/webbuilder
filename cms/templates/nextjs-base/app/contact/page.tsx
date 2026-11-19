import Link from "next/link";
import { getForm, getPageBySlug, getPublicSiteSettings } from "@/lib/cms";
import { ContactForm } from "./ContactForm";
import PageSections from "@/components/PageSections";

export const revalidate = 3600;

async function getContactPage() {
  for (const slug of ["contact", "contact-us"]) {
    try { return await getPageBySlug("contact", slug); } catch { /* Try the next common contact page slug. */ }
  }
  return null;
}

export async function generateMetadata() {
  const page = await getContactPage();
  return { title: page?.seo_title || page?.title || "Contact Us", description: page?.seo_description || undefined };
}

export default async function ContactPage() {
  const page = await getContactPage();
  if (Array.isArray(page?.parsed_sections) && page.parsed_sections.length) {
    return <PageSections sections={page.parsed_sections} />;
  }
  const [form, settings] = await Promise.all([
    getForm("quote").catch(() => ({ name: "Request an estimate", schema: { fields: [] }, key: "quote" })),
    getPublicSiteSettings(),
  ]);
  const phoneHref = settings.phone?.replace(/[^\d+]/g, "");
  const contactEmail = settings.contact_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.contact_email) ? settings.contact_email : null;
  const hasForm = Array.isArray(form.schema?.fields) && form.schema.fields.length > 0;
  return <div className="page-wrap">
    <section className="inner-hero"><div className="container"><p className="eyebrow">We’re ready to listen</p><h1>Let’s talk about what you need.</h1><p>Share a few details and a friendly member of our team will help you figure out the next step.</p></div></section>
    <section className="section"><div className="container contact-layout">
      <div className="contact-panel"><h2>{form.name ?? "Request an estimate"}</h2>{hasForm ? <><p>Complete the form and our local team will be in touch shortly.</p><ContactForm formKey={form.key} schema={form.schema} /></> : <div className="empty-state"><p>Our online request form is being set up. Please contact our team and we’ll be happy to help.</p>{settings.phone && phoneHref ? <a className="button" href={`tel:${phoneHref}`}>Call {settings.phone}</a> : null}</div>}</div>
      <aside className="contact-aside"><p className="eyebrow">A real person, right here</p><h2>We’re happy to help.</h2><p>Have a question or prefer to talk? Reach out and our team will point you in the right direction.</p>{settings.phone ? <div className="info-row"><span aria-hidden="true">☎</span><div><strong>Call us</strong><a href={`tel:${phoneHref}`}>{settings.phone}</a></div></div> : null}{contactEmail ? <div className="info-row"><span aria-hidden="true">✉</span><div><strong>Email us</strong><a href={`mailto:${contactEmail}`}>{contactEmail}</a></div></div> : null}{settings.service_area || settings.area_name ? <div className="info-row"><span aria-hidden="true">⌖</span><div><strong>Service area</strong>{settings.service_area || settings.area_name}</div></div> : null}<p>We’ll listen, answer your questions, and make sure you know what to expect.</p><Link className="text-link" href="/services">Browse our services <span aria-hidden="true">→</span></Link></aside>
    </div></section>
  </div>;
}
