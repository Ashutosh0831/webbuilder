export type Service = {
  slug: string;
  name: string;
  shortName: string;
  icon: string;
  headline: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  harbourages: string[];
  treatmentSteps: { title: string; description: string }[];
  safetyNote: string;
  faqs: { q: string; a: string }[];
};

// Deprecated: content now lives in Payload CMS and is fetched via @/lib/payload
export const services: Service[] = [];

export function getService(_slug: string): Service | undefined {
  return undefined;
}

export function getAllServiceSlugs(): string[] {
  return [];
}