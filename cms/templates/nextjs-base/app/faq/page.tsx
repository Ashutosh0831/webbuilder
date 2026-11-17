import { getEntries, getPageBySlug } from "@/lib/cms";
import PageSections from "@/components/PageSections";

export const revalidate = 0;
async function getFaqPage() {
  for (const slug of ["faq", "faqs", "frequently-asked-questions"]) {
    try { return await getPageBySlug("faq", slug); } catch { /* Try the next common FAQ page slug. */ }
  }
  return null;
}

export async function generateMetadata() {
  const page = await getFaqPage();
  return { title: page?.seo_title || page?.title || "Frequently Asked Questions", description: page?.seo_description || undefined };
}

export default async function FaqPage() {
  const page = await getFaqPage();
  if (Array.isArray(page?.parsed_sections) && page.parsed_sections.length) {
    return <PageSections sections={page.parsed_sections} />;
  }
  const faqs = await getEntries("faq").catch(() => []);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: String(faq.data.question ?? ""),
      acceptedAnswer: { "@type": "Answer", text: String(faq.data.answer ?? "") },
    })),
  };
  return <div className="page-wrap">
    <section className="inner-hero"><div className="container"><p className="eyebrow">A few helpful answers</p><h1>Questions? We’re glad you asked.</h1><p>Here are answers to common questions. If you need a little more help, our team is just a message away.</p></div></section>
    <section className="section"><div className="container faq-page-content">{faqs.length ? <div className="cms-faq-list">{faqs.map((faq) => <details className="cms-faq-item" key={faq.id}><summary>{String(faq.data.question ?? faq.slug)}</summary><p>{String(faq.data.answer ?? "")}</p></details>)}</div> : <div className="empty-state">We’re adding answers to common questions. <a href="/contact">Contact us</a> and we’ll be happy to help.</div>}</div></section>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
  </div>;
}
