import Navbar from "./Navbar";
import { fetchServices } from "@/lib/payload";

export default async function NavbarServer() {
  const services = await fetchServices();
  const serviceLinks = services.map((s: any) => ({
    name: s.name,
    href: `/services/${s.slug}`,
  }));
  return <Navbar services={serviceLinks} />;
}