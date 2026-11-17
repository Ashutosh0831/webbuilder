// apps/api/src/lib/parser.ts

export interface ParsedSection {
  type: "hero" | "cta" | "booking" | "heading" | "image" | "list" | "table" | "description" | "faqs" | "locations" | "text";
  data: any;
}

export interface PageSeoMetadata {
  title?: string;
  description?: string;
  canonical?: string;
}

export function findUnresolvedPlaceholders(rawText: string): string[] {
  const pattern = /\[(?:Insert\b|Company Name|Primary City(?:\/Region)?|Sub-Location(?:\s+\d+)?|Phone Number|Years of Experience|Key Certifications\/Licenses|Service Warranty|Starting Price|Client Name(?:\s+\d+)?|IMAGE PLACEHOLDER(?:\s+\d+)?|CLIENT LOGOS PLACEHOLDER|Text Input|Number Input|Dropdown|Date Picker)[^\]]*\]/gi;
  return [...new Set(rawText.match(pattern) ?? [])];
}

function normalizeDocumentLines(rawText: string): string[] {
  return rawText
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+(?=#{1,6}\s)/g, "\n")
    .replace(/[ \t]+(?=[*+-]\s+(?:(?:\*\*)|[A-Z0-9`[]))/g, "\n")
    .split("\n")
    .map((line) => line.replace(/^\s*[*+-]\s+(?=(?:H1 Tag|Sub-headline|H2 Headline|Primary CTA Button|Detailed Description|Location Description|Form Headline|Form Subtext|Submit Button Text|Key Benefits(?:\s*\([^)]*\))?|Form Fields to Display|Customer Testimonials(?:\s*\([^)]*\))?|Location Grid\/?List|(?:(?:SEO|Meta)\s+)?(?:Title|Description|Canonical))\s*:)/i, ""));
}

export function extractPageSeo(rawText: string): PageSeoMetadata {
  const seo: PageSeoMetadata = {};
  for (const line of normalizeDocumentLines(rawText)) {
    const match = /^\s*(?:(?:SEO|Meta)\s+)?(Title|Description|Canonical)\s*:\s*(.+?)\s*$/i.exec(line);
    if (!match) continue;
    const value = match[2];
    if (match[1].toLowerCase() === "title") seo.title = value;
    if (match[1].toLowerCase() === "description") seo.description = value;
    if (match[1].toLowerCase() === "canonical") seo.canonical = value;
  }
  return seo;
}

function stripHtmlTags(value: string): string {
  return value.replace(/<\/?[a-z][^>]*>/gi, "").trim();
}

export function parsePageDocument(rawText: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  
  // A very simplified parser that looks for your headers
  // In a real app, this would be much more robust with regex
  
  const lines = normalizeDocumentLines(rawText);
  let currentSection: ParsedSection | null = null;
  let currentTextBlock: string[] = [];
  let currentFaq: { question: string; answer: string } | null = null;
  let skippingPageDetails = false;
  let skippingBookingDetails = false;
  let hasHero = false;

  const saveFaq = () => {
    if (currentFaq && currentSection?.type === "faqs") {
      currentSection.data.items.push(currentFaq);
      currentFaq = null;
    }
  };

  const saveCurrent = () => {
    if (!currentSection) return;
    saveFaq();
    if (currentSection.type === "text") {
      currentSection.data.content = currentTextBlock.join('\n').trim();
    }
    if (currentSection.data.content || currentSection.data.h1 || currentSection.data.title || currentSection.data.text || currentSection.data.src || currentSection.data.label || currentSection.data.headers || currentSection.data.items || currentSection.data.areas) {
      sections.push(currentSection);
    }
    currentTextBlock = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/(?:Image Prompt\/Alt-Text|Client Logos Strip):/i.test(trimmed)) continue;
    if (/^(?:(?:SEO|Meta)\s+)?(?:Title|Description|Canonical)\s*:/i.test(trimmed)) continue;

    const markdownImage = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/.exec(trimmed);
    if (markdownImage && /^(?:https?:\/\/|\/)/i.test(markdownImage[2])) {
      saveCurrent();
      currentSection = {
        type: "image",
        data: { alt: markdownImage[1], src: markdownImage[2], caption: markdownImage[3] ?? "" },
      };
      continue;
    }
    
    // 1. Detect Hero (H1)
    const markdownHeading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(trimmed);
    if (skippingPageDetails) {
      if (markdownHeading && /REQUIRED PAGE STRUCTURE/i.test(markdownHeading[2])) skippingPageDetails = false;
      else continue;
      continue;
    }
    if (skippingBookingDetails) {
      if (markdownHeading) skippingBookingDetails = false;
      else {
        const formHeadline = /^Form Headline:\s*(.+)$/i.exec(trimmed);
        const formSubtext = /^Form Subtext:\s*(.+)$/i.exec(trimmed);
        if (currentSection?.type === "booking" && formHeadline) currentSection.data.title = formHeadline[1].replace(/[`*_]/g, "").trim();
        if (currentSection?.type === "booking" && formSubtext) currentSection.data.subtitle = formSubtext[1].replace(/[`*_]/g, "").trim();
        continue;
      }
    }
    if (markdownHeading && /PAGE DETAILS & REMAINING PLACEHOLDERS/i.test(markdownHeading[2])) {
      saveCurrent();
      currentSection = null;
      skippingPageDetails = true;
      continue;
    }
    if (markdownHeading && /REQUIRED PAGE STRUCTURE/i.test(markdownHeading[2])) continue;
    if (markdownHeading && /^\d+\.\s*(?:SEO Metadata|Hero Section|Service Overview|Our Step-by-Step|Trusted Clients)/i.test(markdownHeading[2])) continue;
    if (markdownHeading && /quick booking form/i.test(markdownHeading[2])) {
      saveCurrent();
      currentSection = { type: "booking", data: { title: markdownHeading[2].replace(/^\d+\.\s*/, "") } };
      skippingBookingDetails = true;
      continue;
    }
    if (trimmed.startsWith('H1 Tag:') || (markdownHeading?.[1].length === 1 && !hasHero)) {
      saveCurrent();
      const headingText = stripHtmlTags(markdownHeading?.[2] ?? trimmed.replace('H1 Tag:', '').trim());
      if (hasHero) {
        currentSection = { type: "heading", data: { level: 2, text: headingText } };
      } else {
        currentSection = { type: "hero", data: { h1: headingText, subheadline: "" } };
        hasHero = true;
      }
      continue;
    }

    const explicitHeading = /^H2 Headline:\s*(.+)$/i.exec(trimmed);
    if (explicitHeading) {
      saveCurrent();
      currentSection = { type: "heading", data: { level: 2, text: stripHtmlTags(explicitHeading[1].replace(/^`|`$/g, "")) } };
      continue;
    }

    const primaryCta = /^Primary CTA Button:\s*(.+)$/i.exec(trimmed);
    if (primaryCta) {
      saveCurrent();
      const [bookingLabel, ...otherActions] = primaryCta[1].split("/").map((action) => action.replace(/[`*_]/g, "").trim());
      const actions = [{ label: bookingLabel || "Book now", href: "/contact" }];
      const callAction = otherActions.find((action) => /^Call\b/i.test(action));
      const phone = callAction?.replace(/^Call\s*/i, "").replace(/[^+\d]/g, "") ?? "";
      const digits = phone.replace(/\D/g, "").length;
      if (digits >= 7 && digits <= 15) actions.push({ label: callAction!, href: `tel:${phone}` });
      currentSection = { type: "cta", data: { label: actions[0].label, href: actions[0].href, actions } };
      continue;
    }

    const labelHeading = /^(?:Key Benefits(?:\s*\([^)]*\))?|Form Fields to Display|Our Step-by-Step .* Process|Customer Testimonials.*|Location Grid\/?List):?$/i.exec(trimmed);
    if (labelHeading) {
      saveCurrent();
      currentSection = /^Location Grid\/?List:?$/i.test(trimmed)
        ? { type: "locations", data: { title: "Areas We Serve", areas: [] } }
        : { type: "heading", data: { level: 3, text: trimmed.replace(/:$/, "") } };
      continue;
    }

    const labeledCopy = /^(?:Detailed Description|Location Description|Form Subtext):\s*(.*)$/i.exec(trimmed);
    if (labeledCopy) {
      if (currentSection && currentSection.type !== "text") saveCurrent();
      if (!currentSection || currentSection.type !== "text") currentSection = { type: "text", data: { content: "" } };
      currentTextBlock.push(labeledCopy[1]);
      continue;
    }

    if (markdownHeading) {
      saveCurrent();
      currentSection = {
        type: "heading",
        data: { level: Math.max(markdownHeading[1].length, 2), text: markdownHeading[2] },
      };
      continue;
    }

    // 2. Detect FAQs
    if (trimmed.includes('Frequently Asked Questions') || trimmed.includes('FAQs')) {
      saveCurrent();
      currentSection = { type: "faqs", data: { title: trimmed, items: [] } };
      continue;
    }

    // 3. Detect Locations
    if (trimmed.includes('Areas We Serve') || trimmed.includes('Locations Covered')) {
      saveCurrent();
      currentSection = { type: "locations", data: { title: trimmed, areas: [] } };
      continue;
    }

    // 4. Parse content inside sections
    if (currentSection?.type === "hero" && trimmed.startsWith('Sub-headline:')) {
      currentSection.data.subheadline = stripHtmlTags(trimmed.replace('Sub-headline:', '').trim());
    } 
    else if (currentSection?.type === "faqs" && /^(?:Q(?:uestion)?\s*\d*\s*:\s*)/i.test(trimmed)) {
      saveFaq();
      currentFaq = {
        question: trimmed.replace(/^(?:Q(?:uestion)?\s*\d*\s*:\s*)/i, "").trim(),
        answer: "",
      };
    }
    else if (currentSection?.type === "faqs" && trimmed.endsWith("?")) {
      saveFaq();
      currentFaq = { question: trimmed, answer: "" };
    }
    else if (currentSection?.type === "faqs" && /^(?:A(?:nswer)?\s*:\s*)/i.test(trimmed)) {
      if (currentFaq) {
        currentFaq.answer = trimmed.replace(/^(?:A(?:nswer)?\s*:\s*)/i, "").trim();
      }
    }
    else if (currentSection?.type === "faqs" && currentFaq && trimmed) {
      currentFaq.answer = [currentFaq.answer, trimmed].filter(Boolean).join("\n");
    }
    else if (currentSection?.type === "locations" && /^\s*[-*+]\s+/.test(line)) {
      const areaLine = line.replace(/^\s*[-*+]\s+/, "").trim();
      currentSection.data.areas.push(...areaLine.split("|").map((area) => area.trim()).filter(Boolean));
    }
    else if (trimmed.startsWith("|") && trimmed.endsWith("|") && /^\|?\s*:?-{3,}/.test(trimmed)) {
      // Markdown table separator row; the header row was parsed immediately before it.
      continue;
    }
    else if (trimmed.startsWith("|") && trimmed.endsWith("|") && !currentSection?.type.match(/^(faqs|locations)$/)) {
      const cells = trimmed.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
      if (currentSection?.type !== "table") {
        saveCurrent();
        currentSection = { type: "table", data: { headers: cells, rows: [] } };
      } else {
        currentSection.data.rows.push(cells);
      }
    }
    else if (currentSection?.type !== "faqs" && currentSection?.type !== "locations" && /^\s*(?:(?:[-*+]\s+)?(?:\d+[.)]\s+|Step\s+\d+\s*[:.)]\s+)|[-*+]\s+)/i.test(line)) {
      const ordered = /^\s*(?:[-*+]\s+)?(?:\d+[.)]\s+|Step\s+\d+\s*[:.)]\s+)/i.test(line);
      if (currentSection?.type !== "list" || currentSection.data.ordered !== ordered) {
        saveCurrent();
        currentSection = { type: "list", data: { ordered, items: [] } };
      }
      currentSection.data.items.push(line.replace(/^\s*(?:[-*+]\s+)?(?:\d+[.)]\s+|Step\s+\d+\s*[:.)]\s+)|^\s*[-*+]\s+/i, "").trim());
    }
    else {
      // Default text block
      if (currentSection && currentSection.type !== "text" && currentSection.type !== "faqs" && currentSection.type !== "locations") {
        saveCurrent();
        currentSection = null;
      }
      if (!currentSection) {
        currentSection = { type: "text", data: { content: "" } };
      }
      currentTextBlock.push(line);
    }
  }
  
  saveCurrent();
  return sections;
}
