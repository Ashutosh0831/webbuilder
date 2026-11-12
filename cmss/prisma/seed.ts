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

  console.log("Seed completed: roles, permissions, and component definitions.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());