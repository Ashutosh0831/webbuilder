"use client";

import Link from "next/link";
import { useState } from "react";

type ServiceLink = { name: string; href: string };

const locations = [
  { name: "Thane", href: "/locations/thane" },
];

const PHONE = "+919453394533";
const PHONE_DISPLAY = "94533 94533";

export default function Navbar({ services }: { services: ServiceLink[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-green-700">
            <span className="text-2xl">🐛</span>
            <span>YourPestCo</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-700">
            <Link href="/" className="hover:text-green-700">Home</Link>

            <div className="relative group">
              <button className="hover:text-green-700 py-2">Services ▾</button>
              <div className="absolute left-0 top-full hidden group-hover:block bg-white shadow-lg border rounded-md w-56 py-2">
                {services.length === 0 ? (
                  <span className="block px-4 py-2 text-gray-400">No services yet</span>
                ) : (
                  services.map((s) => (
                    <Link key={s.href} href={s.href} className="block px-4 py-2 hover:bg-green-50 hover:text-green-700">
                      {s.name}
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="relative group">
              <button className="hover:text-green-700 py-2">Locations ▾</button>
              <div className="absolute left-0 top-full hidden group-hover:block bg-white shadow-lg border rounded-md w-48 py-2">
                {locations.map((l) => (
                  <Link key={l.href} href={l.href} className="block px-4 py-2 hover:bg-green-50 hover:text-green-700">
                    {l.name}
                  </Link>
                ))}
              </div>
            </div>

            <Link href="/about" className="hover:text-green-700">About</Link>
            <Link href="/contact" className="hover:text-green-700">Contact</Link>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <a href={`tel:${PHONE}`} className="text-sm font-semibold text-gray-800">📞 {PHONE_DISPLAY}</a>
            <Link href="/#inspection" className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-md">
              Free Inspection
            </Link>
          </div>

          <button className="md:hidden text-2xl" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">☰</button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t bg-white px-4 py-4 space-y-3 text-sm">
            <Link href="/" className="block font-semibold" onClick={() => setMobileOpen(false)}>Home</Link>

            <details>
              <summary className="font-semibold py-1 cursor-pointer">Services</summary>
              <div className="pl-3 pt-1 space-y-1">
                {services.map((s) => (
                  <Link key={s.href} href={s.href} className="block py-1 text-gray-600" onClick={() => setMobileOpen(false)}>
                    {s.name}
                  </Link>
                ))}
              </div>
            </details>

            <details>
              <summary className="font-semibold py-1 cursor-pointer">Locations</summary>
              <div className="pl-3 pt-1 space-y-1">
                {locations.map((l) => (
                  <Link key={l.href} href={l.href} className="block py-1 text-gray-600" onClick={() => setMobileOpen(false)}>
                    {l.name}
                  </Link>
                ))}
              </div>
            </details>

            <Link href="/about" className="block font-semibold" onClick={() => setMobileOpen(false)}>About</Link>
            <Link href="/contact" className="block font-semibold" onClick={() => setMobileOpen(false)}>Contact</Link>
          </div>
        )}
      </header>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 grid grid-cols-2 shadow-lg">
        <a href={`tel:${PHONE}`} className="bg-gray-900 text-white text-center py-3 font-semibold">📞 Call Now</a>
        <Link href="/#inspection" className="bg-green-600 text-white text-center py-3 font-semibold">Free Inspection</Link>
      </div>
      <div className="md:hidden h-14" />
    </>
  );
}