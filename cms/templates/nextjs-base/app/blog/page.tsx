import Link from "next/link";
import { getEntries } from "@/lib/cms";

export const revalidate = 60;

export const metadata = {
  title: "Blog | " + (process.env.NEXT_PUBLIC_SITE_NAME ?? "Site"),
};

export default async function BlogListPage() {
  const posts = await getEntries("blog");

  return (
    <div>
      <h1>Blog</h1>
      <div className="grid">
        {posts.map((p) => (
          <div key={p.id} className="card">
            <h3>{String(p.data.title ?? p.slug)}</h3>
            <Link href={`/blog/${p.slug}`}>Read →</Link>
          </div>
        ))}
      </div>
    </div>
  );
}