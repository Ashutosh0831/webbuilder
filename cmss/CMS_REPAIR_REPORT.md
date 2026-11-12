# CMS Application Repair Report

Scope: `cmsapp/cms-app` from the supplied ZIP archive.

## Repairs applied in this pass

1. **Fixed the remaining Base UI dropdown context error**
   - Wrapped the account label and profile item in `DropdownMenuGroup` in `src/components/layout/user-menu.tsx`.
   - The dashboard header in this ZIP already has its label inside a group.

2. **Connected builder autosave**
   - Mounted `AutosaveManager` inside `BuilderShell`.
   - Clear pending autosave timers when switching to another page and when a save starts.
   - Reset the dirty state as soon as the user edits content; show save, error, and conflict status in the toolbar.
   - Connected the toolbar Save button to the same server-side autosave flow.

3. **Connected draft preview**
   - The Preview button now opens a draft preview dialog based on the current in-memory builder content.
   - Preview is explicitly labelled as a draft and does not publish the page.

4. **Preserved responsive builder data**
   - Extended the recursive builder validation schema to accept tablet and desktop overrides.
   - Extended the stored section type and public renderer to output the correct mobile/tablet/desktop variant using responsive visibility classes.
   - The draft preview resolves the selected breakpoint rather than rendering all breakpoint variants at once.

5. **Fixed page duplication**
   - The old duplication flow read from the legacy `PageSection` relation and wrote a `componentType` property, while the current builder stores content in `PageVersion.content` and expects `componentKey`.
   - Duplication now clones the latest page-version content, preserves responsive overrides and nested children, and generates fresh section IDs.

6. **Connected page creation to the visual builder**
   - Creating a page now opens its visual builder directly.
   - The page metadata editor also has an explicit Open Visual Builder link.

7. **Fixed public document markup**
   - The public tenant page previously returned nested `<html>` and `<body>` elements even though the root App Router layout already owns those elements.
   - It now returns content within a language-tagged wrapper and leaves document ownership to the root layout.

8. **Made media upload validation consistent**
   - Removed SVG and plain-text uploads from the allowed MIME list because the current magic-byte verifier cannot reliably validate those text-based formats.
   - Derive storage extensions from the allowed MIME type instead of trusting the user's filename extension.
   - Enforce the same 20 MB maximum during upload confirmation.

9. **Declared Zustand directly**
   - The builder imports Zustand directly; it is now listed as a direct dependency (`^5.1.0`) and added to the lockfile root dependency list. The existing lockfile already contains Zustand 5.1.0 through the Zundo peer dependency.

## Validation performed

- TypeScript transpilation/syntax checks passed for all 14 modified TypeScript/TSX files.
- `package.json` and `package-lock.json` parse as valid JSON.
- A full `tsc --noEmit` and Next.js build could not be completed in this environment because dependencies were not installed. `npm ci` timed out while fetching packages, leaving an incomplete `node_modules`; that partial folder was removed before packaging.
- No live PostgreSQL database, S3-compatible storage, authentication provider configuration, or browser session was available. Database migrations, auth flows, actual uploads, and end-to-end publishing therefore remain unverified.

## Remaining work identified in the broader audit

- Complete editable workflows for roles/permissions, platform settings, customer lifecycle, website settings/domains and user administration.
- Improve list pagination/filtering for large customer, user, page and media collections.
- Complete media management (preview, alt text, delete/retention) beyond the current upload and listing path.
- Configure and verify PostgreSQL migrations, seed data, Better Auth environment variables, and S3 settings in the target environment.
- Add automated integration/e2e tests for website creation, builder autosave, duplication, media upload, review/approval, and public rendering.

## Setup and verification on the developer machine

From this folder (the folder containing `package.json`):

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run lint
npx tsc --noEmit
npm run build
npm run dev
```

Configure a valid `.env` locally before running Prisma or the application. Do not commit or share production credentials.

## Website-builder completion pass

The follow-up audit found that several builder blocks could be inserted but had no property editor, nested layout blocks had no way to receive children, and the Media Library component was not mounted anywhere. The following additional repairs were applied:

1. **Made every registered block editable**
   - Added property controls for Heading, Hero, Card, Container, Columns, Divider, FAQ, Feature Grid, Footer, Navigation, Spacer, and Testimonials; existing Paragraph, Image, and Button controls remain.
   - Added a JSON editor for repeating content such as FAQ entries, navigation links, testimonials, and feature items.
   - Fixed numeric select values for heading level and column count so they are stored as numbers rather than rejected strings.
   - Added local draft input state so users can clear and retype values without the schema rejecting every intermediate keystroke.

2. **Enabled nested layouts**
   - Added child insertion controls to Container and Columns properties.
   - Made nested sections selectable, editable, duplicable, and removable through recursive store operations.
   - Added server-side component/property/hierarchy validation before a draft is written, so invalid or unsupported nested blocks cannot be saved through a forged client request.
   - Kept recursive section validation and public rendering aligned with the builder's nested content structure.

3. **Added builder workflow controls**
   - Added Undo/Redo controls backed by the existing Zundo history and scheduled autosave after history changes.
   - Added Submit for Review to the builder toolbar; it stays disabled until the latest changes have been saved.
   - Added direct Edit Page links to the website page list and a Create Website shortcut for platform super-admins.

4. **Connected the Media Library**
   - Replaced the dashboard's read-only media listing with per-website upload libraries.
   - Added Copy URL controls so an uploaded image can be pasted into an Image block.
   - Fixed the media confirmation response to serialize Prisma BigInt sizes as numbers.
   - Implemented the previously empty `/api/media/download` route. It resolves the key against a stored media record, enforces website membership for authenticated CMS users, and permits anonymous delivery only for assets belonging to active websites with published pages.
   - Images are served inline; non-image files remain downloads. The upload request now sends the signed Content-Disposition header, and the README documents the bucket CORS requirements.

5. **Hardened content rendering and links**
   - Replaced dynamic Tailwind alignment/spacing class construction with statically discoverable class maps.
   - Constrained editable links and image sources to HTTP(S) URLs or same-site relative paths, rejecting unsafe schemes.
   - Made the image renderer use unoptimized Next Image output so configured S3/media URLs do not require a fixed remote-host allowlist.
   - Avoided mutating nested child arrays during rendering.

6. **Added setup documentation**
   - Replaced the default Next.js starter README with CMS setup, workflow, media-storage, and validation instructions.
   - Added `.env.example` and made sure it is not excluded by `.gitignore`.

## Validation status after the follow-up pass

- TypeScript transpilation/syntax validation passed for all source TypeScript and TSX files inspected in this pass.
- `npm ci --ignore-scripts --prefer-offline --no-audit --no-fund` again timed out in this environment. The incomplete `node_modules` directory was removed before packaging.
- A dependency-backed `tsc --noEmit`, ESLint run, Next.js production build, and live database/S3/authentication/browser workflow remain unverified. Do not treat the archive as production-certified until those checks pass in an environment with network access and valid service credentials.
