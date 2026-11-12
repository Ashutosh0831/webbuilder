import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(1, "Name required").max(100),
  company: z.string().max(100).optional(),
  contactEmail: z.string().email("Valid email required"),
  plan: z.string().default("free"),
  websiteQuota: z.coerce.number().int().min(0).default(3),
  storageQuota: z.coerce.number().int().min(0).default(1073741824),
});

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  id: z.string().uuid(),
});

export const inviteUserSchema = z.object({
  customerId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(["website_owner", "editor"]),
  password: z.string().min(12, "Password must be at least 12 characters"),
});

export const customerFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "PENDING", "ARCHIVED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});