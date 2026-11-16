import { notFound } from "next/navigation";
import { getEntry } from "@/lib/cms";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  try {
    const { seo } = await getEntry("service", params.slug);
    return {
      title: seo.title,
      description: seo.description,
      alternates: { canonical: seo.canonical },
      robots: seo.robots,
    };
  } catch {
    return { title: "Service" };
  }
}

export default async function ServicePage({
  params,
}: {
  params: { slug: string };
}) {
  let result;
  try {
    result = await getEntry("service", params.slug);
  } catch {
    notFound();
  }
  const { entry, relations } = result;

  return (
    <article>
      <h1>{String(entry.data.title ?? entry.slug)}</h1>
      <p style={{ fontSize: "1.1rem", lineHeight: 1.6 }}>
        {String(entry.data.description ?? "")}
      </p>
      {entry.data.price ? (
        <p className="price">Starting at {String(entry.data.price)}</p>
      ) : null}

      {relations.related_faq && relations.related_faq.length > 0 && (
        <>
          <h2>Related FAQs</h2>
          {relations.related_faq.map((faq: any) => (
            <div key={faq.id} className="card" style={{ marginBottom: 12 }}>
              <strong>{String(faq.data.question ?? "")}</strong>
              <p>{String(faq.data.answer ?? "")}</p>
            </div>
          ))}
        </>
      )}
    </article>
  );
}