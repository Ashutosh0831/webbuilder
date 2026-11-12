"use client";

import { useEffect } from "react";
import type { ThemeTokens } from "@/lib/validations/themes";
import { generateThemeCss } from "./generate-css";

interface Props {
  tokens: ThemeTokens;
  children: React.ReactNode;
}

export function ThemePreview({ tokens, children }: Props) {
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "theme-preview";
    style.textContent = generateThemeCss(tokens, ":root");
    document.head.appendChild(style);
    return () => { document.getElementById("theme-preview")?.remove(); };
  }, [tokens]);

  return <div>{children}</div>;
}