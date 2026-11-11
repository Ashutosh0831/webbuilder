import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const RESERVED_PREFIXES = ["/_sites", "/api", "/_next", "/admin", "/dashboard"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip internal paths
  if (RESERVED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Skip files with extensions (favicon, images, etc.)
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return NextResponse.next();
  }

  const hostname = request.nextUrl.hostname.toLowerCase();
  if (!hostname) {
    return new NextResponse("Missing host header", { status: 400 });
  }

  // Keep the local CMS landing page reachable; localhost is not a tenant domain.
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
    return NextResponse.next();
  }

  // Rewrite all public paths into the domain-scoped route
  const url = request.nextUrl.clone();
  url.pathname = `/_sites/${hostname}${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};