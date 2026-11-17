import assert from "node:assert/strict";
import test from "node:test";
import { extractPageSeo, findUnresolvedPlaceholders, parsePageDocument } from "./parser.js";

test("parses labeled and plain FAQ questions with their answers", () => {
  const sections = parsePageDocument([
    "Frequently Asked Questions",
    "Is it suitable?",
    "A: Yes, it is.",
    "Q2: Is setup hard?",
    "A: No.",
  ].join("\n"));
  const faqs = sections.find((section) => section.type === "faqs");
  assert.deepEqual(faqs?.data.items, [
    { question: "Is it suitable?", answer: "Yes, it is." },
    { question: "Is setup hard?", answer: "No." },
  ]);
});

test("preserves text after a hero and parses Markdown headings", () => {
  const sections = parsePageDocument([
    "# Best sofa bed",
    "Intro paragraph.",
    "## Benefits",
  ].join("\n"));
  assert.equal(sections[0]?.type, "hero");
  assert.equal(sections[0]?.data.h1, "Best sofa bed");
  assert.equal(sections[1]?.type, "text");
  assert.equal(sections[1]?.data.content, "Intro paragraph.");
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
  assert.equal(hero?.data.h1, "Professional Lizard Control");
});

test("parses bullet and numbered lists", () => {
  const sections = parsePageDocument("- Saves space\n- Hosts guests\n1. Measure room\n2. Pick size");
  assert.deepEqual(sections.filter((section) => section.type === "list").map((section) => section.data), [
    { ordered: false, items: ["Saves space", "Hosts guests"] },
    { ordered: true, items: ["Measure room", "Pick size"] },
  ]);
});

test("parses Markdown tables and safe images", () => {
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
  assert.equal(parsePageDocument("![bad](javascript:alert(1))")[0]?.type, "text");
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

test("splits compact brief headings and inline bullets into page sections", () => {
  const compact = "### PAGE DETAILS & REMAINING PLACEHOLDERS * **Service Name:** Lizard Control ### REQUIRED PAGE STRUCTURE & SECTIONS #### 2. Hero Section (Above the Fold) * H1 Tag: <h1>Professional Lizard Control</h1> * Sub-headline: Safe service for homes #### 4. Service Overview & Description * H2 Headline: `Why choose this service?` * Detailed Description: A helpful description. * Key Benefits (Bullet Points): * Stain-free treatment * Family-safe process";
  const sections = parsePageDocument(compact);
  const hero = sections.find((section) => section.type === "hero");
  assert.equal(hero?.data.h1, "Professional Lizard Control");
  assert.equal(hero?.data.subheadline, "Safe service for homes");
  assert.equal(sections.some((section) => section.type === "heading" && section.data.text === "Why choose this service?"), true);
  assert.equal(sections.some((section) => section.type === "list" && section.data.items.length === 2), true);
  assert.equal(sections.some((section) => JSON.stringify(section).includes("PAGE DETAILS")), false);
  assert.equal(sections.some((section) => JSON.stringify(section).includes("Above the Fold")), false);
});

test("maps the primary CTA brief label to the booking route", () => {
  const cta = parsePageDocument("* Primary CTA Button: `Book Free Inspection` / `Call now`").find((section) => section.type === "cta");
  assert.deepEqual(cta?.data.actions, [{ label: "Book Free Inspection", href: "/contact" }]);
});

test("adds a telephone CTA when the brief has a real phone number", () => {
  const cta = parsePageDocument("* Primary CTA Button: Book Free Inspection / Call +91 98765 43210").find((section) => section.type === "cta");
  assert.deepEqual(cta?.data.actions, [
    { label: "Book Free Inspection", href: "/contact" },
    { label: "Call +91 98765 43210", href: "tel:+919876543210" },
  ]);
});

test("maps the quick booking section to the live form component", () => {
  const [section] = parsePageDocument("#### 3. Quick Booking Form Section");
  assert.deepEqual(section, { type: "booking", data: { title: "Quick Booking Form Section" } });
});

test("uses the booking headline and hides the brief field checklist", () => {
  const sections = parsePageDocument([
    "#### 3. Quick Booking Form Section",
    "* Form Headline: `Book your service today`",
    "* Form Subtext: `Request a callback.`",
    "* Form Fields to Display:",
    "* Full Name `[Text Input]`",
    "#### 4. Service Overview",
  ].join("\n"));
  assert.deepEqual(sections[0], { type: "booking", data: { title: "Book your service today", subtitle: "Request a callback." } });
  assert.equal(sections.some((section) => JSON.stringify(section).includes("Full Name")), false);
});

test("converts compact location rows into separate location cards", () => {
  const [locations] = parsePageDocument("- Location Grid/List:\n- [Area 1] | [Area 2] | [Area 3]\n- [Area 4] | [Area 5]");
  assert.deepEqual(locations, {
    type: "locations",
    data: { title: "Areas We Serve", areas: ["[Area 1]", "[Area 2]", "[Area 3]", "[Area 4]", "[Area 5]"] },
  });
});

test("treats labeled Step bullets as ordered process steps", () => {
  const sections = parsePageDocument("* Step 1: Inspect entry points * Step 2: Apply the treatment");
  const steps = sections.find((section) => section.type === "list");
  assert.deepEqual(steps?.data, { ordered: true, items: ["Inspect entry points", "Apply the treatment"] });
});

test("finds unresolved business and form placeholders without duplicate warnings", () => {
  assert.deepEqual(findUnresolvedPlaceholders("Call [Phone Number], contact [Company Name], call [Phone Number]"), [
    "[Phone Number]",
    "[Company Name]",
  ]);
});

test("excludes image and logo production instructions from rendered sections", () => {
  const sections = parsePageDocument([
    "# Lizard control",
    "* Hero Image Prompt/Alt-Text: [IMAGE PLACEHOLDER 1: photo description]",
    "* Client Logos Strip: [CLIENT LOGOS PLACEHOLDER: local logos]",
    "Welcome to our service.",
  ].join("\n"));
  assert.equal(sections.some((section) => JSON.stringify(section).includes("IMAGE PLACEHOLDER")), false);
  assert.equal(sections.some((section) => JSON.stringify(section).includes("LOGOS PLACEHOLDER")), false);
  assert.equal(sections.some((section) => JSON.stringify(section).includes("Welcome to our service.")), true);
});

test("parses labeled descriptions as copy instead of benefit list items", () => {
  const sections = parsePageDocument("* Detailed Description: A detailed service overview.\n* Location Description: Serving nearby neighborhoods.");
  assert.deepEqual(sections, [
    { type: "text", data: { content: "A detailed service overview.\nServing nearby neighborhoods." } },
  ]);
});
