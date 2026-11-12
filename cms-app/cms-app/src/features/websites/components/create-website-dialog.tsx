"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createWebsiteSchema,
} from "@/lib/validations/website";
import type { z } from "zod";

type CreateWebsiteInput = z.input<typeof createWebsiteSchema>;
type CreateWebsiteOutput = z.output<typeof createWebsiteSchema>;

export function CreateWebsiteDialog() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateWebsiteInput, undefined, CreateWebsiteOutput>({
    resolver: zodResolver(createWebsiteSchema),
    defaultValues: {
      name: "",
      slug: "",
      locale: "en",
    },
  });

  async function onSubmit(values: CreateWebsiteOutput) {
    setIsSubmitting(true);
    try {
      // Placeholder: replace with actual server action
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Website created", {
        description: `"${values.name}" has been created successfully.`,
      });
      form.reset();
      setOpen(false);
    } catch {
      toast.error("Failed to create website", {
        description: "Please check your connection and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
          <Plus className="mr-2 h-4 w-4" />
          Create Website
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Website</DialogTitle>
          <DialogDescription>
            Add a new website to your workspace. You can configure domains and
            themes after creation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <div className="space-y-2">
                <label htmlFor={field.name} className="text-sm font-medium">
                  Website Name
                </label>
                <Input
                  {...field}
                  id={field.name}
                  placeholder="My Company Site"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.error ? `${field.name}-error` : undefined
                  }
                />
                {fieldState.error && (
                  <p
                    id={`${field.name}-error`}
                    className="text-sm font-medium text-destructive"
                  >
                    {fieldState.error.message}
                  </p>
                )}
              </div>
            )}
          />

          <Controller
            control={form.control}
            name="slug"
            render={({ field, fieldState }) => (
              <div className="space-y-2">
                <label htmlFor={field.name} className="text-sm font-medium">
                  Slug
                </label>
                <Input
                  {...field}
                  id={field.name}
                  placeholder="my-company-site"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.error
                      ? `${field.name}-error`
                      : `${field.name}-description`
                  }
                />
                <p
                  id={`${field.name}-description`}
                  className="text-sm text-muted-foreground"
                >
                  Used in the subdomain: {field.value || "slug"}.cms.app
                </p>
                {fieldState.error && (
                  <p
                    id={`${field.name}-error`}
                    className="text-sm font-medium text-destructive"
                  >
                    {fieldState.error.message}
                  </p>
                )}
              </div>
            )}
          />

          <Controller
            control={form.control}
            name="locale"
            render={({ field, fieldState }) => (
              <div className="space-y-2">
                <label htmlFor={field.name} className="text-sm font-medium">
                  Default Locale
                </label>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.error ? `${field.name}-error` : undefined
                    }
                    className="w-full"
                  >
                    <SelectValue placeholder="Select locale" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                  </SelectContent>
                </Select>
                {fieldState.error && (
                  <p
                    id={`${field.name}-error`}
                    className="text-sm font-medium text-destructive"
                  >
                    {fieldState.error.message}
                  </p>
                )}
              </div>
            )}
          />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Website"}
              </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}