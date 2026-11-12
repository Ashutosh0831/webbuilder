import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const permissions = [
  { code: "website:create", description: "Create a website" },
  { code: "website:manage", description: "Manage website settings" },
  { code: "page:create", description: "Create pages" },
  { code: "page:edit", description: "Edit pages" },
  { code: "page:delete", description: "Delete pages" },
  { code: "publish:submit", description: "Submit for publishing" },
  { code: "publish:approve", description: "Approve publishing requests" },
  { code: "media:upload", description: "Upload media" },
  { code: "media:delete", description: "Delete media" },
  { code: "domain:manage", description: "Manage custom domains" },
  { code: "user:manage", description: "Manage users in tenant" },
  { code: "audit:read", description: "Read audit logs" },
];

const roles = [
  {
    name: "SUPER_ADMIN",
    description: "Platform super administrator",
    permissions: permissions.map((p) => p.code),
  },
  {
    name: "WEBSITE_OWNER",
    description: "Website owner with management rights",
    permissions: [
      "website:manage",
      "page:create",
      "page:edit",
      "page:delete",
      "publish:submit",
      "publish:approve",
      "media:upload",
      "media:delete",
      "domain:manage",
      "user:manage",
      "audit:read",
    ],
  },
  {
    name: "EDITOR",
    description: "Content editor",
    permissions: ["page:create", "page:edit", "media:upload", "publish:submit"],
  },
];

async function main() {
  // Seed permissions
  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { description: p.description },
      create: p,
    });
  }

  // Seed roles and link permissions
  for (const r of roles) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description, isSystem: true },
      create: { name: r.name, description: r.description, isSystem: true },
    });

    const perms = await prisma.permission.findMany({
      where: { code: { in: r.permissions } },
    });

    for (const perm of perms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: perm.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }

  // Seed default component definitions
  const components = [
    { typeKey: "section", displayName: "Section", category: "Layout", schema: {} },
    { typeKey: "heading", displayName: "Heading", category: "Text", schema: {} },
    { typeKey: "text", displayName: "Text Block", category: "Text", schema: {} },
    { typeKey: "image", displayName: "Image", category: "Media", schema: {} },
    { typeKey: "button", displayName: "Button", category: "Interactive", schema: {} },
  ];

  for (const c of components) {
    await prisma.componentDefinition.upsert({
      where: { typeKey: c.typeKey },
      update: { displayName: c.displayName, schema: c.schema },
      create: c,
    });
  }

    // Seed a default theme
  const defaultTheme = await prisma.theme.upsert({
    where: { id: "00000000-0000-0000-0000-000000000000" }, // Fixed ID for easy reference
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000000",
      name: "Default Theme",
      isDefault: true,
      tokens: {
        colors: {
          background: "#ffffff",
          foreground: "#0f172a",
          primary: "#1f6feb",
          "primary-foreground": "#ffffff",
          secondary: "#f1f5f9",
          "secondary-foreground": "#0f172a",
          muted: "#f8fafc",
          "muted-foreground": "#64748b",
          accent: "#e2e8f0",
          "accent-foreground": "#0f172a",
          border: "#e2e8f0",
        },
        typography: {
          "font-sans": "Inter, system-ui, sans-serif",
          "font-heading": "Inter, system-ui, sans-serif",
          "font-size-base": "16px",
          "font-size-h1": "36px",
          "font-size-h2": "30px",
          "line-height-base": "1.5",
        },
        spacing: {
          "spacing-sm": "8px",
          "spacing-md": "16px",
          "spacing-lg": "24px",
          "spacing-xl": "32px",
        },
        radius: { sm: "4px", md: "8px", lg: "16px" },
        shadows: {
          sm: "0 1px 2px rgba(0,0,0,0.05)",
          md: "0 4px 6px rgba(0,0,0,0.1)",
          lg: "0 10px 15px rgba(0,0,0,0.1)",
        },
        buttons: { radius: "8px", "padding-x": "20px", "padding-y": "10px" },
        containers: { "max-width": "1200px" },
      },
    },
  });

  console.log("Seed completed: roles, permissions, and component definitions.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

    