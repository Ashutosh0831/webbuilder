"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createWebsiteSchema } from "@/lib/validations/website";
import { createWebsiteAction } from "@/server/actions/website";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewWebsitePage() {
  const router = useRouter();
  const form = useForm({
    resolver: zodResolver(createWebsiteSchema),
    defaultValues: { customerId: "", name: "", slug: "", description: "", locale: "en", timezone: "UTC" },
  });

  async function onSubmit(data: unknown) {
    const formData = new FormData();
    Object.entries(data as Record<string, unknown>).forEach(([k, v]) => formData.set(k, String(v ?? "")));
    const result = await createWebsiteAction(formData);
    if (result.error) toast.error(result.error);
    else { toast.success("Website created"); router.push("/admin/websites"); }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Create Website</h1>

      <div>
        <Label htmlFor="customerId">Customer ID</Label>
        <Input id="customerId" {...form.register("customerId")} />
        {form.formState.errors.customerId && <p className="text-sm text-destructive">{form.formState.errors.customerId.message}</p>}
      </div>

      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...form.register("name")} />
      </div>

      <div>
        <Label htmlFor="slug">Slug</Label>
        <Input id="slug" {...form.register("slug")} />
        {form.formState.errors.slug && <p className="text-sm text-destructive">{form.formState.errors.slug.message}</p>}
      </div>

      <Button type="submit">Create</Button>
    </form>
  );
}