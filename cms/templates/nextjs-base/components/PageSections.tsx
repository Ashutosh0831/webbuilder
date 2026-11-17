import BookingFormBlock from "@/components/BookingFormBlock";

function normalizeSections(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderInlineMarkdown(text: string) {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/(?!\/)[^\s)]*)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    if (match[3] !== undefined) parts.push(<strong key={match.index}>{match[3]}</strong>);
    else if (match[4] !== undefined) parts.push(<em key={match.index}>{match[4]}</em>);
    else {
      const href = match[2];
      const external = /^https?:\/\//i.test(href);
      parts.push(<a key={match.index} href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>{match[1]}</a>);
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function renderBlock(section: any, key: string) {
  if (section.type === "hero") return <header className="cms-hero" key={key}><h1>{renderInlineMarkdown(section.data.h1)}</h1><p>{renderInlineMarkdown(section.data.subheadline)}</p></header>;
  if (section.type === "cta") return <div className="cms-cta" key={key}><div className="cms-cta-buttons">{(section.data.actions ?? [{ label: section.data.label, href: section.data.href }]).map((action: { label: string; href: string }, index: number) => <a href={action.href} key={index}>{action.label}</a>)}</div></div>;
  if (section.type === "booking") return <BookingFormBlock key={key} title={section.data.title} subtitle={section.data.subtitle} />;
  if (section.type === "faqs") return <div className="cms-faq-list" key={key}>{section.data.items.map((item: any, index: number) => <details key={index} className="cms-faq-item"><summary>{renderInlineMarkdown(item.question)}</summary><p>{renderInlineMarkdown(item.answer)}</p></details>)}</div>;
  if (section.type === "locations") return <ul className="cms-location-grid" key={key}>{section.data.areas.map((area: string, index: number) => <li key={index}>{renderInlineMarkdown(area)}</li>)}</ul>;
  if (section.type === "heading") {
    const HeadingTag = `h${Math.min(Math.max(section.data.level, 3), 6)}` as "h3" | "h4" | "h5" | "h6";
    return <HeadingTag className="cms-subheading" key={key}>{renderInlineMarkdown(section.data.text)}</HeadingTag>;
  }
  if (section.type === "list") {
    const testimonials = section.data.items.length > 0 && section.data.items.every((item: string) => /^(?:\*\*)?Review\s+\d+:/i.test(item));
    if (testimonials) return <div className="cms-testimonial-grid" key={key}>{section.data.items.map((item: string, index: number) => <blockquote className="cms-testimonial" key={index}>{renderInlineMarkdown(item.replace(/^(?:\*\*)?Review\s+\d+:(?:\*\*)?\s*/, ""))}</blockquote>)}</div>;
    const ListTag = section.data.ordered ? "ol" : "ul";
    return <ListTag className={`cms-list ${section.data.ordered ? "cms-list-ordered" : ""}`} key={key}>{section.data.items.map((item: string, index: number) => <li key={index}>{renderInlineMarkdown(item)}</li>)}</ListTag>;
  }
  if (section.type === "table") return <div className="cms-table-wrap" key={key}><table className="cms-table"><thead><tr>{section.data.headers.map((cell: string, index: number) => <th key={index}>{renderInlineMarkdown(cell)}</th>)}</tr></thead><tbody>{section.data.rows.map((row: string[], rowIndex: number) => <tr key={rowIndex}>{section.data.headers.map((_: string, cellIndex: number) => <td key={cellIndex}>{renderInlineMarkdown(row[cellIndex] ?? "")}</td>)}</tr>)}</tbody></table></div>;
  if (section.type === "image") return <figure className="cms-image" key={key}><img src={section.data.src} alt={section.data.alt} />{section.data.caption && <figcaption>{renderInlineMarkdown(section.data.caption)}</figcaption>}</figure>;
  if (section.type === "text") return <div className="cms-copy" key={key}>{renderInlineMarkdown(section.data.content)}</div>;
  return null;
}

export default function PageSections({ sections }: { sections: unknown }) {
  const parsedSections = normalizeSections(sections);
  const blocks: Array<any> = [];
  let activeSection: any = null;

  for (const section of parsedSections) {
    if (section.type === "heading" && section.data?.level === 2) {
      activeSection = { type: "content-section", heading: section, children: [] };
      blocks.push(activeSection);
    } else if (activeSection) {
      activeSection.children.push(section);
    } else {
      blocks.push(section);
    }
  }

  return (
    <div className="cms-page">
      {blocks.map((block, index) => block.type === "content-section" ? (
        <section className="cms-content-section" key={`section-${index}`}>
          <h2>{renderInlineMarkdown(block.heading.data.text)}</h2>
          <div className="cms-content-grid">{block.children.map((child: any, childIndex: number) => renderBlock(child, `${index}-${childIndex}`))}</div>
        </section>
      ) : renderBlock(block, `block-${index}`))}
    </div>
  );
}

