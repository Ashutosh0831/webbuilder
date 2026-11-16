import { notFound } from "next/navigation";
import { getEntry } from "@/lib/cms";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  try {
    const { seo } = await getEntry("blog", params.slug);
    return { title: seo.title, description: seo.description };
  } catch {
    return { title: "Post" };
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  let result;
  try {
    result = await getEntry("blog", params.slug);
  } catch {
    notFound();
  }
  const { entry } = result;

  return (
    <article>
      <h1>{String(entry.data.title ?? entry.slug)}</h1>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
        {String(entry.data.body ?? "")}
      </div>
    </article>
  );
}