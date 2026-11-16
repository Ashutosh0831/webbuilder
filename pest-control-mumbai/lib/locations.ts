export type Location = {
  slug: string;
  name: string;
  state: string;
  metaTitle: string;
  metaDescription: string;
  headline: string;
  intro: string;
  localContext: string[];
  neighbourhoods: string[];
  responseTime: string;
  faqs: { q: string; a: string }[];
};

export const locations: Location[] = [
  {
    slug: "thane",
    name: "Thane",
    state: "Maharashtra",
    metaTitle: "Pest Control in Thane | Same-Day Visit, Free Inspection",
    metaDescription:
      "Cockroach, termite, bed bug and mosquito control across Thane. Police-verified technicians, odourless gel baiting for flats, whole-society contracts. Free inspection, upfront price.",
    headline: "Pest control in Thane, done so it doesn't come back",
    intro:
      "Thane's mix of older buildings near the station and newer high-rises along Ghodbunder Road creates two different pest profiles. Older buildings share kitchen ducts and refuse chutes that spread cockroaches between flats. Newer towers have centralized plumbing shafts and podium-level gardens where mosquitoes and rodents establish easily. We treat both the way they need to be treated.",
    localContext: [
      "Older buildings around Thane station and Naupada have shared kitchen exhaust ducts — the most common route for cockroach re-infestation between flats.",
      "High-rises along Ghodbunder Road and Pokhran Road have deep podium parking and landscaped gardens where mosquito breeding sites build up during and after the monsoon.",
      "Ground-floor flats in low-lying pockets face termite pressure from damp soil against the wall–floor junction, especially after the monsoon.",
    ],
    neighbourhoods: [
      "Naupada",
      "Ghodbunder Road",
      "Pokhran Road",
      "Vartak Nagar",
      "Kolshet",
      "Majiwada",
      "Wagle Estate",
    ],
    responseTime: "Same-day and next-day slots across Thane",
    faqs: [
      {
        q: "Do you cover whole societies in Thane, not just single flats?",
        a: "Yes. Common areas, refuse rooms, shafts, podium parking, gardens and storm drains are treated as one job for society committees. Treating only one flat usually leaves the shared duct or shaft untreated, and the flat re-infests within weeks.",
      },
      {
        q: "How soon can you reach Thane?",
        a: "Same-day and next-day slots are usually available across Thane. Society-wide work is normally scheduled early morning. Call to confirm the nearest slot for your area.",
      },
      {
        q: "Is the treatment safe for families with children and pets?",
        a: "Tell us at booking about infants, pregnancy, elderly residents, asthma, allergies or pets. Those homes are planned around odourless baits or our herbal range instead of open spraying. Fish tanks and pet bowls are covered or moved before work begins.",
      },
      {
        q: "Do you charge for the inspection?",
        a: "The initial inspection is free. You get the findings and the recommended treatment before you decide whether to go ahead.",
      },
    ],
  },
  // Add Mumbai, Navi Mumbai, Pune later — one object each, with genuinely different content.
];

export function getLocation(slug: string) {
  return locations.find((l) => l.slug === slug);
}

export function getAllLocationSlugs() {
  return locations.map((l) => l.slug);
}