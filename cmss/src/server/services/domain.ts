import { promises as dns } from "dns";
import { requireAuth, requireWebsitePermission } from "@/server/authz";
import { prisma } from "@/server/db/prisma";
import { revalidateTag } from "next/cache";

const PLATFORM_CNAME = process.env.PLATFORM_CNAME_TARGET!; // e.g., "cname.yourplatform.com"
const TXT_PREFIX = "_cms-verify";

export async function addDomain(websiteId: string, domain: string) {
  const user = await requireAuth();
  await requireWebsitePermission(user.id, websiteId, { resource: "domain", action: "manage" }, user.role ?? "editor");

  return prisma.websiteDomain.create({
    data: { websiteId, domain, status: "PENDING_DNS" },
  });
}

export async function removeDomain(domainId: string, websiteId: string) {
  const user = await requireAuth();
  await requireWebsitePermission(user.id, websiteId, { resource: "domain", action: "manage" }, user.role ?? "editor");

  const domain = await prisma.websiteDomain.findFirst({
    where: { id: domainId, websiteId },
    select: { id: true, status: true },
  });
  if (!domain) throw new Error("Domain not found");
  if (domain.status === "SUSPENDED") return domain;

  const updated = await prisma.websiteDomain.updateMany({
    where: { id: domainId, websiteId, status: domain.status },
    data: { status: "SUSPENDED" },
  });
  if (updated.count !== 1) {
    throw new Error("Domain status changed while it was being removed. Refresh and try again.");
  }

  revalidateTag(`website-${websiteId}`, "max");
  return { ...domain, status: "SUSPENDED" as const };
}

/**
 * Verify domain ownership via TXT record, and routing via CNAME.
 * Called server-side only. Never trusts client claims.
 */
export async function verifyDomain(domainId: string, websiteId: string) {
  const user = await requireAuth();
  await requireWebsitePermission(user.id, websiteId, { resource: "domain", action: "manage" }, user.role ?? "editor");

  const record = await prisma.websiteDomain.findFirst({
    where: { id: domainId, websiteId },
  });
  if (!record) throw new Error("Domain not found");

  // 1. Verify ownership: TXT record must match the stored token
  const txtName = `${TXT_PREFIX}.${record.domain}`;
  let txtVerified = false;
  try {
    const txtRecords = await dns.resolveTxt(txtName);
    const flat = txtRecords.map((r) => r.join(""));
    txtVerified = flat.some((v) => v === record.id); // token = domain row ID
  } catch {
    txtVerified = false;
  }

  if (!txtVerified) {
    await prisma.websiteDomain.update({
      where: { id: domainId },
      data: { status: "FAILED" },
    });
    return { verified: false, reason: "TXT record not found or does not match" };
  }

  // 2. Verify routing: CNAME must point to platform target
  let cnameVerified = false;
  try {
    const cnames = await dns.resolveCname(record.domain);
    cnameVerified = cnames.some((c) => c.toLowerCase() === PLATFORM_CNAME.toLowerCase());
  } catch {
    // Root domains may use A/ALIAS; treat as unverified until A record is confirmed
    cnameVerified = false;
  }

  if (!cnameVerified) {
    await prisma.websiteDomain.update({
      where: { id: domainId },
      data: { status: "PENDING_DNS" },
    });
    return { verified: false, reason: "CNAME record not pointing to platform" };
  }

  // 3. Both checks passed — mark as verified (TLS provisioning is a separate step)
  const updated = await prisma.websiteDomain.update({
    where: { id: domainId },
    data: { status: "VERIFIED", verifiedAt: new Date() },
  });

  revalidateTag(`website-${websiteId}`, "max");
  return { verified: true, domain: updated };
}