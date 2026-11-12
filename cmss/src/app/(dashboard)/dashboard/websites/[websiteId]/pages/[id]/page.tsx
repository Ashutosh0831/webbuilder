import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/server/authz";
import { prisma } from "@/server/db/prisma";
import { buttonVariants } from "@/components/ui/button";
import { LayoutTemplate, ArrowLeft } from "lucide-react";
import { PageEditor } from "@/components/page-editor"; // Assuming you have this from Prompt 13

export default function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading page editor...</div>}>
      <PageLoader params={params} />
    </Suspense>
  );
}

async function PageLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();

  // Fetch the page and make sure the user has access to it
  const page = await prisma.page.findFirst({
    where: { 
      id, 
      deletedAt: null,
      // Basic check: super_admin can edit any, others must be in the same customer
      ...(user.role !== "super_admin" && {
        website: { customer: { users: { some: { id: user.id } } } }
      })
    },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 }
    }
  });

  if (!page) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/websites/${page.websiteId}/pages`} className={buttonVariants({ variant: "outline", size: "icon" })}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-bold">Edit Page: {page.title}</h1>
        </div>
        
        {/* This is the button that opens the drag-and-drop builder */}
        <Link 
          href={`/builder/${page.websiteId}/${page.id}`}
          className={buttonVariants({ variant: "default" })}
        >
          <LayoutTemplate className="mr-2 h-4 w-4" /> Open Visual Builder
        </Link>
      </div>

      {/* We pass the page data to the PageEditor component */}
      <PageEditor 
        page={{
          id: page.id,
          title: page.title,
          slug: page.slug,
          status: page.status,
          seo: page.seo,
          // We pass the latest draft version ID if it exists
          latestVersionId: page.versions[0]?.id ?? null
        }} 
      />
    </div>
  );
}