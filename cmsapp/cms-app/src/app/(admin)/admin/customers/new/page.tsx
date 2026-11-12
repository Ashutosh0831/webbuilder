"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createCustomerAction } from "@/server/actions/customer";
import { createCustomerSchema } from "@/lib/validations/customer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewCustomerPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: { name: "", company: "", contactEmail: "", plan: "free", websiteQuota: 3, storageQuota: 1073741824 },
  });

  async function onSubmit(data: unknown) {
    setIsSubmitting(true);
    const formData = new FormData();
    Object.entries(data as Record<string, unknown>).forEach(([key, value]) => formData.set(key, String(value ?? "")));
    try {
      const result = await createCustomerAction(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Customer created. Next, create their Website Owner login.");
      router.push("/admin/customers");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Create Customer</h1>
        <p className="text-sm text-muted-foreground">Create the customer record first. You will create their login from the customer detail page.</p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="name">Customer name</Label>
        <Input id="name" {...form.register("name")} />
        {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="company">Company (optional)</Label>
        <Input id="company" {...form.register("company")} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="contactEmail">Contact email</Label>
        <Input id="contactEmail" type="email" {...form.register("contactEmail")} />
        {form.formState.errors.contactEmail && <p className="text-sm text-destructive">{form.formState.errors.contactEmail.message}</p>}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating customer..." : "Create customer"}
      </Button>
    </form>
  );
}
