import { notFound } from "next/navigation";
import { getPageById } from "@/server/services/page";
import { requireAuth } from "@/server/authz";
import { PageEditor } from "@/components/page-editor";

export default async function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();

  let page;
  try {
    page = await getPageById(id, user.id, user.role ?? "");
  } catch {
    notFound();
  }

  const latestDraft = page.versions.find((v) => !v.isPublished);
  const published = page.versions.find((v) => v.isPublished);

  return (
    <PageEditor
      page={{
        id: page.id,
        title: page.title,
        slug: page.slug,
        seo: page.seo,
        status: page.status,
        versions: page.versions,
      }}
      latestDraftContent={latestDraft?.id ?? null}
      publishedVersionId={published?.id ?? null}
    />
  );
}