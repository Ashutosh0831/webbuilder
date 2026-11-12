import { z } from "zod";

export const addDomainSchema = z.object({
  websiteId: z.string().uuid(),
  domain: z.string()
    .min(4, "Domain too short")
    .max(253, "Domain too long")
    .regex(
      /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$/,
      "Invalid domain format"
    )
    .transform((d) => d.toLowerCase()),
});