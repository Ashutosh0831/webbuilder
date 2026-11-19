import type { SiteRole } from "@cms/shared";
import type { AccessPayload } from "../lib/jwt.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: AccessPayload;
    siteScope?: {
      siteId: string;
      via: "jwt" | "api_key";
      keyType?: "read" | "write" | "preview";
      siteRole?: SiteRole;
    };
  }
}