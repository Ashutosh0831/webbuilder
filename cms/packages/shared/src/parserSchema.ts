import { z } from "zod";

export const PARSER_SCHEMA_VERSION = "1.0" as const;

export const parsedListItemSchema = z.object({
  text: z.string(),
  children: z.array(z.string()).optional(),
});

export const parsedSectionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hero"),
    data: z.object({
      h1: z.string().min(1),
      subheadline: z.string().default(""),
    }),
  }),
  z.object({
    type: z.literal("introduction"),
    data: z.object({
      title: z.string().optional(),
      content: z.string().min(1),
    }),
  }),
  z.object({
    type: z.literal("heading"),
    data: z.object({
      level: z.number().int().min(1).max(6),
      text: z.string().min(1),
    }),
  }),
  z.object({
    type: z.literal("text"),
    data: z.object({
      content: z.string().min(1),
    }),
  }),
  z.object({
    type: z.literal("services"),
    data: z.object({
      title: z.string().optional(),
      items: z.array(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
        })
      ),
    }),
  }),
  z.object({
    type: z.literal("features"),
    data: z.object({
      title: z.string().optional(),
      items: z.array(
        z.object({
          title: z.string().min(1),
          description: z.string().optional(),
        })
      ),
    }),
  }),
  z.object({
    type: z.literal("faqs"),
    data: z.object({
      title: z.string().min(1),
      groupId: z.string().optional(),
      items: z.array(
        z.object({
          question: z.string().min(1),
          answer: z.string(),
        })
      ),
    }),
  }),
  z.object({
    type: z.literal("locations"),
    data: z.object({
      title: z.string().min(1),
      areas: z.array(z.string().min(1)),
    }),
  }),
  z.object({
    type: z.literal("cta"),
    data: z.object({
      label: z.string().min(1),
      href: z.string().min(1),
      actions: z
        .array(z.object({ label: z.string().min(1), href: z.string().min(1) }))
        .optional(),
    }),
  }),
  z.object({
    type: z.literal("booking"),
    data: z.object({
      title: z.string().min(1),
      subtitle: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("table"),
    data: z.object({
      headers: z.array(z.string()),
      rows: z.array(z.array(z.string())),
    }),
  }),
  z.object({
    type: z.literal("list"),
    data: z.object({
      ordered: z.boolean(),
      items: z.array(z.string()),
      nested: z.array(parsedListItemSchema).optional(),
    }),
  }),
  z.object({
    type: z.literal("image"),
    data: z.object({
      src: z.string().min(1),
      alt: z.string(),
      caption: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("testimonials"),
    data: z.object({
      title: z.string().optional(),
      items: z.array(
        z.object({
          quote: z.string().min(1),
          author: z.string().optional(),
        })
      ),
    }),
  }),
  z.object({
    type: z.literal("custom"),
    data: z.object({
      title: z.string(),
      content: z.string(),
    }),
  }),
]);

export type ParsedSection = z.infer<typeof parsedSectionSchema>;

export const pageSeoMetadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  canonical: z.string().optional(),
});

export type PageSeoMetadata = z.infer<typeof pageSeoMetadataSchema>;

export const parseDiagnosticSchema = z.object({
  code: z.string(),
  message: z.string(),
  line: z.number().int().positive().optional(),
});

export type ParseDiagnostic = z.infer<typeof parseDiagnosticSchema>;

export const parseDocumentResultSchema = z.object({
  schemaVersion: z.literal(PARSER_SCHEMA_VERSION),
  sections: z.array(parsedSectionSchema),
  seo: pageSeoMetadataSchema,
  warnings: z.array(parseDiagnosticSchema),
  errors: z.array(parseDiagnosticSchema),
  unresolvedPlaceholders: z.array(z.string()),
  unknownSections: z.array(z.string()),
});

export type ParseDocumentResult = z.infer<typeof parseDocumentResultSchema>;
