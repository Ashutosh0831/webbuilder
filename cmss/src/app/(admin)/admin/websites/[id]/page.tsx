import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getWebsiteById } from "@/server/services/website";
import { requireAuth } from "@/server/authz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { FileText, Image as ImageIcon, Palette } from "lucide-react";

// Remove export const dynamic = "force-dynamic";

export default function WebsiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading website details...</div>}>
      <WebsiteDetails params={params} />
    </Suspense>
  );
}

// Move all the data fetching logic into this inner component
async function WebsiteDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const website = await getWebsiteById(id, user.id, user.role ?? "");

  if (!website) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{website.name}</h1>
        
        <div className="flex gap-2">
          <Link 
            href={`/dashboard/websites/${website.id}/pages`} 
            className={buttonVariants({ variant: "outline" })}
          >
            <FileText className="mr-2 h-4 w-4" /> Manage Pages
          </Link>
          
          <Link 
            href={`/dashboard/media`} 
            className={buttonVariants({ variant: "outline" })}
          >
            <ImageIcon className="mr-2 h-4 w-4" /> Media Library
          </Link>
          
          <Link 
            href={`/dashboard/themes`} 
            className={buttonVariants({ variant: "outline" })}
          >
            <Palette className="mr-2 h-4 w-4" /> Themes
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>Slug:</strong> {website.slug}</p>
          <p><strong>Status:</strong> {website.status}</p>
          <p><strong>Customer:</strong> {website.customer.name}</p>
          <p><strong>Locale:</strong> {website.locale}</p>
          <p><strong>Timezone:</strong> {website.timezone}</p>
          <p><strong>Pages:</strong> {website._count.pages}</p>
          <p><strong>Media:</strong> {website._count.media}</p>
          {website.description && <p><strong>Description:</strong> {website.description}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Members</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {website.members.map((m) => (
              <li key={m.user.id}>{m.user.name} ({m.user.email}) · {m.role.name}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Domains</CardTitle></CardHeader>
        <CardContent>
          {website.domains.length === 0 ? (
            <p className="text-sm text-muted-foreground">No custom domains configured.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {website.domains.map((d) => <li key={d.id}>{d.domain} · {d.status}</li>)}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}