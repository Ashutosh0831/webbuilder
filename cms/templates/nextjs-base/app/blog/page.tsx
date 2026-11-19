import Link from "next/link";
import { getEntries, getPageBySlug } from "@/lib/cms";
import PageSections from "@/components/PageSections";

export const revalidate = 3600;
async function getBlogLandingPage() {
  for (const slug of ["blog", "resources"]) {
    try { return await getPageBySlug("blog", slug); } catch { /* Try the next common blog landing page slug. */ }
  }
  return null;
}

export async function generateMetadata() {
  const page = await getBlogLandingPage();
  return { title: page?.seo_title || page?.title || "Helpful Resources", description: page?.seo_description || undefined };
}

export default async function BlogListPage() {
  const page = await getBlogLandingPage();
  if (Array.isArray(page?.parsed_sections) && page.parsed_sections.length) {
    return <PageSections sections={page.parsed_sections} />;
  }
  const posts = await getEntries("blog").catch(() => []);
  return <div className="page-wrap">
    <section className="inner-hero"><div className="container"><p className="eyebrow">Tips from our team</p><h1>Helpful ideas for your home.</h1><p>Explore practical advice and answers from people who work in your community every day.</p></div></section>
    <section className="section"><div className="container">{posts.length ? <div className="card-grid">{posts.map((post) => {
      const title = String(post.data.title ?? post.slug);
      const imageValue = post.data.image ?? post.data.imageUrl;
      const image = typeof imageValue === "string" && /^https?:\/\//i.test(imageValue) ? imageValue : null;
      return <article className="article-card" key={post.id}>{image ? <img className="card-image" src={image} alt={String(post.data.imageAlt ?? title)} /> : null}<div className="card-body"><p className="card-kicker">From the resource library</p><h2>{title}</h2><p>{String(post.data.excerpt ?? post.data.description ?? post.data.body ?? "Helpful information from our local team.").slice(0, 170)}</p><Link className="text-link" href={`/blog/${post.slug}`}>Read article <span aria-hidden="true">→</span></Link></div></article>;
    })}</div> : <div className="empty-state">Helpful resources are coming soon. In the meantime, <Link href="/contact">ask our team a question</Link>.</div>}</div></section>
  </div>;
}
