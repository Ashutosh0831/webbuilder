import { notFound } from "next/navigation";
import { getEntry } from "@/lib/cms";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  try {
    const { seo } = await getEntry("location", params.slug);
    return { title: seo.title, description: seo.description };
  } catch {
    return { title: "Location" };
  }
}

export default async function LocationPage({
  params,
}: {
  params: { slug: string };
}) {
  let result;
  try {
    result = await getEntry("location", params.slug);
  } catch {
    notFound();
  }
  const { entry } = result;

  return (
    <article>
      <h1>Pest Control in {String(entry.data.city ?? entry.slug)}</h1>
      <p>{String(entry.data.address ?? "")}</p>
      <p>Call: {String(entry.data.phone ?? "")}</p>
      <p style={{ marginTop: "1.5rem", fontStyle: "italic" }}>
        {String(entry.data.localProof ?? "")}
      </p>
    </article>
  );
}