"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWebsiteAction } from "@/server/actions/website";

interface CustomerOption {
  id: string;
  name: string;
  contactEmail: string;
  status: string;
}

export function NewWebsiteForm({
  customers,
  initialCustomerId,
}: {
  customers: CustomerOption[];
  initialCustomerId?: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    try {
      const result = await createWebsiteAction(formData);
      if (!result.success) {
        toast.error(result.error ?? "Unable to create website.");
        return;
      }
      toast.success("Website created and assigned to its Website Owner.");
      router.push(result.websiteId ? `/admin/websites/${result.websiteId}` : "/admin/websites");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create website.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="customerId">Customer</Label>
        <select
          id="customerId"
          name="customerId"
          required
          defaultValue={initialCustomerId ?? ""}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="" disabled>Select a customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name} · {customer.contactEmail} · {customer.status}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required maxLength={100} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">Site slug</Label>
        <Input
          id="slug"
          name="slug"
          required
          minLength={2}
          maxLength={50}
          pattern="[a-z0-9-]+"
          title="Use lowercase letters, numbers, and hyphens."
        />
        <p className="text-xs text-muted-foreground">Used for the managed site address.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" maxLength={500} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="locale">Locale</Label>
          <select
            id="locale"
            name="locale"
            defaultValue="en"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Input id="timezone" name="timezone" defaultValue="UTC" required />
        </div>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create website"}
      </Button>
    </form>
  );
}
