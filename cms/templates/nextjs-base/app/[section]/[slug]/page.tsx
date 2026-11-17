import { notFound } from "next/navigation";
import { getPageBySlug } from "@/lib/cms";
import PageSections from "@/components/PageSections";

export const revalidate = 0;

export async function generateMetadata({ params }: { params: { section: string; slug: string } }) {
  try {
    const page = await getPageBySlug(params.section, params.slug);
    return {
      title: page.seo_title || page.title,
      description: page.seo_description || "",
      alternates: page.seo_canonical ? { canonical: page.seo_canonical } : undefined,
      robots: page.seo_robots || undefined,
      openGraph: page.seo_og_image ? { images: [page.seo_og_image] } : undefined,
    };
  } catch {
    return { title: "Not Found" };
  }
}

export default async function DynamicPage({ params }: { params: { section: string; slug: string } }) {
  let pageData;
  try {
    pageData = await getPageBySlug(params.section, params.slug);
  } catch {
    notFound();
  }
  return <PageSections sections={pageData.parsed_sections || []} />;
}
