import { getEntries } from "@/lib/cms";

export const revalidate = 60;

export const metadata = { title: "FAQ" };

export default async function FaqPage() {
  const faqs = await getEntries("faq");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: String(f.data.question ?? ""),
      acceptedAnswer: {
        "@type": "Answer",
        text: String(f.data.answer ?? ""),
      },
    })),
  };

  return (
    <div>
      <h1>Frequently Asked Questions</h1>
      {faqs.map((f) => (
        <div key={f.id} className="card" style={{ marginBottom: 12 }}>
          <strong>{String(f.data.question ?? "")}</strong>
          <p>{String(f.data.answer ?? "")}</p>
        </div>
      ))}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}