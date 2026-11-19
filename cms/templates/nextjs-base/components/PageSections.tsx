import BookingFormBlock from "@/components/BookingFormBlock";
import { getInternalRouteIndex } from "@/lib/cms";

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

function safeContentHref(value: string, routes: Set<string>) {
  if (/^https?:\/\//i.test(value)) return value;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  try {
    const url = new URL(value, "https://internal.invalid");
    const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/$/, "") : "/";
    return routes.has(pathname) ? `${pathname}${url.search}${url.hash}` : null;
  } catch { return null; }
}

function renderInlineMarkdown(text: string, routes: Set<string>) {
  const pattern =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/(?!\/)[^\s)]*)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    if (match[3] !== undefined) parts.push(<strong key={match.index}>{match[3]}</strong>);
    else if (match[4] !== undefined) parts.push(<em key={match.index}>{match[4]}</em>);
    else {
      const href = safeContentHref(match[2], routes);
      if (!href) {
        parts.push(<span key={match.index} title="This internal destination is not published">{match[1]}</span>);
        cursor = match.index + match[0].length;
        continue;
      }
      const external = /^https?:\/\//i.test(href);
      parts.push(
        <a
          key={match.index}
          href={href}
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
        >
          {match[1]}
        </a>
      );
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function renderBlock(section: any, key: string, internalRoutes: Set<string>) {
  const renderText = (value: string) => renderInlineMarkdown(value, internalRoutes);
  if (section.type === "hero") {
    return (
      <header className="cms-hero" key={key}>
        <h1>{renderText(section.data.h1)}</h1>
        {section.data.subheadline && <p>{renderText(section.data.subheadline)}</p>}
      </header>
    );
  }
  if (section.type === "introduction") {
    return (
      <section className="cms-content-section" key={key}>
        {section.data.title && <h2>{renderText(section.data.title)}</h2>}
        <div className="cms-copy">
          <p>{renderText(section.data.content)}</p>
        </div>
      </section>
    );
  }
  if (section.type === "services") {
    return (
      <section className="cms-content-section" key={key}>
        {section.data.title && <h2>{renderText(section.data.title)}</h2>}
        <ul className="cms-list">
          {(section.data.items ?? []).map((item: any, idx: number) => (
            <li key={idx}>
              <strong>{renderText(item.name)}</strong>
              {item.description ? ` — ${item.description}` : ""}
            </li>
          ))}
        </ul>
      </section>
    );
  }
  if (section.type === "features") {
    return (
      <section className="cms-content-section" key={key}>
        {section.data.title && <h2>{renderText(section.data.title)}</h2>}
        <ul className="cms-list">
          {(section.data.items ?? []).map((item: any, idx: number) => (
            <li key={idx}>
              <strong>{renderText(item.title)}</strong>
              {item.description ? ` — ${item.description}` : ""}
            </li>
          ))}
        </ul>
      </section>
    );
  }
  if (section.type === "testimonials") {
    return (
      <section className="cms-content-section" key={key}>
        {section.data.title && <h2>{renderText(section.data.title)}</h2>}
        <div className="cms-testimonial-grid">
          {(section.data.items ?? []).map((item: any, idx: number) => (
            <blockquote className="cms-testimonial" key={idx}>
              <p>{renderText(item.quote)}</p>
              {item.author && <cite>— {item.author}</cite>}
            </blockquote>
          ))}
        </div>
      </section>
    );
  }
  if (section.type === "custom") {
    return (
      <section className="cms-content-section" key={key}>
        {section.data.title && <h2>{renderText(section.data.title)}</h2>}
        <div className="cms-copy">
          <p>{renderText(section.data.content)}</p>
        </div>
      </section>
    );
  }
  if (section.type === "cta") {
    return (
      <div className="cms-cta" key={key}>
        <div className="cms-cta-buttons">
          {(section.data.actions ?? [{ label: section.data.label, href: section.data.href }]).map(
            (action: { label: string; href: string }, index: number) =>
              safeContentHref(action.href, internalRoutes)
                ? <a href={safeContentHref(action.href, internalRoutes)!} key={index}>{action.label}</a>
                : <span key={index} title="This internal destination is not published">{action.label}</span>
          )}
        </div>
      </div>
    );
  }
  if (section.type === "booking") {
    return <BookingFormBlock key={key} title={section.data.title} subtitle={section.data.subtitle} />;
  }
  if (section.type === "faqs") {
    return (
      <section className="cms-content-section" key={key}>
        {section.data.title && <h2>{renderText(section.data.title)}</h2>}
        <div className="cms-faq-list">
          {section.data.items.map((item: any, index: number) => (
            <details key={index} className="cms-faq-item">
              <summary>{renderText(item.question)}</summary>
              <p>{renderText(item.answer)}</p>
            </details>
          ))}
        </div>
      </section>
    );
  }
  if (section.type === "locations") {
    return (
      <section className="cms-content-section" key={key}>
        {section.data.title && <h2>{renderText(section.data.title)}</h2>}
        <ul className="cms-location-grid">
          {section.data.areas.map((area: string, index: number) => (
            <li key={index}>{renderText(area)}</li>
          ))}
        </ul>
      </section>
    );
  }
  if (section.type === "heading") {
    const HeadingTag = `h${Math.min(Math.max(section.data.level, 3), 6)}` as
      | "h3"
      | "h4"
      | "h5"
      | "h6";
    return (
      <HeadingTag className="cms-subheading" key={key}>
        {renderText(section.data.text)}
      </HeadingTag>
    );
  }
  if (section.type === "list") {
    const testimonials =
      section.data.items.length > 0 &&
      section.data.items.every((item: string) => /^(?:\*\*)?Review\s+\d+:/i.test(item));
    if (testimonials) {
      return (
        <div className="cms-testimonial-grid" key={key}>
          {section.data.items.map((item: string, index: number) => (
            <blockquote className="cms-testimonial" key={index}>
              {renderText(item.replace(/^(?:\*\*)?Review\s+\d+:(?:\*\*)?\s*/, ""))}
            </blockquote>
          ))}
        </div>
      );
    }
    const ListTag = section.data.ordered ? "ol" : "ul";
    if (Array.isArray(section.data.nested) && section.data.nested.length > 0) {
      return (
        <ListTag className={`cms-list ${section.data.ordered ? "cms-list-ordered" : ""}`} key={key}>
          {section.data.nested.map((item: { text: string; children?: string[] }, index: number) => (
            <li key={index}>
              {renderText(item.text)}
              {item.children && item.children.length > 0 && (
                <ul>
                  {item.children.map((c, cIdx) => (
                    <li key={cIdx}>{renderText(c)}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ListTag>
      );
    }
    return (
      <ListTag className={`cms-list ${section.data.ordered ? "cms-list-ordered" : ""}`} key={key}>
        {section.data.items.map((item: string, index: number) => (
          <li key={index}>{renderText(item)}</li>
        ))}
      </ListTag>
    );
  }
  if (section.type === "table") {
    return (
      <div className="cms-table-wrap" key={key}>
        <table className="cms-table">
          <thead>
            <tr>
              {section.data.headers.map((cell: string, index: number) => (
                <th key={index}>{renderText(cell)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.data.rows.map((row: string[], rowIndex: number) => (
              <tr key={rowIndex}>
                {section.data.headers.map((_: string, cellIndex: number) => (
                  <td key={cellIndex}>{renderText(row[cellIndex] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (section.type === "image") {
    return (
      <figure className="cms-image" key={key}>
        <img src={section.data.src} alt={section.data.alt} />
        {section.data.caption && <figcaption>{renderText(section.data.caption)}</figcaption>}
      </figure>
    );
  }
  if (section.type === "text") {
    const paragraphs = String(section.data.content ?? "")
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    return (
      <div className="cms-copy" key={key}>
        {paragraphs.map((paragraph, index) => (
          <p key={index}>
            {paragraph.split("\n").map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 && <br />}
                {renderText(line)}
              </span>
            ))}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export default async function PageSections({ sections }: { sections: unknown }) {
  const { routes: internalRoutes } = await getInternalRouteIndex();
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
      {blocks.map((block, index) =>
        block.type === "content-section" ? (
          <section className="cms-content-section" key={`section-${index}`}>
            <h2>{renderInlineMarkdown(block.heading.data.text, internalRoutes)}</h2>
            <div className="cms-content-grid">
              {block.children.map((child: any, childIndex: number) =>
                renderBlock(child, `${index}-${childIndex}`, internalRoutes)
              )}
            </div>
          </section>
        ) : (
          renderBlock(block, `block-${index}`, internalRoutes)
        )
      )}
    </div>
  );
}
