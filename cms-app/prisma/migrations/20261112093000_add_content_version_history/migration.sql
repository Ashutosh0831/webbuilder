CREATE TYPE "ContentResourceType" AS ENUM ('WEBSITE', 'THEME');

ALTER TABLE "Website"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Theme"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "PageVersion"
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "snapshot" JSONB,
ADD COLUMN "publicationId" UUID;

ALTER TABLE "PublicationRequest"
ADD COLUMN "pageVersionId" UUID;

ALTER TABLE "PublicationRequest"
ADD COLUMN "approvedById" TEXT;

CREATE INDEX "PublicationRequest_pageVersionId_idx" ON "PublicationRequest"("pageVersionId");

CREATE TABLE "ContentVersion" (
    "id" UUID NOT NULL,
    "websiteId" UUID NOT NULL,
    "resourceType" "ContentResourceType" NOT NULL,
    "resourceId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "authorId" TEXT,
    "snapshot" JSONB NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentVersion_websiteId_resourceType_resourceId_version_key"
ON "ContentVersion"("websiteId", "resourceType", "resourceId", "version");

CREATE INDEX "ContentVersion_websiteId_resourceType_resourceId_version_idx"
ON "ContentVersion"("websiteId", "resourceType", "resourceId", "version");

CREATE INDEX "ContentVersion_authorId_idx" ON "ContentVersion"("authorId");

ALTER TABLE "ContentVersion"
ADD CONSTRAINT "ContentVersion_websiteId_fkey"
FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentVersion"
ADD CONSTRAINT "ContentVersion_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PageVersion"
ADD CONSTRAINT "PageVersion_publicationId_fkey"
FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PublicationRequest"
ADD CONSTRAINT "PublicationRequest_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PublicationRequest"
ADD CONSTRAINT "PublicationRequest_pageVersionId_fkey"
FOREIGN KEY ("pageVersionId") REFERENCES "PageVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "ContentVersion" (
    "id", "websiteId", "resourceType", "resourceId", "version", "snapshot", "changeNote"
)
SELECT
    gen_random_uuid(),
    w."id",
    'WEBSITE'::"ContentResourceType",
    w."id",
    w."version",
    jsonb_build_object(
        'name', w."name",
        'slug', w."slug",
        'description', w."description",
        'locale', w."locale",
        'timezone', w."timezone",
        'settings', jsonb_build_object(
            'robotsTxt', s."robotsTxt",
            'faviconUrl', s."faviconUrl",
            'defaultSeo', s."defaultSeo"
        )
    ),
    'Baseline snapshot (migration)'
FROM "Website" w
LEFT JOIN "WebsiteSettings" s ON s."websiteId" = w."id";

INSERT INTO "ContentVersion" (
    "id", "websiteId", "resourceType", "resourceId", "version", "snapshot", "changeNote"
)
SELECT
    gen_random_uuid(),
    wt."websiteId",
    'THEME'::"ContentResourceType",
    t."id",
    t."version",
    jsonb_build_object('name', t."name", 'tokens', t."tokens"),
    'Baseline snapshot (migration)'
FROM "WebsiteTheme" wt
JOIN "Theme" t ON t."id" = wt."themeId";

CREATE FUNCTION prevent_published_page_version_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD."isPublished" THEN
        RAISE EXCEPTION 'Published page versions are immutable';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PageVersion_prevent_published_mutation"
BEFORE UPDATE OR DELETE ON "PageVersion"
FOR EACH ROW
EXECUTE FUNCTION prevent_published_page_version_mutation();

CREATE FUNCTION prevent_content_version_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Content versions are immutable';
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ContentVersion_prevent_mutation"
BEFORE UPDATE OR DELETE ON "ContentVersion"
FOR EACH ROW
EXECUTE FUNCTION prevent_content_version_mutation();
