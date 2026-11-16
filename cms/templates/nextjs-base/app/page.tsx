import Link from "next/link";
import { getEntries } from "@/lib/cms";

export const revalidate = 60;

export default async function HomePage() {
  const services = await getEntries("service");

  return (
    <div>
      <h1>{process.env.NEXT_PUBLIC_SITE_NAME}</h1>
      <p>Professional pest control services in your area.</p>

      <h2 style={{ marginTop: "2rem" }}>Our Services</h2>
      <div className="grid">
        {services.map((s) => (
          <div key={s.id} className="card">
            <h3>{String(s.data.title ?? s.slug)}</h3>
            <p>{String(s.data.description ?? "").slice(0, 140)}</p>
            {s.data.price ? <p className="price">{String(s.data.price)}</p> : null}
            <Link href={`/services/${s.slug}`}>Learn more →</Link>
          </div>
        ))}
      </div>
    </div>
  );
}