import Link from "next/link";
import InspectionForm from "@/components/InspectionForm";
import { fetchServices } from "@/lib/payload";

const PHONE = "+919453394533";
const PHONE_DISPLAY = "94533 94533";

export default async function HomePage() {
  const services = await fetchServices();

  return (
    <main className="bg-white">
      {/* ───────────── HERO ───────────── */}
      <section className="bg-gradient-to-b from-green-50 to-white">
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="inline-block bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full mb-4">
              Same-day service across Mumbai, Thane &amp; Navi Mumbai
            </p>
            <h1 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight mb-4">
              Pest control in Mumbai, done so it does not come back
            </h1>
            <p className="text-gray-600 text-lg mb-6">
              Most Mumbai flats don&apos;t have a pest problem of their own — they have a building problem
              arriving through a shared kitchen duct, plumbing shaft or refuse chute. We treat the
              harbourage, not the walkway.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={`tel:${PHONE}`}
                className="bg-gray-900 hover:bg-black text-white font-semibold px-6 py-3 rounded-md text-center"
              >
                📞 Call {PHONE_DISPLAY}
              </a>
              <Link
                href="#inspection"
                className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-md text-center"
              >
                Get a free inspection
              </Link>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Police-verified technicians · Eco-friendly chemicals · Free initial inspection
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h2 className="font-bold text-lg text-gray-900 mb-3">Why homes call us back</h2>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-2"><span className="text-green-600">✔</span> Odourless gel baiting for kitchens — no need to vacate the flat</li>
              <li className="flex gap-2"><span className="text-green-600">✔</span> Upfront pricing quoted before work starts</li>
              <li className="flex gap-2"><span className="text-green-600">✔</span> Free follow-up within the warranty period</li>
              <li className="flex gap-2"><span className="text-green-600">✔</span> Whole-society contracts — common areas, shafts and drains treated as one job</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ───────────── TRUST BAR ───────────── */}
      <section className="border-y border-gray-200 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
          <div><p className="font-bold text-gray-900">Police Verified</p><p className="text-gray-500">Every technician</p></div>
          <div><p className="font-bold text-gray-900">ISO Certified</p><p className="text-gray-500">Process standards</p></div>
          <div><p className="font-bold text-gray-900">Free Inspection</p><p className="text-gray-500">No charge to quote</p></div>
          <div><p className="font-bold text-gray-900">Service Warranty</p><p className="text-gray-500">Free follow-up</p></div>
        </div>
      </section>

      {/* ───────────── SERVICES GRID ───────────── */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Our pest control services</h2>
          <p className="text-gray-600 mt-2">Targeted treatment for the pests Mumbai actually has.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((s: any) => (
            <Link
              key={s.slug}
              href={`/services/${s.slug}`}
              className="block border border-gray-200 rounded-lg p-5 hover:border-green-500 hover:shadow-md transition"
            >
              <div className="text-3xl mb-2">{s.icon || "🐛"}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{s.name}</h3>
              <p className="text-sm text-gray-600">
                {(s.metaDescription || "").slice(0, 120)}
                {(s.metaDescription || "").length > 120 ? "..." : ""}
              </p>
              <p className="text-green-700 text-sm font-semibold mt-3">Learn more →</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ───────────── WHY US ───────────── */}
      <section className="bg-green-50">
        <div className="max-w-7xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              What &quot;done so it does not come back&quot; actually means
            </h2>
            <p className="text-gray-700 mb-4">
              A supermarket spray clears the counter for a fortnight and the kitchen is busy again by
              the third week: the insects you saw were a fraction of a colony living inside the cavity.
              That is why we do it differently.
            </p>
            <ul className="space-y-2 text-gray-700 text-sm">
              <li>• Gel bait inside the cabinet carcass instead of a spray across it</li>
              <li>• Injection into pinholed timber instead of polish over it</li>
              <li>• Larviciding the tank and planter before anyone fogs for adult mosquitoes</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="font-bold text-gray-900 mb-3">How a visit works</h3>
            <ol className="space-y-3 text-sm text-gray-700 list-decimal list-inside">
              <li><strong>Inspection</strong> — technician checks harbourages, not the open floor.</li>
              <li><strong>A plan you approve first</strong> — what was found, what it needs, how many rounds, whether you vacate.</li>
              <li><strong>Targeted treatment</strong> — gel, bait, injection, larviciding or spray as the pest requires.</li>
              <li><strong>Follow-up and proofing</strong> — scheduled second round where needed; entry points sealed.</li>
            </ol>
          </div>
        </div>
      </section>

      {/* ───────────── INSPECTION FORM ───────────── */}
      <section id="inspection" className="max-w-3xl mx-auto px-4 py-16 scroll-mt-20">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Get a free inspection &amp; quote</h2>
          <p className="text-gray-600 mt-2">Tell us the pest and your area — we call back with a slot and an upfront price.</p>
        </div>
        <InspectionForm services={services.map((s: any) => ({ slug: s.slug, name: s.name }))} />
      </section>
    </main>
  );
}