"use client";

import { useState, useTransition } from "react";
import { submitLead } from "@/app/actions/submit-lead";

type ServiceOption = { slug: string; name: string };

const PHONE = "+919453394533";
const PHONE_DISPLAY = "94533 94533";

export default function InspectionForm({ services }: { services: ServiceOption[] }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await submitLead(formData);
      if (res.success) {
        setResult({ ok: true, message: "Thanks — we'll call you back with a slot and a price." });
      } else {
        setResult({ ok: false, message: res.error });
      }
    });
  }

  if (result?.ok) {
    return (
      <div className="bg-green-50 border border-green-300 rounded-xl p-8 text-center">
        <p className="text-2xl mb-2">✅</p>
        <p className="font-semibold text-green-900 text-lg mb-1">Request received</p>
        <p className="text-green-800 text-sm mb-4">{result.message}</p>
        <a href={`tel:${PHONE}`} className="text-green-700 font-semibold underline">
          Or call us now: {PHONE_DISPLAY}
        </a>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="grid sm:grid-cols-2 gap-4 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <input name="name" className="border rounded-md px-3 py-2" placeholder="Your name" required />
      <input name="phone" type="tel" className="border rounded-md px-3 py-2" placeholder="Phone number" required />
      <input name="postalCode" className="border rounded-md px-3 py-2" placeholder="Postal code / area" required />
      <select name="pestProblem" className="border rounded-md px-3 py-2" required defaultValue="">
        <option value="" disabled>Pest problem</option>
        {services.map((s) => (
          <option key={s.slug} value={s.slug}>{s.name}</option>
        ))}
        <option value="other">Other / not sure</option>
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold px-6 py-3 rounded-md sm:col-span-2"
      >
        {isPending ? "Sending..." : "Request free inspection"}
      </button>
      {result && !result.ok && (
        <p className="text-red-600 text-sm sm:col-span-2">{result.message}</p>
      )}
      <p className="text-xs text-gray-500 sm:col-span-2">
        Or call us directly:{" "}
        <a href={`tel:${PHONE}`} className="font-semibold text-green-700">{PHONE_DISPLAY}</a>
      </p>
    </form>
  );
}