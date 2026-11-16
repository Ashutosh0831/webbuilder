import { business } from "@/lib/business";

export default function LocalBusinessSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "PestControlService",
    "@id": `${business.url}/#business`,
    name: business.name,
    url: business.url,
    telephone: business.phone,
    description: business.description,
    priceRange: business.priceRange,
    openingHours: business.openingHours,
    areaServed: business.areaServed.map((city) => ({
      "@type": "City",
      name: city,
    })),
    ...(business.sameAs.length > 0 && { sameAs: business.sameAs }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}