import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntry, getPageBySlug } from "@/lib/cms";
import PageSections from "@/components/PageSections";

export const revalidate = 3600;

async function getBlogPage(slug: string) {
  try { return await getPageBySlug("blog", slug); } catch { return null; }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const page = await getBlogPage(params.slug);
  if (page) return { title: page.seo_title || page.title, description: page.seo_description || undefined };
  try {
    const { entry, seo } = await getEntry("blog", params.slug);
    return { title: seo.title || String(entry.data.title ?? entry.slug), description: seo.description };
  } catch {
    return { title: "Article" };
  }
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const page = await getBlogPage(params.slug);
  if (Array.isArray(page?.parsed_sections) && page.parsed_sections.length) {
    return <PageSections sections={page.parsed_sections} />;
  }
  let result;
  try { result = await getEntry("blog", params.slug); } catch { notFound(); }
  const { entry } = result;
  const title = String(entry.data.title ?? entry.slug);
  const body = String(entry.data.body ?? entry.data.content ?? "");
  return <article className="page-wrap">
    <section className="inner-hero"><div className="container article-header"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/blog">Resources</Link><span>/</span><span>{title}</span></nav><p className="eyebrow">Helpful advice</p><h1>{title}</h1>{entry.data.excerpt ? <p>{String(entry.data.excerpt)}</p> : null}</div></section>
    <div className="article-body container">{entry.data.image && typeof entry.data.image === "string" ? <img className="detail-image" src={entry.data.image} alt={String(entry.data.imageAlt ?? title)} /> : null}{body.split(/\n{2,}/).map((paragraph: string, index: number) => <p key={index}>{paragraph}</p>)}<Link className="text-link" href="/blog">← Back to resources</Link></div>
  </article>;
}
