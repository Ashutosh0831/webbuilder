// apps/api/src/lib/parser.ts

export interface ParsedSection {
  type: "hero" | "description" | "faqs" | "locations" | "text";
  data: any;
}

export function parsePageDocument(rawText: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  
  // A very simplified parser that looks for your headers
  // In a real app, this would be much more robust with regex
  
  const lines = rawText.split('\n');
  let currentSection: ParsedSection | null = null;
  let currentTextBlock: string[] = [];

  const saveCurrent = () => {
    if (!currentSection) return;
    if (currentSection.type === "text") {
      currentSection.data.content = currentTextBlock.join('\n').trim();
    }
    if (currentSection.data.content || currentSection.data.items || currentSection.data.areas) {
      sections.push(currentSection);
    }
    currentTextBlock = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    
    // 1. Detect Hero (H1)
    if (trimmed.startsWith('H1 Tag:')) {
      saveCurrent();
      currentSection = { type: "hero", data: { h1: trimmed.replace('H1 Tag:', '').trim(), subheadline: "" } };
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
      currentSection.data.subheadline = trimmed.replace('Sub-headline:', '').trim();
    } 
    else if (currentSection?.type === "faqs" && trimmed.startsWith('Q')) {
      // e.g. Q1: Do I need to empty my kitchen?
      const q = trimmed.split(':')[1]?.trim() || trimmed;
      currentSection.data.items.push({ question: q, answer: "..." }); // You'd parse the A: line next
    }
    else if (currentSection?.type === "locations" && trimmed.startsWith('*')) {
      currentSection.data.areas.push(trimmed.replace('*', '').trim());
    }
    else {
      // Default text block
      if (!currentSection) {
        currentSection = { type: "text", data: { content: "" } };
      }
      currentTextBlock.push(line);
    }
  }
  
  saveCurrent();
  return sections;
}