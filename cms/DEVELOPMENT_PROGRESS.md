# Development Progress & Repository Inspection Report

## Repository Inspection Report

### 1. Existing Working Features
- **Monorepo Structure**: `pnpm` workspaces + Turborepo (`apps/admin`, `apps/api`, `apps/generator`, `packages/db`, `packages/resolver`, `packages/shared`, `templates/nextjs-base`).
- **Database Schema (`packages/db`)**: PostgreSQL + Drizzle ORM with migrations `0000`–`0002` covering `clients`, `sites`, `users`, `user_site_access`, `api_keys`, `pages`, `page_revisions`, `site_settings`, `global_settings`, `media`, `media_variants`, `media_usages`, `menus`, `menu_items`, `forms`, `form_submissions`, `audit_log`, `events`, `webhooks`, `webhook_deliveries`, `generation_jobs`.
- **Auth & API Keys (Basic)**: Argon2id password hashing, JWT access/refresh signing, HMAC-SHA256 API key hashing with pepper, initial `super_admin` registration.
- **Document Parser (`apps/api/src/lib/parser.ts`)**: Parses Markdown/plain-text headings, hero, CTA, booking form, FAQs, locations, lists, tables, images, SEO metadata, and unresolved `[Placeholder]` warnings.
- **Admin Dashboard (`apps/admin`)** & **Next.js Template (`templates/nextjs-base`)**: App Router pages, `PageSections.tsx`, `BookingFormBlock.tsx`, `sitemap.ts`, `robots.ts`.

### 2. Incomplete Features & Gaps Found (Prior to Remediation)
- Missing `client_owner` role, `userSiteAccess` enforcement in `requireSiteAccess`, refresh token rotation/revocation, logout, password reset, login rate limiting, and magic-byte upload validation.
- Permissive CORS (`origin: true`), unrestricted bootstrap registration, and `NEXT_PUBLIC_CMS_READ_KEY` exposure in `apps/generator/src/generate.ts`.
- Published pages could not be edited without unpublishing; `PageEditor.tsx` lacked parser preview, SEO tab, and revision history/restore UI.
- Next.js template used `cache: "no-store"` instead of ISR and lacked `/api/revalidate`.
- Missing deployment lifecycle API/UI, outbox worker, and user/API-key management UI.

---

## Completed Tasks
- [x] **Phase 1 (Security & Multi-Tenancy)**:
  - Added `client_owner` role + `SITE_ROLE_RANK` hierarchy in `packages/shared/src/index.ts`.
  - Added `user_client_access`, `refresh_tokens`, `password_reset_tokens` in `packages/db/src/schema/users.ts` + `0003_security_auth_rbac.sql`.
  - Implemented `requireSiteRole`, `resolveUserSiteRole`, `assertUserSiteRole`, and active-site checks in `apps/api/src/middleware/auth.ts`.
  - Implemented refresh token rotation + reuse detection, `/api/admin/auth/logout`, `/api/admin/auth/forgot-password`, `/api/admin/auth/reset-password`, login/form rate limiting (`apps/api/src/lib/rateLimit.ts`), and single-use bootstrap registration in `apps/api/src/routes/auth.ts`.
  - Replaced permissive CORS with `CORS_ALLOWED_ORIGINS` allowlist in `apps/api/src/server.ts`.
  - Added magic-byte image signature validation in `apps/api/src/lib/fileSignature.ts` and wired it into `apps/api/src/routes/media.ts`.
  - Removed `NEXT_PUBLIC_CMS_READ_KEY` from `apps/generator/src/generate.ts`.
  - Added user/site-member/client-owner management routes in `apps/api/src/routes/users.ts`.
- [x] **Phase 2 (Document Parser)**:
  - Created versioned Zod parser output schema (`PARSER_SCHEMA_VERSION = "1.0"`) in `packages/shared/src/parserSchema.ts`.
  - Upgraded `apps/api/src/lib/parser.ts` with Unicode NFC normalization, nested lists, multiple FAQ groups, `introduction`, `services`, `features`, `testimonials`, `custom` sections, malformed input diagnostics, and unsafe HTML/URL stripping.
- [x] **Phase 3 & 4 (Page Management, Draft Versioning & Site Settings)**:
  - Added `draft_content`, `has_unpublished_changes`, `published_version`, and `deployments` table + `0004_draft_versioning_and_deployments.sql`.
  - Updated `packages/resolver/src/interpolate.ts` with `[COMPANY_NAME]`, `[PHONE_NUMBER]`, `[EMAIL]`, `[BUSINESS_ADDRESS]`, `[WEBSITE_URL]` resolution.
  - Updated `apps/api/src/routes/pages.ts` for editing published pages via `draft_content`, atomic publish with `audit_log` + `events` outbox, revision restore on both draft and published pages, and preview API key endpoint.
  - Completed `apps/admin/src/pages/PageEditor.tsx` with Parser Preview, SEO Settings, Draft/Publish controls, and Revision History/Compare/Restore.
- [x] **Phase 5–13 (Next.js Frontend, SEO/ISR, Deployments, Admin UX & Worker)**:
  - Updated `templates/nextjs-base/lib/cms.ts` (ISR cache tags), `app/api/revalidate/route.ts`, `lib/jsonld.ts`, `components/PageSections.tsx`, and `app/[section]/[slug]/page.tsx`.
  - Added `apps/api/src/lib/worker.ts` (outbox ISR revalidation + signed webhook delivery) and `apps/api/src/routes/deployments.ts` (deployment lifecycle, logs, rollback, audit logs, CSV submission export).
  - Added `DeploymentsPage.tsx`, `UsersKeysPage.tsx`, and updated `SiteDashboard.tsx`, `SiteLayout.tsx`, `App.tsx`.
- [x] **Phase 14 (Tests)**:
  - Added `apps/api/src/lib/security.test.ts`, expanded `apps/api/src/lib/parser.test.ts`, and added `packages/resolver/src/interpolate.test.ts`.

## New Database Migrations
- `packages/db/migrations/0003_security_auth_rbac.sql`
- `packages/db/migrations/0004_draft_versioning_and_deployments.sql`

## Modified & Created Files
- `packages/shared/src/index.ts`, `packages/shared/src/parserSchema.ts`
- `packages/db/src/schema/enums.ts`, `users.ts`, `pages.ts`, `ops.ts`
- `packages/resolver/src/interpolate.ts`, `interpolate.test.ts`
- `apps/api/src/server.ts`, `types/fastify.d.ts`, `middleware/auth.ts`
- `apps/api/src/lib/crypto.ts`, `jwt.ts`, `errors.ts`, `fileSignature.ts`, `rateLimit.ts`, `parser.ts`, `parser.test.ts`, `security.test.ts`, `worker.ts`
- `apps/api/src/routes/auth.ts`, `clients.ts`, `sites.ts`, `users.ts`, `pages.ts`, `media.ts`, `siteSettings.ts`, `menu.ts`, `forms.ts`, `deployments.ts`
- `apps/admin/src/App.tsx`, `lib/api.ts`, `lib/auth.tsx`, `pages/PageEditor.tsx`, `pages/SiteDashboard.tsx`, `pages/SiteLayout.tsx`, `pages/DeploymentsPage.tsx`, `pages/UsersKeysPage.tsx`
- `apps/generator/src/generate.ts`
- `templates/nextjs-base/lib/cms.ts`, `lib/jsonld.ts`, `components/PageSections.tsx`, `app/api/revalidate/route.ts`, `app/[section]/[slug]/page.tsx`

## Remaining Verification in Target Environment
- The workspace dependencies are installed and package builds/tests have been run here. Docker Desktop's PostgreSQL/Redis/MinIO services are unavailable while its daemon is stopped, so migrations and API/database/website integration still need a live environment. Docker and Vercel deployment providers are also not implemented; the local deployment runner is implemented but still needs runtime verification.

## Iteration 2 Work (2026-11-18)
- [x] Removed the browser dependency on `NEXT_PUBLIC_CMS_READ_KEY` from the contact form. The form now submits without an API key; the API resolves the site by slug, verifies the form belongs to that site, validates every configured field, rate limits by client IP/site/form, and stores honeypot submissions as spam without emitting notification events.
- [x] Changed the contact page from forced dynamic rendering (`revalidate = 0`) to the template's one-hour ISR policy.
- [ ] The local deployment runner, shared Redis rate limits, and HttpOnly admin auth were implemented in later iterations. Docker/Vercel provider execution and full end-to-end coverage remain unimplemented or unverified; rollback still needs provider support.
- Verification attempt: `pnpm --filter @cms/api build`, generator build, and admin build were invoked, but the shell returned no output before the command runner timed out. Treat these as **not verified**. Database, migrations, and end-to-end tests were not run.

## Iteration 2 Continued (2026-11-18)
- [x] Reworked the outbox worker to claim jobs in a PostgreSQL transaction with `FOR UPDATE SKIP LOCKED`, apply exponential retry delays, cap retries at eight, recover abandoned processing claims, and emit structured error logs.
- [x] Webhook/revalidation delivery rejects non-public DNS/IP targets and does not follow redirects. Successfully delivered webhooks are skipped on event retry to reduce duplicate side effects.
- [x] Added event attempt/availability/claim columns and restored previously failed events to the retry queue in migration `0005_outbox_reliability.sql`. Added missing 0003 and 0004 entries to Drizzle's migration journal so those existing SQL migrations are included in migration runs.
- Fixed the two parser defects exposed by the first test run: list normalization had been stripping indentation, and Markdown image parsing missed unsafe URLs containing parentheses.
- Verification: package DB TypeScript check passed. API TypeScript check still fails in `pages.ts` at multiple `.rows` accesses on postgres-js `RowList` results; there were no reported diagnostics in the changed worker/schema files. Parser tests now pass: 11/11. Database migration execution and outbox integration tests were not run.

## Iteration 3 (2026-11-18)
- [x] Added per-site Modern, Editorial, Rounded, and Bold layout presets and preserved them in the generated website.
- [x] Centralized CMS page routing so service, location, blog, home, FAQ, and contact pages use canonical website paths in navigation, route validation, and sitemap generation. Added the services and locations index URLs to the sitemap.
- [x] Added outbox events for public site-setting, menu, and published service/location/blog entry changes. Site revalidation now expires affected content tags and detail/listing routes.
- [x] Enabled HTTP loopback revalidation only for development mode, while keeping webhook requests and production targets subject to public-address validation. Added the shared revalidation secret to API/site environment examples and propagated it to newly generated sites.
- [x] Made settings, menu, and content-change outbox writes part of the same database transactions as their corresponding edits, avoiding saved changes without a durable revalidation event.
- [x] Replaced direct S3 media links with stable API image URLs backed by server-side S3 reads; added alt text/caption editing, URL copying, and delete controls to the CMS media library. Deletion checks saved pages/content/settings and removes the S3 object when the image is unused. Page editing now includes a picker that inserts library images into Markdown content.
- [x] Added a page approval workflow with reviewer assignment, submit/resubmit, approval/rejection comments, review history, audit/outbox events, self-approval protection, and a publish gate that requires approval. Live published content remains online while edits are reviewed. Added migration `0006_page_approval_workflow.sql`.
- [ ] Live approval and scheduled publishing/migration integration tests remain to be run. Docker CLI is installed but the Docker Desktop daemon is stopped, so PostgreSQL, Redis, and MinIO are not available for runtime verification.
- [x] Built API, generator, admin, and generated website successfully using package-level npm builds. Website build logs connection-refused warnings when the CMS API is not running; static build and type validation still complete.
- [ ] Live API/database/outbox-to-website revalidation and full multi-site end-to-end flows still need runtime verification. Local deployment works at code level; Docker/Vercel providers remain unimplemented.

## Iteration 4 (2026-11-18)
- [x] Implemented scheduled page publishing and unpublishing with backend permission checks, approval validation, one-year scheduling limits, cancellation/rescheduling, audit records, and durable future outbox events. The worker verifies that each scheduled event still matches the page's current schedule before acting; edits cancel a pending publish schedule.
- [x] Added the page editor controls for scheduling and cancelling publish/unpublish actions.
- [x] Bounded the in-memory rate-limit store with periodic expiry cleanup and a hard bucket limit, preventing unbounded growth from many distinct request keys.
- [x] Kept the editor's scheduled-action state in sync after manual unpublishing, prevented scheduling a publish while an unpublish is pending, and exposed scheduled actions/times in the site page list.
- Verification: database, API, and admin production builds pass after the scheduling changes; API build passes after the rate-limit store change; admin build passes after the scheduling UX fixes; API parser tests pass (11/11). The resolver package build passes; it has no `test` script. Runtime schedule processing and migration application remain unverified because Docker Desktop/PostgreSQL are unavailable in this environment.
- [ ] Shared Redis rate limiting, secure HttpOnly browser sessions, and the editor's structured preview were implemented in later iterations. Docker/Vercel providers and full multi-site runtime verification remain open.

## Iteration 5 (2026-11-18)
- [x] Replaced the deployment API's in-process `setImmediate` execution with a transactional `deployment.requested` outbox event. The deployment row, audit entry, and durable work item are now created together, so API restarts do not discard queued deployment work.
- [x] Moved deployment execution into a worker runner. Terminal deployment states are idempotent, transient worker errors are retried by the outbox, and jobs that exhaust retries are marked failed with an error and log entry.
- [x] Added a permission-checked manual retry endpoint and a Retry action for failed deployments; retries reset the existing deployment record and atomically enqueue another durable job with an audit entry.
- [ ] The local deployment runner and health checks were implemented in Iteration 6. Docker/Vercel provider execution remains unimplemented; deployment runtime still needs a live database and application environment.
- Verification: API and admin TypeScript/production builds pass; API parser tests pass (11/11). Deployment worker/database behavior remains unverified without PostgreSQL and a running API worker.

## Iteration 6 (2026-11-18)
- [x] Added AES-256-GCM encrypted storage for per-site read API keys, derived from the existing API key pepper. New site creation and read-key rotation save both the verification hash and an encrypted server-side copy; other key types remain hash-only. Added migration `0008_encrypted_site_read_keys.sql`; legacy sites need a read-key rotation before automated generation.
- [x] Implemented the local deployment target: the outbox worker uses that site's read key to generate its Next.js app, installs dependencies, builds production output, starts it on an available local port, and marks it READY only after HTTP health passes. The process is checked for exit, READY local apps are restored after API restart, and a periodic health check recovers stopped local apps.
- [x] Revalidation now targets the latest READY local deployment when no public URL is set. Updated the deployment UI to describe the real local flow and remaining Docker/Vercel setup.
- [x] Made deployment cancellation race-safe: only queued jobs can be cancelled, their pending outbox event is processed, and audit history records the action.
- [x] Added outbox claim heartbeats so a long local dependency install/build does not look abandoned to another worker instance.
- Verification: DB, API, generator, and admin production builds pass; API tests pass (15/15, including encrypted-key round-trip/wrong-key checks); migration journal JSON parses. The generated Next.js production build completed and reported its routes; its build-time CMS fetches were denied by the sandbox because the API was not running. Docker Desktop is stopped, so local deployment, health recovery, and migration application remain unverified against PostgreSQL.

## Iteration 7 (2026-11-18)
- [x] Moved browser refresh tokens from localStorage into path-scoped HttpOnly cookies; access tokens now live only in memory. The admin clears legacy stored tokens and refreshes after reload. Non-browser login/refresh clients retain the existing token response behavior.
- [x] Added SameSite/Secure cookie configuration and origin allowlist checks for cookie login, refresh, and logout requests. Documented `AUTH_COOKIE_SAME_SITE` in `.env.example`.
- [x] Fixed refresh-token reuse detection so revoking the token family commits before the request returns unauthorized; invalid cookie sessions are cleared on refresh.
- [x] Routed media uploads through the shared authenticated API client so expired access tokens refresh and retry consistently.
- Verification: API and admin production builds pass; API tests pass (16/16, including cookie flags, origin checks, and encrypted API key checks). Browser/API cookie flow still needs runtime verification with PostgreSQL and the application servers running.

## Iteration 8 (2026-11-18)
- [x] Converted login and public form rate limits to an asynchronous Redis-backed atomic counter with expiry. Redis keys are SHA-256 hashed to avoid storing emails/IPs directly. Auth and form routes now await rate-limit decisions.
- [x] Production rate limiting fails closed with HTTP 503 if Redis is not configured or unavailable. Development/test keeps the bounded in-memory fallback. `/health` now reports whether rate limiting uses Redis, memory fallback, or an unavailable store.
- [x] Added tests for the Redis branch decision logic, RESP parser, production fail-closed behavior, and existing in-memory limits. The sandbox denies TCP loopback, so the Redis branch test injects the counter transport and parser test exercises actual RESP input without a socket.
- Verification: API production build passes; API tests pass (19/19). Live Redis behavior remains unverified because Docker Desktop/Redis are unavailable.

## Iteration 9 (2026-11-18)
- [x] Expanded the page editor preview to render introduction, service, feature, and testimonial blocks, and made its heading, image, FAQ, table, list, CTA, and booking markup follow the generated website template.
- [x] Grouped H2 headings and their following blocks into the same card structure used on generated pages. Applied site theme colors, typography, and layout variants to preview styles.
- [x] Matched the generated page's individual content cards for introduction, services, features, and testimonial blocks, including blocks nested beneath an H2 group.
- Verification: Admin TypeScript and production build pass. Preview rendering still needs visual confirmation against a running generated website and real CMS content.
- [ ] Live database, Redis, API, generated website and multi-site runtime checks remain unavailable while Docker Desktop is stopped.

## Iteration 10 (2026-11-18)
- [x] Validated menu destination URLs at the API boundary, rejecting unsafe schemes and internal paths that do not match a published page or known site route.
- [x] Validated menu parent relationships so items cannot point into another menu or create a nesting cycle. Generated navigation now renders label-only parent groups when they have valid child links.
- Verification: API, generator, and admin package builds pass; API tests pass (19/19). The root Turbo build was attempted twice but cannot run package scripts because installed pnpm 12 tries to fetch the repository-pinned pnpm 9.0.0 from npm, and network DNS is unavailable. Full API/database menu integration and generated website runtime checks remain unavailable without local services.

## Iteration 11 (2026-11-18)
- [x] Website creation now navigates directly into the new website's management workspace. The one-time API keys travel through in-memory router state and are shown there with copy controls; dismissing the panel clears them from history state.
- Verification: Admin TypeScript and production build pass. A full creation flow still needs live API/database verification.

## Iteration 12 (2026-11-18)
- [x] Added a duplicate-page API action that copies the current editable version into a new draft with a collision-safe `-copy` slug, fresh review/schedule state, and an audit record.
- [x] Added duplicate and delete actions to the website page list. Page deletion now writes its audit and revalidation outbox records in the same transaction as the delete.
- Verification: API production build passes; API tests pass (19/19); admin production build passes. Duplicate/delete and invalidation behavior still needs PostgreSQL integration verification.

## Iteration 13 (2026-11-18)
- [x] Completed the website creation handoff: successful creation opens that site's workspace and retains one-time API keys there with copy and dismiss controls.
- [x] Added page duplication from the current draft/live-edit version and exposed duplicate/delete controls in the page list. Page deletion and its audit/revalidation records now commit atomically.
- Verification: API and admin TypeScript/production builds pass; API tests pass (19/19). Database-backed page CRUD and the website creation flow remain to be integration tested.

## Iteration 14 (2026-11-18)
- [x] Hardened site member role changes: non-superadmins cannot change a member whose effective current role is above their own or grant a role above their own. Site-level membership changes are serialized against a site lock and audited transactionally.
- [x] Member removal now protects the last site owner and refuses to report success when inherited client-level access would remain active.
- Verification: API TypeScript/production build passes; API tests pass (19/19). Permission behavior still needs PostgreSQL-backed multi-user integration tests.

## Iteration 15 (2026-11-18)
- [x] Generated navigation now falls back to published CMS pages when every configured menu destination has become invalid or unpublished, instead of rendering an empty header.
- Verification: Template layout TypeScript/JSX syntax transpilation passes; admin production build passes. A full generated-site build still requires regenerating the site and the CMS API, which are unavailable here.

## Iteration 16 (2026-11-18)
- [x] Aligned homepage, FAQ, service/location/blog indexes and detail routes to the same one-hour ISR interval as the contact page. CMS fetches retain their tags, so outbox revalidation can refresh these pages consistently.
- Verification: All public route modules report `revalidate = 3600`; no route-level zero-revalidation setting remains. The current template routes were built with the generated site's installed Next dependencies; production build passed and listed 12 routes. Static generation logged connection-refused CMS fetches because the API is not running, so CMS-backed page data and publish-to-revalidate still need a live end-to-end check.

## Iteration 17 (2026-11-18)
- [x] Propagated the current public template route and navigation files to the generated sample site and completed a successful Next.js production build.
- Verification: `generated/acme-springfield` build exits successfully and produces static/dynamic routes. It logs `ECONNREFUSED` during build-time CMS fetches because no API server is listening; the output therefore does not prove live content integration.

## Iteration 18 (2026-11-18)
- [x] Implemented local Docker deployment for generated websites: Docker builds the app in a container, passes the CMS `.env.local` only as a BuildKit secret during the build, passes runtime settings through Docker's env file, publishes the app on localhost, and records READY only after an HTTP health check.
- [x] Each deployment now gets its own generated snapshot, so later CMS deployments do not overwrite the files that an earlier local deployment needs to recover.
- [x] Made Docker retries remove a same-deployment container left behind by a worker restart before creating the replacement container.
- [x] Clarified the deployment screen to distinguish local Docker hosting from Vercel, which still needs provider credentials and project setup.
- Verification: API TypeScript build, generator TypeScript build, and admin TypeScript plus production build pass. Docker CLI is installed, but Docker Desktop's Linux engine is stopped, so a real container build and health check could not be run here. The normal pnpm build commands remain unavailable because the installed pnpm attempts to download the pinned pnpm 9 release; the same package build scripts were run using the installed local tool binaries. Vercel provider deployment is still incomplete.

## Iteration 19 (2026-11-18)
- [x] Implemented rollback for READY local and Docker deployments using the deployment's preserved build snapshot. The API health-checks or restores the selected version before activating it, creates an activation record, prevents rollback while another deployment is building, and writes an audit event.
- [x] Enabled rollback actions in the admin deployment history for local and Docker builds; unsupported providers remain clearly unavailable.
- Verification: API TypeScript build and admin TypeScript plus production build pass. Live rollback still needs PostgreSQL and a running local server or Docker engine for end-to-end verification.

## Iteration 20 (2026-11-18)
- [x] Media uploads now remove the stored object if the database insert fails, preventing orphaned uploads in the normal failure path.
- [x] Media deletion now commits the database removal and a durable object-cleanup event together; the worker deletes the stored image after commit and retries failures.
- [x] Replaced the media route's unsafe `any` cast for upload alt text with multipart type narrowing and a 500-character server-side limit.
- Verification: API TypeScript build passes and the existing API unit suite passes (19/19). S3/MinIO and PostgreSQL integration behavior still needs live service verification.

## Iteration 21 (2026-11-18)
- [x] Added persistent media folders with a non-destructive database migration, safe nested-folder normalization, folder assignment on upload/edit, and admin search plus folder/type filters.
- [x] Added focused tests for folder path normalization and traversal/control-character rejection.
- Verification: database, API, and admin production builds pass; API unit tests pass (21/21). Migration application and media CRUD still need a live PostgreSQL/MinIO check.
