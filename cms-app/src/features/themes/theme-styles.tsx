const allowedTokens = new Set([
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
]);

const safeColorValue = /^(?:#[\da-f]{3,8}|[a-z]+|(?:rgb|hsl|oklch)\([\d\s.,%/-]+\))$/i;

export function ThemeStyles({ tokens }: { tokens: unknown }) {
  if (!tokens || typeof tokens !== "object" || Array.isArray(tokens)) return null;

  const declarations = Object.entries(tokens)
    .filter(
      ([key, value]) =>
        allowedTokens.has(key) &&
        typeof value === "string" &&
        safeColorValue.test(value),
    )
    .map(([key, value]) => `--${key}:${value};`)
    .join("");

  return declarations ? <style>{`:root{${declarations}}`}</style> : null;
}
