import type { ThemeTokens } from "@/lib/validations/themes";

export function generateThemeCss(tokens: ThemeTokens, scope: string = ":root"): string {
  const lines: string[] = [`${scope} {`];

  for (const [key, value] of Object.entries(tokens.colors)) {
    lines.push(`  --color-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(tokens.typography)) {
    lines.push(`  --${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(tokens.spacing)) {
    lines.push(`  --${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(tokens.radius)) {
    lines.push(`  --radius-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(tokens.shadows)) {
    lines.push(`  --shadow-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(tokens.buttons)) {
    lines.push(`  --button-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(tokens.containers)) {
    lines.push(`  --container-${key}: ${value};`);
  }

  lines.push("}");
  return lines.join("\n");
}

export function generateThemeCssForWebsite(tokens: ThemeTokens, websiteId: string): string {
  // Scope to a data attribute so multiple themes can coexist on a page
  return generateThemeCss(tokens, `[data-theme="${websiteId}"]`);
}