import type { Metadata } from "next";
import { getMenu } from "@/lib/cms";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_SITE_NAME ?? "Site",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const menu = await getMenu("header").catch(() => ({ items: [] }));

  return (
    <html lang="en">
      <body>
        <header style={{ padding: "1rem", borderBottom: "1px solid #eee" }}>
          <nav style={{ display: "flex", gap: "1rem" }}>
            <strong>{process.env.NEXT_PUBLIC_SITE_NAME}</strong>
            {menu.items?.map((item: any) => (
              <Link key={item.id} href={item.url ?? "/"}>
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main style={{ maxWidth: 960, margin: "2rem auto", padding: "0 1rem" }}>
          {children}
        </main>
        <footer style={{ textAlign: "center", padding: "2rem", color: "#888" }}>
          © {new Date().getFullYear()} {process.env.NEXT_PUBLIC_SITE_NAME}
        </footer>
      </body>
    </html>
  );
}