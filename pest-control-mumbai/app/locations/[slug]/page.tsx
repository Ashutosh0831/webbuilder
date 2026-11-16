import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchLocationBySlug, fetchLocations, fetchServices } from "@/lib/payload";

const PHONE = "+919453394533";
const PHONE_DISPLAY = "94533 94533";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const locations = await fetchLocations();
  return locations.map((l: any) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const loc = await fetchLocationBySlug(slug);
  if (!loc) return {};
  return {
    title: loc.metaTitle || loc.name,
    description: loc.metaDescription || "",
    alternates: { canonical: `/locations/${loc.slug}` },
  };
}

export default async function LocationPage({ params }: Props) {
  const { slug } = await params;
  const loc = await fetchLocationBySlug(slug);
  if (!loc) notFound();

  const allServices = await fetchServices();

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: (loc.faqs || []).map((f: any) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main className="bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <section className="bg-gradient-to-b from-green-50 to-white">
        <div className="max-w-5xl mx-auto px-4 py-14">
          <p className="text-sm text-green-800 font-semibold mb-2">
            <Link href="/" className="hover:underline">Home</Link> › Locations › {loc.name}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{loc.headline}</h1>
          <p className="text-gray-700 text-lg mb-3 max-w-3xl">{loc.intro}</p>
          <p className="text-sm text-green-800 font-semibold mb-6">✓ {loc.responseTime}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a href={`tel:${PHONE}`} className="bg-gray-900 hover:bg-black text-white font-semibold px-6 py-3 rounded-md text-center">
              📞 Call {PHONE_DISPLAY}
            </a>
            <Link href="/#inspection" className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-md text-center">
              Book a free inspection
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Pest issues specific to {loc.name}</h2>
        <ul className="space-y-3 text-gray-700">
          {(loc.localContext || []).map((c: any) => (
            <li key={c.id || c.text} className="flex gap-2"><span className="text-green-600">•</span>{c.text}</li>
          ))}
        </ul>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-12 grid md:grid-cols-2 gap-10">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">What we treat in {loc.name}</h2>
          <div className="grid grid-cols-2 gap-2">
            {allServices.map((s: any) => (
              <Link
                key={s.slug}
                href={`/services/${s.slug}`}
                className="border border-gray-200 hover:border-green-600 hover:text-green-700 rounded-md px-3 py-2 text-sm"
              >
                {s.icon} {s.shortName || s.name}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Areas we cover in {loc.name}</h2>
          <div className="flex flex-wrap gap-2">
            {(loc.neighbourhoods || []).map((n: any) => (
              <span key={n.id || n.text} className="bg-gray-100 text-gray-800 text-sm rounded-full px-3 py-1">
                {n.text}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Pest control in {loc.name} — common questions</h2>
          <div className="space-y-3">
            {(loc.faqs || []).map((f: any) => (
              <details key={f.id || f.q} className="border border-gray-200 rounded-lg p-4 bg-white">
                <summary className="font-semibold text-gray-900 cursor-pointer">{f.q}</summary>
                <p className="text-gray-700 text-sm mt-2">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-green-600 text-white">
        <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-lg font-semibold">Book a free inspection in {loc.name} — we call back with a slot and an upfront price.</p>
          <a href={`tel:${PHONE}`} className="bg-white text-green-700 font-bold px-6 py-3 rounded-md whitespace-nowrap">
            📞 {PHONE_DISPLAY}
          </a>
        </div>
      </section>
    </main>
  );
}