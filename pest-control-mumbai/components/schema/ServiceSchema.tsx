import { business } from "@/lib/business";

type Props = {
  serviceName: string;
  serviceDescription: string;
  serviceUrl: string;
  faqs?: { q: string; a: string }[];
};

export default function ServiceSchema({ serviceName, serviceDescription, serviceUrl, faqs }: Props) {
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: serviceName,
    description: serviceDescription,
    url: serviceUrl,
    provider: {
      "@type": "PestControlService",
      "@id": `${business.url}/#business`,
      name: business.name,
      telephone: business.phone,
    },
    areaServed: business.areaServed.map((city) => ({
      "@type": "City",
      name: city,
    })),
  };

  const faqSchema = faqs && faqs.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: f.a,
          },
        })),
      }
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
    </>
  );
}