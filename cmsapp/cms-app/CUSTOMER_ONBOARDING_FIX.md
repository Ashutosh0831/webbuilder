# Customer onboarding and website assignment fixes

## What changed

1. New customer records are created as `ACTIVE` so the admin can immediately create a login.
2. Customer detail pages now include a **Create customer login** form.
3. The login is created through Better Auth (password hashing is handled by Better Auth), then linked to the selected customer.
4. Creating a website now requires an active `website_owner` account for that customer.
5. Website creation automatically inserts a `WebsiteMember` record with the seeded `WEBSITE_OWNER` permission role.
6. The customer detail page links directly to website creation and preselects that customer.
7. Website creation redirects to the new website's admin detail page.
8. The duplicate nested `cms-app/` project was removed. The project root is this folder.

## Required setup

Run commands from this folder (the folder containing `package.json`):

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

The project must have a valid `DATABASE_URL` in `.env` before Prisma commands run. Configure the Better Auth secret and application URL as required by the existing `src/lib/auth.ts` setup.

## Admin workflow

1. Sign in using the existing Super Admin account.
2. Open `/admin/customers` and create a customer.
3. Open that customer's detail page.
4. Under **Create customer login**, enter the customer's name, email, a temporary password (minimum 12 characters), and choose **Website Owner**.
5. Share the login details securely. This implementation does not send invitation emails.
6. On the same customer page, click **Create website**.
7. Enter the website name and unique customer slug, then create it.
8. The website is automatically assigned to the customer's Website Owner account.

## Important limitations not addressed by this patch

- Email delivery/invitation links are not configured. The administrator sets an initial password and must share it securely.
- Creating a website does not configure a custom domain, DNS, TLS, or activate public publishing.
- The visual builder's save/preview/autosave issues and other disconnected dashboard modules remain separate work.
- Existing customers created before this patch may still have `PENDING` status. Their detail page now has an **Activate customer** control. Activate the customer before creating a login.

## Verification

This ZIP contains source changes only. Run the setup commands above and verify the flow against your own PostgreSQL database. A successful ZIP generation is not a substitute for a successful local production build or end-to-end test.
