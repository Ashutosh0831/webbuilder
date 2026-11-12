import { requireAuth, requireWebsitePermission } from "@/server/authz";
import { prisma } from "@/server/db/prisma";

export async function submitPublishRequest(
  pageId: string,
  websiteId: string,
  changeNote: string | undefined
) {
  const user = await requireAuth();
  await requireWebsitePermission(user.id, websiteId, { resource: "publish", action: "submit" }, user.role ?? "editor");

  // Verify the page exists and belongs to the website
  const page = await prisma.page.findFirst({
    where: { id: pageId, websiteId, deletedAt: null, status: { notIn: ["ARCHIVED"] } },
  });
  if (!page) throw new Error("Page not found");

  // Prevent duplicate pending requests for the same page
  const existing = await prisma.publicationRequest.findFirst({
    where: { pageId, status: "PENDING" },
  });
  if (existing) throw new Error("A pending request already exists for this page");

  // Create the Publication container and the request atomically
  return prisma.$transaction(async (tx) => {
    const latestVersion = await tx.pageVersion.findFirst({
      where: { pageId, isPublished: false },
      orderBy: { version: "desc" },
    });

    if (!latestVersion) throw new Error("No draft version to submit");

    const latestPublication = await tx.publication.findFirst({
      where: { websiteId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const publication = await tx.publication.create({
      data: { websiteId, version: (latestPublication?.version ?? 0) + 1, status: "PENDING" },
    });

    return tx.publicationRequest.create({
      data: {
        publicationId: publication.id,
        pageId,
        pageVersionId: latestVersion.id,
        requestedById: user.id,
        status: "PENDING",
        comment: changeNote,
      },
    });
  });
}

export async function publishDirectly(pageId: string, websiteId: string) {
  const user = await requireAuth();
  await requireWebsitePermission(user.id, websiteId, { resource: "publish", action: "approve" }, user.role ?? "editor");

  const page = await prisma.page.findFirst({
    where: { id: pageId, websiteId, deletedAt: null, status: { notIn: ["ARCHIVED"] } },
  });
  if (!page) throw new Error("Page not found");

  return prisma.$transaction(async (tx) => {
    const publishedAt = new Date();
    const draftVersion = await tx.pageVersion.findFirst({
      where: { pageId, isPublished: false },
      orderBy: { version: "desc" },
    });
    if (!draftVersion) throw new Error("No draft to publish");

    const latestPublication = await tx.publication.findFirst({
      where: { websiteId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const publication = await tx.publication.create({
      data: {
        websiteId,
        version: (latestPublication?.version ?? 0) + 1,
        status: "PUBLISHED",
        publishedAt,
      },
    });

    await tx.page.update({
      where: { id: pageId },
      data: { publishedVersionId: draftVersion.id, status: "PUBLISHED", publishedAt },
    });
    await tx.pageVersion.update({
      where: { id: draftVersion.id },
      data: { isPublished: true, publishedAt, publicationId: publication.id },
    });

    return publication;
  });
}

export async function reviewPublishRequest(
  requestId: string,
  decision: "approve" | "reject",
  comment?: string
) {
  const user = await requireAuth();
  const request = await prisma.publicationRequest.findUnique({
    where: { id: requestId },
    include: { page: { select: { websiteId: true } }, publication: true },
  });
  if (!request) throw new Error("Request not found");
  if (request.status !== "PENDING") throw new Error("Request already reviewed");

  // Enforce: requester cannot approve their own request (segregation of duties)
  if (request.requestedById === user.id && user.role !== "super_admin") {
    throw new Error("You cannot approve your own publishing request");
  }

  await requireWebsitePermission(user.id, request.page.websiteId, { resource: "publish", action: "approve" }, user.role ?? "editor");

  if (decision === "reject") {
    return prisma.publicationRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        reviewedById: user.id,
        comment: comment ?? request.comment,
        reviewedAt: new Date(),
      },
    });
  }

  // APPROVE → publish atomically
  return prisma.$transaction(async (tx) => {
    // Re-check status inside transaction (prevents double-approval race)
    const current = await tx.publicationRequest.findUnique({ where: { id: requestId } });
    if (current?.status !== "PENDING") throw new Error("Request already processed");

    // Find the draft version being published
    const draftVersion = await tx.pageVersion.findFirst({
      where: {
        pageId: request.pageId,
        isPublished: false,
        ...(request.pageVersionId ? { id: request.pageVersionId } : {}),
      },
      orderBy: { version: "desc" },
    });
    if (!draftVersion) throw new Error("Draft version no longer exists");

    // Flip the pointer: Page now references this version as published
    const publishedAt = new Date();
    await tx.page.update({
      where: { id: request.pageId },
      data: {
        publishedVersionId: draftVersion.id,
        status: "PUBLISHED",
        publishedAt,
      },
    });

    // Mark the version as published (immutable — no further updates)
    await tx.pageVersion.update({
      where: { id: draftVersion.id },
      data: { isPublished: true, publishedAt, publicationId: request.publicationId },
    });

    // Update the publication and request
    await tx.publication.update({
      where: { id: request.publicationId },
      data: { status: "PUBLISHED", publishedAt },
    });

    const approved = await tx.publicationRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        approvedById: user.id,
        reviewedById: user.id,
        reviewedAt: new Date(),
        comment: comment ?? request.comment,
      },
    });

    return approved;
  });
}