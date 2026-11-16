import argon2 from "argon2";
import crypto from "node:crypto";

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export function generateApiKey(): string {
  return "cms_" + crypto.randomBytes(32).toString("base64url");
}

export function hashApiKey(key: string, pepper: string): string {
  return crypto.createHmac("sha256", pepper).update(key).digest("hex");
}

export function generateWebhookSecret(): string {
  return "whsec_" + crypto.randomBytes(24).toString("base64url");
}