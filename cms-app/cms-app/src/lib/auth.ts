import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { prisma } from "@/server/db/prisma";

const statement = {
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "impersonate",
    "delete",
    "set-password",
    "get",
    "update",
  ],
  session: ["list", "revoke", "delete"],
} as const;

const ac = createAccessControl(statement);

const roles = {
  super_admin: ac.newRole({
    user: [
      "create",
      "list",
      "set-role",
      "ban",
      "impersonate",
      "delete",
      "set-password",
      "get",
      "update",
    ],
    session: ["list", "revoke", "delete"],
  }),
  editor: ac.newRole({
    user: ["get"],
    session: [],
  }),
  website_owner: ac.newRole({
    user: ["get", "update"],
    session: [],
  }),
};

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    requireEmailVerification: false,
    // Development-only: log reset URL instead of sending email
    sendResetPassword: async ({ user, url }) => {
      if (process.env.NODE_ENV === "development") {
        console.log(`[DEV PASSWORD RESET] ${user.email}: ${url}`);
        return;
      }
      throw new Error("Email delivery not configured. Set up an email provider.");
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,      // refresh after 24h
    cookieCache: { enabled: false }, // always hit DB for immediate ban/suspension
  },

  advanced: {
    cookiePrefix: "cms",
    database: {
      generateId: "uuid",
    //   joins: false,
    },
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  },

  plugins: [
    admin({
      ac,
      roles,
      defaultRole: "editor",
      adminRoles: ["super_admin"],
    }),
    nextCookies(),
  ],
});