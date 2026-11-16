import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchServiceBySlug, fetchServices } from "@/lib/payload";
import ServiceSchema from "@/components/schema/ServiceSchema";
import { business } from "@/lib/business";

const PHONE = "+919453394533";
const PHONE_DISPLAY = "94533 94533";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const services = await fetchServices();
  return services.map((s: any) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = await fetchServiceBySlug(slug);
  if (!service) return {};
  return {
    title: service.metaTitle || service.name,
    description: service.metaDescription || "",
    alternates: { canonical: `/services/${service.slug}` },
  };
}

export default async function ServicePage({ params }: Props) {
  const { slug } = await params;
  const service = await fetchServiceBySlug(slug);
  if (!service) notFound();

  const allServices = await fetchServices();

  return (
    <main className="bg-white">
      <ServiceSchema
        serviceName={service.name}
        serviceDescription={service.metaDescription || ""}
        serviceUrl={`${business.url}/services/${service.slug}`}
        faqs={service.faqs || []}
      />

      <section className="bg-gradient-to-b from-green-50 to-white">
        <div className="max-w-5xl mx-auto px-4 py-14">
          <p className="text-sm text-green-800 font-semibold mb-2">
            <Link href="/" className="hover:underline">Home</Link> › Services › {service.name}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{service.headline}</h1>
          <p className="text-gray-700 text-lg mb-6 max-w-3xl">{service.intro}</p>
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

      <section className="max-w-5xl mx-auto px-4 py-12 grid md:grid-cols-2 gap-10">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Where they actually live in a Mumbai flat</h2>
          <ul className="space-y-2 text-gray-700">
            {(service.harbourages || []).map((h: any) => (
              <li key={h.id || h.text} className="flex gap-2"><span className="text-green-600">•</span>{h.text}</li>
            ))}
          </ul>
        </div>
        <div className="bg-green-50 rounded-xl p-6">
          <h3 className="font-bold text-gray-900 mb-3">Safety note</h3>
          <p className="text-sm text-gray-700">{service.safetyNote}</p>
        </div>
      </section>

      <section className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">How the treatment works</h2>
          <ol className="grid md:grid-cols-2 gap-6">
            {(service.treatmentSteps || []).map((step: any, i: number) => (
              <li key={step.id || step.title} className="bg-white rounded-lg p-5 border border-gray-200">
                <p className="text-green-700 font-bold text-sm mb-1">Step {i + 1}</p>
                <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
                <p className="text-sm text-gray-600">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently asked questions</h2>
        <div className="space-y-3">
          {(service.faqs || []).map((f: any) => (
            <details key={f.id || f.q} className="border border-gray-200 rounded-lg p-4">
              <summary className="font-semibold text-gray-900 cursor-pointer">{f.q}</summary>
              <p className="text-gray-700 text-sm mt-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-green-600 text-white">
        <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-lg font-semibold">Still unsure what you're dealing with? Call us — we'll tell you whether it needs a visit.</p>
          <a href={`tel:${PHONE}`} className="bg-white text-green-700 font-bold px-6 py-3 rounded-md whitespace-nowrap">
            📞 {PHONE_DISPLAY}
          </a>
        </div>
      </section>

      {allServices.filter((s: any) => s.slug !== service.slug).length > 0 && (
        <section className="max-w-5xl mx-auto px-4 py-12">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Other pest control services</h2>
          <div className="flex flex-wrap gap-2">
            {allServices.filter((s: any) => s.slug !== service.slug).map((s: any) => (
              <Link key={s.slug} href={`/services/${s.slug}`} className="border border-gray-300 hover:border-green-600 hover:text-green-700 rounded-full px-3 py-1 text-sm">
                {s.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}