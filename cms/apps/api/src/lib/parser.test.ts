import assert from "node:assert/strict";
import test from "node:test";
import {
  extractPageSeo,
  findUnresolvedPlaceholders,
  parsePageDocument,
  parsePageDocumentDetailed,
} from "./parser.js";

test("parses labeled and plain FAQ questions with their answers", () => {
  const sections = parsePageDocument([
    "Frequently Asked Questions",
    "Is it suitable?",
    "A: Yes, it is.",
    "Q2: Is setup hard?",
    "A: No.",
  ].join("\n"));
  const faqs = sections.find((section) => section.type === "faqs");
  assert.equal(faqs?.type, "faqs");
  if (faqs?.type === "faqs") {
    assert.deepEqual(faqs.data.items, [
      { question: "Is it suitable?", answer: "Yes, it is." },
      { question: "Is setup hard?", answer: "No." },
    ]);
  }
});

test("supports multiple FAQ groups and alternative FAQ formats", () => {
  const result = parsePageDocumentDetailed([
    "# Service Page",
    "## Billing FAQs",
    "Question: Do you accept cards?",
    "Answer: Yes, all major cards.",
    "## Safety FAQs",
    "**Q:** Is it pet safe?",
    "**A:** Yes, once dry.",
  ].join("\n"));

  const faqGroups = result.sections.filter((s) => s.type === "faqs");
  assert.equal(faqGroups.length, 2);
  assert.equal(result.schemaVersion, "1.0");
});

test("preserves text after a hero and parses Markdown headings", () => {
  const sections = parsePageDocument([
    "# Best sofa bed",
    "Intro paragraph.",
    "## Benefits",
  ].join("\n"));
  assert.equal(sections[0]?.type, "hero");
  if (sections[0]?.type === "hero") assert.equal(sections[0].data.h1, "Best sofa bed");
  assert.equal(sections[1]?.type, "text");
  if (sections[1]?.type === "text") assert.equal(sections[1].data.content, "Intro paragraph.");
  assert.deepEqual(sections[2], { type: "heading", data: { level: 2, text: "Benefits" } });
});

test("uses only the first Markdown H1 as the page hero", () => {
  const sections = parsePageDocument("# Main title\nIntro text.\n# Another section\nSection copy.");
  assert.equal(sections.filter((section) => section.type === "hero").length, 1);
  assert.deepEqual(sections[0], { type: "hero", data: { h1: "Main title", subheadline: "" } });
  assert.deepEqual(sections[2], { type: "heading", data: { level: 2, text: "Another section" } });
});

test("removes literal HTML heading tags from the hero title", () => {
  const [hero] = parsePageDocument("H1 Tag: <h1>Professional Lizard Control</h1>");
  assert.equal(hero?.type, "hero");
  if (hero?.type === "hero") assert.equal(hero.data.h1, "Professional Lizard Control");
});

test("parses bullet, numbered, and nested lists", () => {
  const sections = parsePageDocument("- Saves space\n  - Folds flat\n- Hosts guests\n1. Measure room\n2. Pick size");
  const lists = sections.filter((section) => section.type === "list");
  assert.equal(lists.length, 2);
  if (lists[0]?.type === "list") {
    assert.equal(lists[0].data.ordered, false);
    assert.deepEqual(lists[0].data.nested, [
      { text: "Saves space", children: ["Folds flat"] },
      { text: "Hosts guests" },
    ]);
  }
  if (lists[1]?.type === "list") {
    assert.equal(lists[1].data.ordered, true);
    assert.deepEqual(lists[1].data.items, ["Measure room", "Pick size"]);
  }
});

test("parses introduction, services, features, testimonials, and custom sections", () => {
  const result = parsePageDocumentDetailed([
    "# Cockroach Control",
    "## Introduction",
    "We provide professional cockroach control.",
    "## Our Services",
    "- Residential Control - Full home barrier",
    "- Commercial Control",
    "## Key Features",
    "- Eco-Friendly - Safe for families",
    "## Testimonials",
    "- \"Fast and thorough!\" -- Jane Doe",
    "## Custom: Warranty Note",
    "30-day service guarantee.",
  ].join("\n"));

  const types = result.sections.map((s) => s.type);
  assert.deepEqual(types, ["hero", "introduction", "services", "features", "testimonials", "custom"]);
  assert.equal(result.unknownSections.length, 1);
});

test("parses Markdown tables and safe images, warns on unsafe images", () => {
  const tableAndImage = parsePageDocument([
    "| Feature | Price |",
    "| --- | --- |",
    "| Sofa bed | 120 |",
    "![Blue sofa](/media/sofa.jpg)",
  ].join("\n"));
  assert.deepEqual(tableAndImage[0], {
    type: "table",
    data: { headers: ["Feature", "Price"], rows: [["Sofa bed", "120"]] },
  });
  assert.deepEqual(tableAndImage[1], {
    type: "image",
    data: { alt: "Blue sofa", src: "/media/sofa.jpg", caption: "" },
  });

  const badImg = parsePageDocumentDetailed("![bad](javascript:alert(1))");
  assert.ok(badImg.warnings.some((w) => w.code === "UNSAFE_IMAGE_URL"));
});

test("extracts SEO metadata without including it in content", () => {
  const rawText = "SEO Title: A better title\nSEO Description: A useful summary\nSEO Canonical: https://example.test/page";
  assert.deepEqual(extractPageSeo(rawText), {
    title: "A better title",
    description: "A useful summary",
    canonical: "https://example.test/page",
  });
  assert.deepEqual(parsePageDocument(rawText), []);
});

test("finds unresolved bracketed and site placeholders without duplicates", () => {
  assert.deepEqual(
    findUnresolvedPlaceholders("Call [PHONE_NUMBER] at [COMPANY_NAME] or [Phone Number] and [COMPANY_NAME]"),
    ["[PHONE_NUMBER]", "[COMPANY_NAME]", "[Phone Number]"]
  );
});

test("reports malformed input diagnostics", () => {
  const empty = parsePageDocumentDetailed("   ");
  assert.ok(empty.errors.some((e) => e.code === "EMPTY_DOCUMENT"));

  const missingAnswer = parsePageDocumentDetailed("## FAQs\nQ: Unanswered question?");
  assert.ok(missingAnswer.warnings.some((w) => w.code === "FAQ_MISSING_ANSWER"));
});
