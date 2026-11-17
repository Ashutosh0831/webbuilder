import type { Metadata } from "next";
import Link from "next/link";
import { getAllPages } from "@/lib/cms";
import "./globals.css";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_SITE_NAME ?? "Site",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pages = (await getAllPages().catch(() => [])) || [];
  
  const grouped = pages.reduce((acc: any, page: any) => {
    if (!acc[page.section_key]) acc[page.section_key] = [];
    acc[page.section_key].push(page);
    return acc;
  }, {});

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "sans-serif" }}>
        <header style={{ padding: "1rem", borderBottom: "1px solid #eee" }}>
          <nav style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <strong>{process.env.NEXT_PUBLIC_SITE_NAME}</strong>
            
            <Link href="/">Home</Link>

            {Object.entries(grouped).map(([section, sectionPages]: any) => (
              <div key={section} className="nav-dropdown" style={{ position: "relative" }}>
                <span style={{ cursor: "pointer", fontWeight: "bold", paddingBottom: "10px" }}>
                  {section.toUpperCase()} +
                </span>
                
                <div className="dropdown-content" style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  background: "white",
                  border: "1px solid #ccc",
                  padding: "10px",
                  display: "none",
                  flexDirection: "column",
                  minWidth: "200px",
                  zIndex: 10
                }}>
                  {sectionPages.map((p: any) => (
                    <Link 
                      key={p.id} 
                      href={`/${p.section_key}/${p.slug}`}
                      style={{ padding: "5px 0", color: "black", textDecoration: "none" }}
                    >
                      {p.title}
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            <Link href="/contact">Contact</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}