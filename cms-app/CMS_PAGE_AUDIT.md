# CMS Page Review and Change Report

Review date: 2026-11-12

## Scope

Reviewed all 30 page modules in the primary `src/app` tree across public,
authentication, tenant dashboard, builder, and super-admin route groups. Also
reviewed the public sitemap and media upload/confirmation route handlers, their
relevant data resolvers, and the dashboard query used by the tenant workspace.

This was a code and route review. It did not include a live database migration,
deployment, browser-based acceptance test, or a full security assessment.

## Changes made in this review

- Replaced the tenant dashboard's sample counts and hard-coded empty activity
  with live counts for the signed-in user's accessible websites, pages, media,
  and distinct website members. Activity is now queried for the signed-in user.
- Removed the unused website-creation dialog that simulated a successful
  request without creating a website. Website creation is available to
  super-admins through the admin flow, not as a misleading tenant-dashboard
  action.
- Reworked the admin website creation page to select an existing customer and
  collect the site's name, slug, description, locale, and timezone through the
  existing server action and validation.
- Added the admin customer detail route, which the customer list already linked
  to. It shows account, quota, user, and website information.
- Changed the root landing-page buttons to navigate to sign-in, the dashboard,
  and page management instead of rendering non-functional buttons.
- Completed the version-history panel's compare workflow using the existing
  website-scoped comparison action, and added loading/error feedback plus
  refresh after restoring a revision.
- Kept customer, website, and per-website page actions visible when their lists
  are empty, so users can still create the first customer, website, or page.
  Empty search results now have an explicit message.

## Existing CMS capabilities reviewed and preserved

- Server-side authentication and super-admin/website-member permission checks.
- Website, page, theme, and media data models and the page builder route.
- Page publication requests, review actions, and publication history.
- Append-only page revisions, website/theme content snapshots, revision
  comparison, and restore-as-a-new-revision flows.
- Public page metadata, Open Graph/Twitter fields, JSON-LD `WebSite` schema,
  and a published-page sitemap.
- Website-domain suspension rather than immediate deletion.
- Bounded public page/theme relation reads and explicit Prisma field selection.

The version-history migration was subsequently applied to the configured local
development database after correcting the approval-user ID column type. Other
deployment databases still need their own migration deployment.

## CMS work still needed

These are gaps identified in inspected pages; they were not implemented because
the desired behavior and lifecycle policy need product decisions or broader
backend work.

1. **Administration workflows:** Roles/permissions, users, and platform
   settings pages are primarily read-only. Add explicit create/update/deactivate
   workflows and audit coverage where those operations are required.
2. **Customer lifecycle:** Customer details are read-only. Connect activation,
   suspension, archival, and user-management actions with consistent session
   revocation/unban behavior and clear confirmation UX.
3. **Website operations:** Website detail is a read-only overview. Add
   permission-gated editing, domain verification/removal status, member
   assignment, and website settings workflows. A delayed domain deletion job
   and configurable grace period are not implemented.
4. **Content discovery and scale:** Several list pages show only the first 100
   rows or have incomplete pagination/filter controls. Add consistent
   search/status filters and pagination for pages, media, users, and other
   growing collections; preserve filters in pagination links.
5. **Media management:** The dashboard media route is a recent-files listing.
   Complete the end-user upload, search, preview, alt-text editing, and
   deletion/retention flows, or clearly link to the existing media-library
   component where appropriate.
6. **Settings UX:** Tenant settings and platform settings currently display
   account/runtime information rather than editable CMS/site configuration.
   Define which settings belong to a user, customer, website, or platform, then
   wire validated forms and authorization for each.
7. **SEO/public metadata:** The public route currently emits `WebSite` schema.
   Add page-specific `Article` schema only for article content that actually
   exists, and expose configured `robotsTxt` through a `robots.txt` route.
8. **Operational verification:** Add route-level/component tests for the
   dashboard scope, empty states, customer/website forms, and authorization;
   apply and verify the content-history migration in a deployment environment.

## Validation

- ESLint: passed for all `src/app` routes and `src/server/queries/dashboard.ts`.
- Versioning tests: passed, 4 tests.
- `git diff --check`: passed for the reviewed changes.
- Full TypeScript check: blocked by existing unresolved imports reported by the
  repository check: `cms-app/prisma/seed.ts` cannot resolve
  `../src/generated/prisma/client`, the nested
  `cms-app/src/app/(dashboard)/dashboard/page.tsx` cannot resolve its
  `CreateWebsiteDialog` import. The missing
  `src/features/versions/version-history-panel.tsx` comparison-dialog dependency
  was removed by wiring the existing comparison action directly into that
  panel. The nested `cms-app/cms-app` tree was left untouched.
- The versioning test runner emitted a Better Auth warning that `BETTER_AUTH_URL`
  is unset; the tests themselves passed.
