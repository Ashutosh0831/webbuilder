import type { ThemeTokens } from "@/lib/validations/themes";

export const defaultTokens: ThemeTokens = {
  colors: {
    background: "#ffffff",
    foreground: "#0f172a",
    primary: "#1f6feb",
    "primary-foreground": "#ffffff",
    secondary: "#f1f5f9",
    "secondary-foreground": "#0f172a",
    muted: "#f8fafc",
    "muted-foreground": "#64748b",
    accent: "#e2e8f0",
    "accent-foreground": "#0f172a",
    border: "#e2e8f0",
  },
  typography: {
    "font-sans": "Inter, system-ui, sans-serif",
    "font-heading": "Inter, system-ui, sans-serif",
    "font-size-base": "16px",
    "font-size-h1": "36px",
    "font-size-h2": "30px",
    "line-height-base": "1.5",
  },
  spacing: {
    "spacing-sm": "8px",
    "spacing-md": "16px",
    "spacing-lg": "24px",
    "spacing-xl": "32px",
  },
  radius: { sm: "4px", md: "8px", lg: "16px" },
  shadows: {
    sm: "0 1px 2px rgba(0,0,0,0.05)",
    md: "0 4px 6px rgba(0,0,0,0.1)",
    lg: "0 10px 15px rgba(0,0,0,0.1)",
  },
  buttons: { radius: "8px", "padding-x": "20px", "padding-y": "10px" },
  containers: { "max-width": "1200px" },
};