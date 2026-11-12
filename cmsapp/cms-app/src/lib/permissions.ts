import { createAccessControl } from "better-auth/plugins/access";

const statement = {
  website: ["create", "read", "update", "delete", "manage_members"],
  page: ["create", "read", "update", "delete", "publish"],
  media: ["upload", "read", "delete"],
  domain: ["manage"],
  user: ["create", "read", "update", "ban", "set_role"],
  publish: ["submit", "approve"],
} as const;

export const ac = createAccessControl(statement);

export const roles = {
  super_admin: ac.newRole({
    website: ["create", "read", "update", "delete", "manage_members"],
    page: ["create", "read", "update", "delete", "publish"],
    media: ["upload", "read", "delete"],
    domain: ["manage"],
    user: ["create", "read", "update", "ban", "set_role"],
    publish: ["submit", "approve"],
  }),
  website_owner: ac.newRole({
    website: ["read", "update", "manage_members"],
    page: ["create", "read", "update", "delete", "publish"],
    media: ["upload", "read", "delete"],
    domain: ["manage"],
    user: ["read"],
    publish: ["submit", "approve"],
  }),
  editor: ac.newRole({
    website: ["read"],
    page: ["create", "read", "update"],
    media: ["upload", "read"],
    publish: ["submit"],
  }),
};