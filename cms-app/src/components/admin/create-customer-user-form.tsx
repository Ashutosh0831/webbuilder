"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { inviteUserAction } from "@/server/actions/customer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateCustomerUserForm({
  customerId,
  contactEmail,
}: {
  customerId: string;
  contactEmail: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    try {
      const result = await inviteUserAction(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Customer login created. The customer can now sign in.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create customer login.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form action={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="customerId" value={customerId} />
      <div className="space-y-2">
        <Label htmlFor={`customer-user-name-${customerId}`}>Full name</Label>
        <Input id={`customer-user-name-${customerId}`} name="name" required minLength={1} maxLength={100} placeholder="Customer name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`customer-user-email-${customerId}`}>Login email</Label>
        <Input id={`customer-user-email-${customerId}`} name="email" type="email" required defaultValue={contactEmail} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`customer-user-password-${customerId}`}>Temporary password</Label>
        <Input id={`customer-user-password-${customerId}`} name="password" type="password" required minLength={12} autoComplete="new-password" />
        <p className="text-xs text-muted-foreground">At least 12 characters. Use a unique password and share it securely.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`customer-user-role-${customerId}`}>Access role</Label>
        <select
          id={`customer-user-role-${customerId}`}
          name="role"
          defaultValue="website_owner"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="website_owner">Website Owner</option>
          <option value="editor">Editor</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating login..." : "Create customer login"}
        </Button>
      </div>
    </form>
  );
}
