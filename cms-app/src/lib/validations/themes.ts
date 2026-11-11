import { z } from "zod";

const hexOrOklch = z.string().regex(
  /^(#[0-9a-fA-F]{3,8}|oklch\([^)]+\)|rgb\([^)]+\)|hsl\([^)]+\))$/,
  "Must be a valid color (hex, oklch, rgb, or hsl)"
);

const cssLength = z.string().regex(
  /^\d+(\.\d+)?(px|rem|em|%)$/,
  "Must be a valid CSS length (e.g., 16px, 1rem)"
);

export const themeTokensSchema = z.object({
  colors: z.object({
    background: hexOrOklch,
    foreground: hexOrOklch,
    primary: hexOrOklch,
    "primary-foreground": hexOrOklch,
    secondary: hexOrOklch,
    "secondary-foreground": hexOrOklch,
    muted: hexOrOklch,
    "muted-foreground": hexOrOklch,
    accent: hexOrOklch,
    "accent-foreground": hexOrOklch,
    border: hexOrOklch,
  }),
  typography: z.object({
    "font-sans": z.string().max(200),
    "font-heading": z.string().max(200),
    "font-size-base": cssLength,
    "font-size-h1": cssLength,
    "font-size-h2": cssLength,
    "line-height-base": z.string().regex(/^\d+(\.\d+)?$/),
  }),
  spacing: z.object({
    "spacing-sm": cssLength,
    "spacing-md": cssLength,
    "spacing-lg": cssLength,
    "spacing-xl": cssLength,
  }),
  radius: z.object({
    sm: cssLength,
    md: cssLength,
    lg: cssLength,
  }),
  shadows: z.object({
    sm: z.string().max(200),
    md: z.string().max(200),
    lg: z.string().max(200),
  }),
  buttons: z.object({
    "radius": cssLength,
    "padding-x": cssLength,
    "padding-y": cssLength,
  }),
  containers: z.object({
    "max-width": cssLength,
  }),
});

export type ThemeTokens = z.infer<typeof themeTokensSchema>;