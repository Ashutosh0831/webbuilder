import { createHash } from "node:crypto";
import { createConnection as createTcpConnection } from "node:net";
import { connect as createTlsConnection } from "node:tls";
import { Errors } from "./errors.js";

interface RateBucket {
  count: number;
  resetAt: number;
}

const memoryBuckets = new Map<string, RateBucket>();
const MAX_MEMORY_BUCKETS = 25_000;
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanupAt = 0;

function cleanMemoryBuckets(now: number): void {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS && memoryBuckets.size < MAX_MEMORY_BUCKETS) return;
  lastCleanupAt = now;

  for (const [key, bucket] of memoryBuckets) {
    if (bucket.resetAt <= now) memoryBuckets.delete(key);
  }

  // Keep a hard memory bound if a burst produces many distinct keys before
  // their windows expire. Map iteration is insertion ordered, so this evicts
  // the oldest buckets first.
  while (memoryBuckets.size >= MAX_MEMORY_BUCKETS) {
    const oldestKey = memoryBuckets.keys().next().value;
    if (oldestKey === undefined) break;
    memoryBuckets.delete(oldestKey);
  }
}

type RedisValue = string | number | null | RedisValue[];

function encodeRedisCommand(args: string[]): Buffer {
  const chunks: Buffer[] = [Buffer.from(`*${args.length}\r\n`)];
  for (const arg of args) {
    const value = Buffer.from(arg);
    chunks.push(Buffer.from(`$${value.length}\r\n`), value, Buffer.from("\r\n"));
  }
  return Buffer.concat(chunks);
}

export function parseRedisValue(input: Buffer, offset: number): { value: RedisValue; offset: number } | null {
  if (offset >= input.length) return null;
  const marker = input[offset];
  const lineEnd = input.indexOf("\r\n", offset);
  if (lineEnd < 0) return null;
  const line = input.toString("utf8", offset + 1, lineEnd);
  const next = lineEnd + 2;

  if (marker === 43) return { value: line, offset: next };
  if (marker === 45) throw new Error(`Redis error: ${line}`);
  if (marker === 58) {
    const number = Number(line);
    if (!Number.isSafeInteger(number)) throw new Error("Redis returned an invalid integer");
    return { value: number, offset: next };
  }
  if (marker === 36) {
    const length = Number(line);
    if (length === -1) return { value: null, offset: next };
    if (!Number.isSafeInteger(length) || length < 0) throw new Error("Redis returned an invalid bulk string length");
    if (input.length < next + length + 2) return null;
    if (input[next + length] !== 13 || input[next + length + 1] !== 10) throw new Error("Redis returned a malformed bulk string");
    return { value: input.toString("utf8", next, next + length), offset: next + length + 2 };
  }
  if (marker === 42) {
    const length = Number(line);
    if (length === -1) return { value: null, offset: next };
    if (!Number.isSafeInteger(length) || length < 0 || length > 1000) throw new Error("Redis returned an invalid array length");
    const values: RedisValue[] = [];
    let cursor = next;
    for (let index = 0; index < length; index += 1) {
      const child = parseRedisValue(input, cursor);
      if (!child) return null;
      values.push(child.value);
      cursor = child.offset;
    }
    return { value: values, offset: cursor };
  }
  throw new Error(`Redis returned an unsupported response marker: ${String.fromCharCode(marker)}`);
}

async function redisIncrement(key: string, windowMs: number): Promise<{ count: number; ttlMs: number }> {
  const rawUrl = process.env.REDIS_URL;
  if (!rawUrl) throw new Error("REDIS_URL is not configured");
  const url = new URL(rawUrl);
  if (url.protocol !== "redis:" && url.protocol !== "rediss:") throw new Error("REDIS_URL must use redis:// or rediss://");
  const port = Number(url.port || 6379);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("REDIS_URL has an invalid port");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  const commands: string[][] = [];
  if (url.password) {
    commands.push(url.username
      ? ["AUTH", decodeURIComponent(url.username), decodeURIComponent(url.password)]
      : ["AUTH", decodeURIComponent(url.password)]);
  }
  const database = url.pathname.replace(/^\//, "");
  if (database) {
    if (!/^\d+$/.test(database)) throw new Error("REDIS_URL database path must be a nonnegative integer");
    if (Number(database) !== 0) commands.push(["SELECT", database]);
  }
  commands.push([
    "EVAL",
    "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]); end; return {n,redis.call('PTTL',KEYS[1])}",
    "1",
    key,
    String(windowMs),
  ]);

  return new Promise((resolve, reject) => {
    const socket = url.protocol === "rediss:"
      ? createTlsConnection({ host: hostname, port, servername: hostname })
      : createTcpConnection({ host: hostname, port });
    const expected = commands.length;
    let received = 0;
    let buffer = Buffer.alloc(0);
    let result: RedisValue;
    let settled = false;
    const finishError = (error: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(error);
    };
    socket.setTimeout(3000, () => finishError(new Error("Redis request timed out")));
    socket.once(url.protocol === "rediss:" ? "secureConnect" : "connect", () => {
      socket.write(Buffer.concat(commands.map(encodeRedisCommand)));
    });
    socket.on("data", (chunk: Buffer) => {
      if (settled) return;
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > 1_000_000) return finishError(new Error("Redis response exceeded the allowed size"));
      try {
        while (received < expected) {
          const parsed = parseRedisValue(buffer, 0);
          if (!parsed) break;
          buffer = buffer.subarray(parsed.offset);
          result = parsed.value;
          received += 1;
        }
        if (received === expected) {
          const values = result;
          if (!Array.isArray(values) || values.length !== 2) throw new Error("Redis rate limit response is malformed");
          const count = Number(values[0]);
          const ttlMs = Number(values[1]);
          if (!Number.isSafeInteger(count) || !Number.isFinite(ttlMs)) throw new Error("Redis rate limit values are invalid");
          settled = true;
          socket.end();
          resolve({ count, ttlMs: Math.max(1, ttlMs) });
        }
      } catch (error) {
        finishError(error instanceof Error ? error : new Error(String(error)));
      }
    });
    socket.once("error", finishError);
    socket.once("close", () => {
      if (!settled) finishError(new Error("Redis connection closed before responding"));
    });
  });
}

type RedisCounter = (key: string, windowMs: number) => Promise<{ count: number; ttlMs: number }>;
let redisCounter: RedisCounter = redisIncrement;

export function setRateLimitRedisTransportForTest(transport?: RedisCounter): void {
  redisCounter = transport ?? redisIncrement;
}

export async function rateLimitStoreHealth(): Promise<{ status: "ok" | "memory" | "error"; message?: string }> {
  if (!process.env.REDIS_URL) {
    return process.env.NODE_ENV === "production"
      ? { status: "error", message: "REDIS_URL is required in production" }
      : { status: "memory" };
  }
  try {
    await redisCounter(`cms:health:${process.pid}:${Date.now()}`, 1000);
    return { status: "ok" };
  } catch (error) {
    return {
      status: process.env.NODE_ENV === "production" ? "error" : "memory",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

/**
 * Simple sliding/fixed-window rate limiter with automatic cleanup.
 * Uses in-memory store (safe for single-instance & tests); can be backed by Redis.
 */
export async function checkRateLimit(opts: RateLimitOptions): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
}> {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const hashedKey = createHash("sha256").update(opts.key).digest("hex");
      const result = await redisCounter(`cms:rate:${hashedKey}`, opts.windowMs);
      return {
        allowed: result.count <= opts.limit,
        remaining: Math.max(0, opts.limit - result.count),
        resetAt: Date.now() + result.ttlMs,
      };
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        console.error(JSON.stringify({ level: "error", event: "rate_limit.redis", error: error instanceof Error ? error.message : String(error) }));
        throw Errors.unavailable("Rate limiting is temporarily unavailable");
      }
      console.warn(JSON.stringify({ level: "warn", event: "rate_limit.redis_fallback", error: error instanceof Error ? error.message : String(error) }));
    }
  } else if (process.env.NODE_ENV === "production") {
    throw Errors.unavailable("REDIS_URL is required for production rate limiting");
  }

  const now = Date.now();
  cleanMemoryBuckets(now);
  const existing = memoryBuckets.get(opts.key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + opts.windowMs;
    memoryBuckets.set(opts.key, { count: 1, resetAt });
    return { allowed: true, remaining: opts.limit - 1, resetAt };
  }

  if (existing.count >= opts.limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, opts.limit - existing.count),
    resetAt: existing.resetAt,
  };
}

export async function enforceRateLimit(opts: RateLimitOptions, message = "Too many requests, please try again later"): Promise<void> {
  const res = await checkRateLimit(opts);
  if (!res.allowed) {
    throw Errors.rateLimited(message);
  }
}

export function clearRateLimitsForTest(): void {
  memoryBuckets.clear();
  lastCleanupAt = 0;
}
