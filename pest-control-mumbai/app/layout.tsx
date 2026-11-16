import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import NavbarServer from "@/components/NavbarServer";
import LocalBusinessSchema from "@/components/schema/LocalBusinessSchema";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Pest Control in Mumbai, Thane & Navi Mumbai | YourPestCo",
  description:
    "Same-day pest control for cockroaches, termites, bed bugs, mosquitoes and rodents across Mumbai. Police-verified technicians, eco-friendly treatment, free inspection.",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.className} antialiased`}>
        <LocalBusinessSchema />
        <NavbarServer />
        {children}
      </body>
    </html>
  );
}