import jwt, { type SignOptions } from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_TTL = Number(process.env.JWT_ACCESS_TTL ?? 900);
const REFRESH_TTL = Number(process.env.JWT_REFRESH_TTL ?? 604800);

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must be set in .env");
}

export interface AccessPayload {
  sub: string;
  email: string;
  role: "super_admin" | null;
}

export interface RefreshPayload {
  sub: string;
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_TTL,
  } as SignOptions);
}

export function signRefreshToken(payload: RefreshPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_TTL,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, ACCESS_SECRET) as AccessPayload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, REFRESH_SECRET) as RefreshPayload;
}