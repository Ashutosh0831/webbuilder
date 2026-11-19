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

function apiKeyVaultKey(pepper: string): Buffer {
  if (pepper.length < 32) throw new Error("API_KEY_PEPPER must contain at least 32 characters");
  return crypto.createHmac("sha256", pepper).update("cms:api-key-vault:v1").digest();
}

export function encryptApiKey(key: string, pepper: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", apiKeyVaultKey(pepper), iv);
  const ciphertext = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptApiKey(encrypted: string, pepper: string): string {
  const [version, ivValue, tagValue, ciphertextValue] = encrypted.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error("Stored API key has an unsupported encryption format");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", apiKeyVaultKey(pepper), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString("utf8");
}

export function generateOpaqueToken(prefix = "tok_"): string {
  return prefix + crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token: string, pepper = process.env.API_KEY_PEPPER ?? "default-pepper"): string {
  return crypto.createHmac("sha256", pepper).update(token).digest("hex");
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function generateWebhookSecret(): string {
  return "whsec_" + crypto.randomBytes(24).toString("base64url");
}
