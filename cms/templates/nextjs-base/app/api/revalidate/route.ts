import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import crypto from "node:crypto";
import { pagePathForSection } from "@/lib/cms";

function timingSafeMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  const provided = req.headers.get("x-revalidate-secret") ?? "";

  if (!secret || !timingSafeMatch(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    eventType?: string;
    sectionKey?: string;
    slug?: string;
    previousSectionKey?: string;
    previousSlug?: string;
    menuKey?: string;
    contentTypeKey?: string;
  } = {};

  try {
    body = await req.json();
  } catch {
    // Allow empty body for full site revalidation
  }

  revalidateTag("cms-site");
  revalidateTag("cms-pages");
  revalidateTag("cms-settings");
  revalidatePath("/");
  revalidatePath("/sitemap.xml");

  if (body.sectionKey && body.slug) {
    revalidateTag(`cms-page-${body.sectionKey}-${body.slug}`);
    revalidatePath(pagePathForSection(body.sectionKey, body.slug));
    const section = body.sectionKey.toLowerCase();
    if (["service", "services"].includes(section)) revalidatePath("/services");
    if (["location", "locations"].includes(section)) revalidatePath("/locations");
    if (["blog", "blogs", "resource", "resources"].includes(section)) revalidatePath("/blog");
  }

  if (body.previousSectionKey && body.previousSlug) {
    revalidatePath(pagePathForSection(body.previousSectionKey, body.previousSlug));
    const previousSection = body.previousSectionKey.toLowerCase();
    if (["service", "services"].includes(previousSection)) revalidatePath("/services");
    if (["location", "locations"].includes(previousSection)) revalidatePath("/locations");
    if (["blog", "blogs", "resource", "resources"].includes(previousSection)) revalidatePath("/blog");
  }

  if (body.menuKey) revalidateTag(`cms-menu-${body.menuKey}`);

  if (body.contentTypeKey && body.slug) {
    const contentType = body.contentTypeKey.toLowerCase();
    revalidateTag(`cms-content-${body.contentTypeKey}`);
    revalidateTag(`cms-content-${body.contentTypeKey}-${body.slug}`);
    revalidatePath(pagePathForSection(contentType, body.slug));
    if (["service", "services"].includes(contentType)) revalidatePath("/services");
    if (["location", "locations"].includes(contentType)) revalidatePath("/locations");
    if (["blog", "blogs", "resource", "resources"].includes(contentType)) revalidatePath("/blog");
    if (body.previousSlug && body.previousSlug !== body.slug) {
      revalidateTag(`cms-content-${body.contentTypeKey}-${body.previousSlug}`);
      revalidatePath(pagePathForSection(contentType, body.previousSlug));
      if (["service", "services"].includes(contentType)) revalidatePath("/services");
      if (["location", "locations"].includes(contentType)) revalidatePath("/locations");
      if (["blog", "blogs", "resource", "resources"].includes(contentType)) revalidatePath("/blog");
    }
  }

  return NextResponse.json({ revalidated: true, now: Date.now() });
}
