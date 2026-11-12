# CMS Website Builder

A multi-tenant CMS built with Next.js App Router, React, Prisma/PostgreSQL, Better Auth, and S3-compatible media storage. The visual builder stores page content as versioned `PageVersion.content` JSON and renders the published version on the public site route.

## Requirements

- Node.js 22 or newer
- PostgreSQL 15 or newer
- An S3-compatible bucket for media uploads (AWS S3, MinIO, or Cloudflare R2)

## Local setup

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env` and configure the database, authentication secret, and object-storage values. Keep real credentials private; do not commit `.env`.

3. Generate the Prisma client, apply migrations, and seed roles/permissions:

   ```bash
   npx prisma generate
   npx prisma migrate deploy
   npx prisma db seed
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000`.

5. Create or provision the initial platform super-admin account using your deployment's account-bootstrap procedure. The seed script creates roles, permissions, and component definitions; it does not create a user account.

## Website and page workflow

- A platform super-admin creates a customer and an active Website Owner login.
- Create a website from **Admin → Websites → Create website**. The selected customer must have an active Website Owner login and an available website quota.
- Open the website's Pages area and create a draft page with a title and URL slug.
- The page opens in the visual builder. Add blocks from the left palette, select a block to edit its properties, and use the nested-content controls on Container and Columns blocks to add child content.
- Changes autosave after a short pause. The toolbar also provides manual Save, Undo/Redo, responsive breakpoint editing, draft Preview, and Submit for Review.
- A user with publishing approval permission reviews and publishes the submitted version. The public route serves only the published page version for an active website with a verified/active domain.

## Content blocks

The builder includes Heading (H1–H4), Paragraph, Image, Button, Card, Hero, Container, Columns, Divider, Spacer, Feature Grid, FAQ, Testimonials, Navigation, and Footer blocks. Structured repeating content (FAQ items, feature items, testimonials, and navigation/footer links) is edited as JSON in the block properties panel.

## Media storage

The Media Library uploads files directly to the configured S3-compatible bucket using a short-lived presigned URL. Images are stored with inline content disposition; other files are served as downloads. If `S3_PUBLIC_URL` is empty, the app streams media through `/api/media/download` and restricts anonymous reads to assets belonging to active websites with published pages.

Configure the bucket's CORS policy to allow `PUT` from the CMS origin and the `Content-Type` and `Content-Disposition` request headers. The maximum accepted upload size is 20 MB. SVG and plain-text uploads are intentionally not enabled because the current upload verifier relies on file signatures.

## Validation commands

```bash
npm run lint
npx tsc --noEmit
npm run build
```

The application also requires live PostgreSQL, authentication, and S3 configuration for end-to-end verification. A successful local TypeScript check alone does not verify those external services.
