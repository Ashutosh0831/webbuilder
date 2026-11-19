import {
  PARSER_SCHEMA_VERSION,
  parseDocumentResultSchema,
  type PageSeoMetadata,
  type ParseDiagnostic,
  type ParseDocumentResult,
  type ParsedSection,
} from "@cms/shared";

export type { ParsedSection, PageSeoMetadata, ParseDiagnostic, ParseDocumentResult };

const PLACEHOLDER_RE =
  /\[(?:COMPANY_NAME|PHONE_NUMBER|EMAIL|BUSINESS_ADDRESS|WEBSITE_URL|SERVICE_AREA|TAGLINE|Insert\b|Company Name|Primary City(?:\/Region)?|Sub-Location(?:\s+\d+)?|Phone Number|Years of Experience|Key Certifications\/Licenses|Service Warranty|Starting Price|Client Name(?:\s+\d+)?|IMAGE PLACEHOLDER(?:\s+\d+)?|CLIENT LOGOS PLACEHOLDER|Text Input|Number Input|Dropdown|Date Picker|Area\s+\d+)[^\]]*\]/gi;

export function findUnresolvedPlaceholders(rawText: string): string[] {
  const normalized = normalizeUnicode(rawText);
  return [...new Set(normalized.match(PLACEHOLDER_RE) ?? [])];
}

function normalizeUnicode(rawText: string): string {
  return rawText
    .normalize("NFC")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function normalizeDocumentLines(rawText: string): string[] {
  return normalizeUnicode(rawText)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+(?=#{1,6}\s)/g, "\n")
    .split("\n")
    .map((line) =>
      line.replace(
        /^\s*[*+-]\s+(?=(?:H1 Tag|Sub-headline|H2 Headline|Primary CTA Button|Detailed Description|Location Description|Form Headline|Form Subtext|Submit Button Text|Key Benefits(?:\s*\([^)]*\))?|Form Fields to Display|Customer Testimonials(?:\s*\([^)]*\))?|Location Grid\/?List|(?:(?:SEO|Meta)\s+)?(?:Title|Description|Canonical))\s*:)/i,
        ""
      )
    );
}

export function extractPageSeo(rawText: string): PageSeoMetadata {
  const seo: PageSeoMetadata = {};
  for (const line of normalizeDocumentLines(rawText)) {
    const match =
      /^\s*(?:(?:SEO|Meta)\s+)?(Title|Description|Canonical)\s*:\s*(.+?)\s*$/i.exec(
        line
      );
    if (!match) continue;
    const value = stripHtmlTags(match[2]);
    if (match[1].toLowerCase() === "title") seo.title = value;
    if (match[1].toLowerCase() === "description") seo.description = value;
    if (match[1].toLowerCase() === "canonical") seo.canonical = value;
  }
  return seo;
}

function stripHtmlTags(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .trim();
}

export function parsePageDocumentDetailed(rawText: string): ParseDocumentResult {
  const sections: ParsedSection[] = [];
  const warnings: ParseDiagnostic[] = [];
  const errors: ParseDiagnostic[] = [];
  const unknownSections: string[] = [];

  if (!rawText || !rawText.trim()) {
    errors.push({ code: "EMPTY_DOCUMENT", message: "Document content is empty" });
    return parseDocumentResultSchema.parse({
      schemaVersion: PARSER_SCHEMA_VERSION,
      sections: [],
      seo: {},
      warnings,
      errors,
      unresolvedPlaceholders: [],
      unknownSections,
    });
  }

  const lines = normalizeDocumentLines(rawText);
  let currentSection: any = null;
  let currentTextBlock: string[] = [];
  let currentFaq: { question: string; answer: string } | null = null;
  let skippingPageDetails = false;
  let skippingBookingDetails = false;
  let hasHero = false;
  let faqGroupCount = 0;

  const saveFaq = (lineNum?: number) => {
    if (currentFaq && currentSection?.type === "faqs") {
      if (!currentFaq.answer.trim()) {
        warnings.push({
          code: "FAQ_MISSING_ANSWER",
          message: `FAQ question "${currentFaq.question}" has no answer`,
          line: lineNum,
        });
      }
      currentSection.data.items.push(currentFaq);
      currentFaq = null;
    }
  };

  const saveCurrent = (lineNum?: number) => {
    if (!currentSection) return;
    saveFaq(lineNum);
    if (currentSection.type === "text" || currentSection.type === "introduction") {
      currentSection.data.content = currentTextBlock.join("\n").trim();
    }
    if (currentSection.type === "custom") {
      currentSection.data.content = currentTextBlock.join("\n").trim();
    }
    const d = currentSection.data;
    const hasPayload =
      d.content ||
      d.h1 ||
      d.title ||
      d.text ||
      d.src ||
      d.label ||
      d.headers ||
      (Array.isArray(d.items) && d.items.length > 0) ||
      (Array.isArray(d.areas) && d.areas.length > 0);
    if (hasPayload) {
      sections.push(currentSection as ParsedSection);
    }
    currentTextBlock = [];
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const lineNum = idx + 1;
    const trimmed = line.trim();

    if (/(?:Image Prompt\/Alt-Text|Client Logos Strip):/i.test(trimmed)) continue;
    if (/^(?:(?:SEO|Meta)\s+)?(?:Title|Description|Canonical)\s*:/i.test(trimmed)) continue;

    // Unsafe HTML detection warning
    if (/<script\b|on\w+\s*=/i.test(trimmed)) {
      warnings.push({
        code: "UNSAFE_HTML_STRIPPED",
        message: "Potentially unsafe HTML/script content was stripped",
        line: lineNum,
      });
    }

    // Markdown image
    const markdownImage = /^!\[([^\]]*)\]\((.+)\)$/.exec(trimmed);
    if (markdownImage) {
      if (/^(?:https?:\/\/|\/)/i.test(markdownImage[2])) {
        saveCurrent(lineNum);
        currentSection = {
          type: "image",
          data: {
            alt: stripHtmlTags(markdownImage[1]),
            src: markdownImage[2],
            caption: "",
          },
        };
        continue;
      } else {
        warnings.push({
          code: "UNSAFE_IMAGE_URL",
          message: `Blocked image with unsafe or unsupported URL scheme: ${markdownImage[2]}`,
          line: lineNum,
        });
      }
    }

    const markdownHeading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(trimmed);

    if (skippingPageDetails) {
      if (markdownHeading && /REQUIRED PAGE STRUCTURE/i.test(markdownHeading[2])) {
        skippingPageDetails = false;
      }
      continue;
    }

    if (skippingBookingDetails) {
      if (markdownHeading) {
        skippingBookingDetails = false;
      } else {
        const formHeadline = /^Form Headline:\s*(.+)$/i.exec(trimmed);
        const formSubtext = /^Form Subtext:\s*(.+)$/i.exec(trimmed);
        if (currentSection?.type === "booking" && formHeadline) {
          currentSection.data.title = stripHtmlTags(formHeadline[1].replace(/[`*_]/g, "").trim());
        }
        if (currentSection?.type === "booking" && formSubtext) {
          currentSection.data.subtitle = stripHtmlTags(formSubtext[1].replace(/[`*_]/g, "").trim());
        }
        continue;
      }
    }

    if (markdownHeading && /PAGE DETAILS & REMAINING PLACEHOLDERS/i.test(markdownHeading[2])) {
      saveCurrent(lineNum);
      currentSection = null;
      skippingPageDetails = true;
      continue;
    }
    if (markdownHeading && /REQUIRED PAGE STRUCTURE/i.test(markdownHeading[2])) continue;
    if (
      markdownHeading &&
      /^\d+\.\s*(?:SEO Metadata|Hero Section|Service Overview|Our Step-by-Step|Trusted Clients)/i.test(
        markdownHeading[2]
      )
    ) {
      continue;
    }
    if (markdownHeading && /quick booking form/i.test(markdownHeading[2])) {
      saveCurrent(lineNum);
      currentSection = {
        type: "booking",
        data: { title: stripHtmlTags(markdownHeading[2].replace(/^\d+\.\s*/, "")) },
      };
      skippingBookingDetails = true;
      continue;
    }

    // 1. Hero / H1
    if (trimmed.startsWith("H1 Tag:") || (markdownHeading?.[1].length === 1 && !hasHero)) {
      saveCurrent(lineNum);
      const headingText = stripHtmlTags(
        markdownHeading?.[2] ?? trimmed.replace("H1 Tag:", "").trim()
      );
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
      saveCurrent(lineNum);
      currentSection = {
        type: "heading",
        data: { level: 2, text: stripHtmlTags(explicitHeading[1].replace(/^`|`$/g, "")) },
      };
      continue;
    }

    // Primary CTA
    const primaryCta = /^Primary CTA Button:\s*(.+)$/i.exec(trimmed);
    if (primaryCta) {
      saveCurrent(lineNum);
      const [bookingLabel, ...otherActions] = primaryCta[1]
        .split("/")
        .map((action) => stripHtmlTags(action.replace(/[`*_]/g, "").trim()));
      const actions = [{ label: bookingLabel || "Book now", href: "/contact" }];
      const callAction = otherActions.find((action) => /^Call\b/i.test(action));
      const phone = callAction?.replace(/^Call\s*/i, "").replace(/[^+\d]/g, "") ?? "";
      const digits = phone.replace(/\D/g, "").length;
      if (digits >= 7 && digits <= 15) {
        actions.push({ label: callAction!, href: `tel:${phone}` });
      }
      currentSection = {
        type: "cta",
        data: { label: actions[0].label, href: actions[0].href, actions },
      };
      continue;
    }

    const labelHeading =
      /^(?:Key Benefits(?:\s*\([^)]*\))?|Form Fields to Display|Our Step-by-Step .* Process|Customer Testimonials.*|Location Grid\/?List):?$/i.exec(
        trimmed
      );
    if (labelHeading) {
      saveCurrent(lineNum);
      if (/^Location Grid\/?List:?$/i.test(trimmed)) {
        currentSection = { type: "locations", data: { title: "Areas We Serve", areas: [] } };
      } else if (/^Customer Testimonials/i.test(trimmed)) {
        currentSection = { type: "testimonials", data: { title: "Customer Testimonials", items: [] } };
      } else {
        currentSection = {
          type: "heading",
          data: { level: 3, text: stripHtmlTags(trimmed.replace(/:$/, "")) },
        };
      }
      continue;
    }

    const labeledCopy = /^(?:Detailed Description|Location Description|Form Subtext):\s*(.*)$/i.exec(
      trimmed
    );
    if (labeledCopy) {
      if (currentSection && currentSection.type !== "text") saveCurrent(lineNum);
      if (!currentSection || currentSection.type !== "text") {
        currentSection = { type: "text", data: { content: "" } };
      }
      currentTextBlock.push(stripHtmlTags(labeledCopy[1]));
      continue;
    }

    // Specialized section headings (FAQs, Locations, Services, Features, Introduction, Testimonials, Custom)
    const headingText = markdownHeading ? stripHtmlTags(markdownHeading[2]) : trimmed;

    if (
      /Frequently Asked Questions|\bFAQs?\b/i.test(headingText) &&
      (markdownHeading || trimmed.length < 80)
    ) {
      saveCurrent(lineNum);
      faqGroupCount += 1;
      currentSection = {
        type: "faqs",
        data: {
          title: headingText,
          groupId: `faq-group-${faqGroupCount}`,
          items: [],
        },
      };
      continue;
    }

    if (
      /Areas We Serve|Locations Covered|Service Areas/i.test(headingText) &&
      (markdownHeading || trimmed.length < 80)
    ) {
      saveCurrent(lineNum);
      currentSection = {
        type: "locations",
        data: { title: headingText, areas: [] },
      };
      continue;
    }

    if (markdownHeading && /^Introduction$/i.test(headingText)) {
      saveCurrent(lineNum);
      currentSection = {
        type: "introduction",
        data: { title: headingText, content: "" },
      };
      continue;
    }

    if (markdownHeading && /^(?:Our )?Services$/i.test(headingText)) {
      saveCurrent(lineNum);
      currentSection = {
        type: "services",
        data: { title: headingText, items: [] },
      };
      continue;
    }

    if (markdownHeading && /^(?:Key )?Features$/i.test(headingText)) {
      saveCurrent(lineNum);
      currentSection = {
        type: "features",
        data: { title: headingText, items: [] },
      };
      continue;
    }

    if (markdownHeading && /^(?:Customer )?(?:Testimonials|Reviews)$/i.test(headingText)) {
      saveCurrent(lineNum);
      currentSection = {
        type: "testimonials",
        data: { title: headingText, items: [] },
      };
      continue;
    }

    if (markdownHeading && /^Custom(?:\s+Section)?\s*:/i.test(headingText)) {
      saveCurrent(lineNum);
      unknownSections.push(headingText);
      warnings.push({
        code: "CUSTOM_SECTION",
        message: `Parsed custom section "${headingText}"`,
        line: lineNum,
      });
      currentSection = {
        type: "custom",
        data: { title: headingText, content: "" },
      };
      continue;
    }

    if (markdownHeading) {
      saveCurrent(lineNum);
      currentSection = {
        type: "heading",
        data: { level: Math.max(markdownHeading[1].length, 2), text: headingText },
      };
      continue;
    }

    // 4. Parse content inside active sections
    if (currentSection?.type === "hero" && trimmed.startsWith("Sub-headline:")) {
      currentSection.data.subheadline = stripHtmlTags(
        trimmed.replace("Sub-headline:", "").trim()
      );
      continue;
    }

    if (currentSection?.type === "faqs") {
      const qMatch = /^(?:\*\*)?Q(?:uestion)?\s*\d*\s*:\s*(?:\*\*)?\s*(.+)$/i.exec(trimmed);
      if (qMatch) {
        saveFaq(lineNum);
        currentFaq = { question: stripHtmlTags(qMatch[1]), answer: "" };
        continue;
      }
      if (trimmed.endsWith("?") && !trimmed.startsWith("A:") && !trimmed.startsWith("Answer:")) {
        saveFaq(lineNum);
        currentFaq = { question: stripHtmlTags(trimmed), answer: "" };
        continue;
      }
      const aMatch = /^(?:\*\*)?A(?:nswer)?\s*\d*\s*:\s*(?:\*\*)?\s*(.*)$/i.exec(trimmed);
      if (aMatch) {
        if (currentFaq) {
          currentFaq.answer = stripHtmlTags(aMatch[1]);
        } else {
          warnings.push({
            code: "ORPHAN_FAQ_ANSWER",
            message: "Found FAQ answer without a preceding question",
            line: lineNum,
          });
        }
        continue;
      }
      if (currentFaq && trimmed) {
        currentFaq.answer = [currentFaq.answer, stripHtmlTags(trimmed)]
          .filter(Boolean)
          .join("\n");
        continue;
      }
    }

    if (currentSection?.type === "locations" && /^\s*[-*+]\s+/.test(line)) {
      const areaLine = stripHtmlTags(line.replace(/^\s*[-*+]\s+/, "").trim());
      currentSection.data.areas.push(
        ...areaLine
          .split("|")
          .map((area) => area.trim())
          .filter(Boolean)
      );
      continue;
    }

    if (currentSection?.type === "services" && /^\s*[-*+]\s+/.test(line)) {
      const rawItem = stripHtmlTags(line.replace(/^\s*[-*+]\s+/, "").trim());
      const [name, ...rest] = rawItem.split(/\s+[-–:]\s+/);
      currentSection.data.items.push({
        name: name.trim(),
        ...(rest.length ? { description: rest.join(" - ").trim() } : {}),
      });
      continue;
    }

    if (currentSection?.type === "features" && /^\s*[-*+]\s+/.test(line)) {
      const rawItem = stripHtmlTags(line.replace(/^\s*[-*+]\s+/, "").trim());
      const [title, ...rest] = rawItem.split(/\s+[-–:]\s+/);
      currentSection.data.items.push({
        title: title.trim(),
        ...(rest.length ? { description: rest.join(" - ").trim() } : {}),
      });
      continue;
    }

    if (currentSection?.type === "testimonials" && /^\s*[-*+>|"]/.test(trimmed)) {
      const quote = stripHtmlTags(trimmed.replace(/^\s*[-*+>]\s+/, "").trim());
      const [qBody, author] = quote.split(/\s+[—–-]{1,2}\s+/);
      currentSection.data.items.push({
        quote: qBody.replace(/^"|"$/g, "").trim(),
        ...(author ? { author: author.trim() } : {}),
      });
      continue;
    }

    // Markdown tables
    if (trimmed.startsWith("|") && trimmed.endsWith("|") && /^\|?\s*:?-{3,}/.test(trimmed)) {
      continue;
    }
    if (
      trimmed.startsWith("|") &&
      trimmed.endsWith("|") &&
      !currentSection?.type.match(/^(faqs|locations)$/)
    ) {
      const cells = trimmed
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => stripHtmlTags(cell.trim()));
      if (currentSection?.type !== "table") {
        saveCurrent(lineNum);
        currentSection = { type: "table", data: { headers: cells, rows: [] } };
      } else {
        if (cells.length !== currentSection.data.headers.length) {
          warnings.push({
            code: "TABLE_COLUMN_MISMATCH",
            message: `Table row has ${cells.length} columns, expected ${currentSection.data.headers.length}`,
            line: lineNum,
          });
        }
        currentSection.data.rows.push(cells);
      }
      continue;
    }

    // Lists (ordered, unordered, and nested indented bullets)
    if (
      currentSection?.type !== "faqs" &&
      currentSection?.type !== "locations" &&
      /^\s*(?:(?:[-*+]\s+)?(?:\d+[.)]\s+|Step\s+\d+\s*[:.)]\s+)|[-*+]\s+)/i.test(line)
    ) {
      const indentMatch = /^(\s*)/.exec(line);
      const indentLen = indentMatch ? indentMatch[1].length : 0;
      const ordered = /^\s*(?:[-*+]\s+)?(?:\d+[.)]\s+|Step\s+\d+\s*[:.)]\s+)/i.test(line);
      const itemText = stripHtmlTags(
        line
          .replace(/^\s*(?:[-*+]\s+)?(?:\d+[.)]\s+|Step\s+\d+\s*[:.)]\s+)|^\s*[-*+]\s+/i, "")
          .trim()
      );

      if (indentLen >= 2 && currentSection?.type === "list") {
        const nestedArr = (currentSection.data.nested ??= currentSection.data.items.map(
          (t: string) => ({ text: t })
        ));
        const lastParent = nestedArr[nestedArr.length - 1];
        if (lastParent) {
          lastParent.children = [...(lastParent.children ?? []), itemText];
          continue;
        }
      }

      if (currentSection?.type !== "list" || currentSection.data.ordered !== ordered) {
        saveCurrent(lineNum);
        currentSection = { type: "list", data: { ordered, items: [] } };
      }
      currentSection.data.items.push(itemText);
      if (currentSection.data.nested) {
        currentSection.data.nested.push({ text: itemText });
      }
      continue;
    }

    // Default text / introduction / custom block
    if (
      currentSection &&
      currentSection.type !== "text" &&
      currentSection.type !== "introduction" &&
      currentSection.type !== "custom" &&
      currentSection.type !== "faqs" &&
      currentSection.type !== "locations"
    ) {
      saveCurrent(lineNum);
      currentSection = null;
    }
    if (!currentSection) {
      currentSection = { type: "text", data: { content: "" } };
    }
    if (
      currentSection.type === "text" ||
      currentSection.type === "introduction" ||
      currentSection.type === "custom"
    ) {
      currentTextBlock.push(stripHtmlTags(line));
    }
  }

  saveCurrent(lines.length);

  const seo = extractPageSeo(rawText);
  const unresolvedPlaceholders = findUnresolvedPlaceholders(rawText);

  if (sections.length === 0) {
    errors.push({
      code: "NO_RENDERABLE_SECTIONS",
      message: "No renderable content sections found in document",
    });
  }

  return parseDocumentResultSchema.parse({
    schemaVersion: PARSER_SCHEMA_VERSION,
    sections,
    seo,
    warnings,
    errors,
    unresolvedPlaceholders,
    unknownSections,
  });
}

export function parsePageDocument(rawText: string): ParsedSection[] {
  return parsePageDocumentDetailed(rawText).sections;
}
