const PAYLOAD_URL = process.env.PAYLOAD_URL || "http://localhost:3001";

export async function fetchServices() {
  const res = await fetch(`${PAYLOAD_URL}/api/services?limit=100`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.docs as any[];
}

export async function fetchServiceBySlug(slug: string) {
  const res = await fetch(
    `${PAYLOAD_URL}/api/services?where[slug][equals]=${slug}&limit=1`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.docs[0] || null;
}

export async function fetchLocations() {
  const res = await fetch(`${PAYLOAD_URL}/api/locations?limit=100`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.docs as any[];
}

export async function fetchLocationBySlug(slug: string) {
  const res = await fetch(
    `${PAYLOAD_URL}/api/locations?where[slug][equals]=${slug}&limit=1`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.docs[0] || null;
}