"use client";

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
  const form = useForm({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: { name: "", company: "", contactEmail: "", plan: "free", websiteQuota: 3, storageQuota: 1073741824 },
  });

  async function onSubmit(data: unknown) {
    const formData = new FormData();
    Object.entries(data as Record<string, unknown>).forEach(([k, v]) => formData.set(k, String(v)));
    const result = await createCustomerAction(formData);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Customer created");
      router.push("/admin/customers");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Create Customer</h1>

      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...form.register("name")} />
        {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
      </div>

      <div>
        <Label htmlFor="contactEmail">Contact Email</Label>
        <Input id="contactEmail" type="email" {...form.register("contactEmail")} />
      </div>

      <Button type="submit">Create</Button>
    </form>
  );
}