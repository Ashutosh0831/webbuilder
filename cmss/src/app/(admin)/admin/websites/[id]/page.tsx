import { notFound } from "next/navigation";
import { getWebsiteById } from "@/server/services/website";
import { requireAuth } from "@/server/authz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const instant = false;

export default async function WebsiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const website = await getWebsiteById(id, user.id, user.role ?? "");
  if (!website) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{website.name}</h1>
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