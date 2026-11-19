import assert from "node:assert/strict";
import test from "node:test";
import { validateImageSignature } from "./fileSignature.js";
import { checkRateLimit, clearRateLimitsForTest, enforceRateLimit, parseRedisValue, rateLimitStoreHealth, setRateLimitRedisTransportForTest } from "./rateLimit.js";
import { decryptApiKey, encryptApiKey, hashToken, timingSafeEqualStr } from "./crypto.js";
import { clearRefreshCookie, isAllowedCookieOrigin, readCookieHeader, REFRESH_COOKIE_NAME, serializeRefreshCookie } from "./authCookies.js";

test("validateImageSignature accepts real PNG and JPEG headers and rejects SVG/HTML spoofing", () => {
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x03, 0x20, 0x00, 0x00, 0x02, 0x58,
  ]);
  const resPng = validateImageSignature(png);
  assert.equal(resPng?.mime, "image/png");
  assert.equal(resPng?.width, 800);
  assert.equal(resPng?.height, 600);

  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  assert.equal(validateImageSignature(svg), null);

  const shortBuf = Buffer.from([0x89, 0x50]);
  assert.equal(validateImageSignature(shortBuf), null);
});

test("rateLimit blocks requests exceeding threshold within window", async () => {
  clearRateLimitsForTest();
  const previousRedisUrl = process.env.REDIS_URL;
  delete process.env.REDIS_URL;
  const key = "login:127.0.0.1:test@example.com";
  try {
    for (let i = 0; i < 3; i++) {
      const r = await checkRateLimit({ key, limit: 3, windowMs: 60_000 });
      assert.equal(r.allowed, true);
    }
    const blocked = await checkRateLimit({ key, limit: 3, windowMs: 60_000 });
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
  } finally {
    if (previousRedisUrl !== undefined) process.env.REDIS_URL = previousRedisUrl;
  }
});

test("rateLimit uses Redis EVAL responses when REDIS_URL is configured", async () => {
  let count = 0;
  const previousRedisUrl = process.env.REDIS_URL;
  const key = `redis-test:${Date.now()}`;
  process.env.REDIS_URL = "redis://redis.test:6379/0";
  setRateLimitRedisTransportForTest(async () => ({ count: ++count, ttlMs: 60_000 }));
  try {
    const first = await checkRateLimit({ key, limit: 2, windowMs: 60_000 });
    const second = await checkRateLimit({ key, limit: 2, windowMs: 60_000 });
    const third = await checkRateLimit({ key, limit: 2, windowMs: 60_000 });
    assert.equal(first.allowed, true);
    assert.equal(first.remaining, 1);
    assert.equal(second.allowed, true);
    assert.equal(third.allowed, false);
    assert.equal(third.remaining, 0);
    assert.deepEqual(await rateLimitStoreHealth(), { status: "ok" });
  } finally {
    setRateLimitRedisTransportForTest();
    if (previousRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previousRedisUrl;
  }
});

test("production rate limiting fails closed when Redis is not configured", async () => {
  const previousRedisUrl = process.env.REDIS_URL;
  const previousNodeEnv = process.env.NODE_ENV;
  delete process.env.REDIS_URL;
  process.env.NODE_ENV = "production";
  try {
    await assert.rejects(
      enforceRateLimit({ key: "production-check", limit: 1, windowMs: 1000 }),
      (error: any) => error?.statusCode === 503 && error?.code === "SERVICE_UNAVAILABLE",
    );
    assert.deepEqual(await rateLimitStoreHealth(), { status: "error", message: "REDIS_URL is required in production" });
  } finally {
    if (previousRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previousRedisUrl;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("Redis RESP parser handles arrays and fragmented bulk responses", () => {
  assert.deepEqual(parseRedisValue(Buffer.from("*2\r\n:2\r\n:60000\r\n"), 0), {
    value: [2, 60000],
    offset: 16,
  });
  assert.equal(parseRedisValue(Buffer.from("$5\r\nabc"), 0), null);
  assert.deepEqual(parseRedisValue(Buffer.from("$5\r\nabcde\r\n"), 0), { value: "abcde", offset: 11 });
});

test("timingSafeEqualStr and hashToken behave deterministically", () => {
  assert.equal(timingSafeEqualStr("secret123", "secret123"), true);
  assert.equal(timingSafeEqualStr("secret123", "secret124"), false);
  assert.equal(timingSafeEqualStr("short", "longer"), false);
  assert.equal(hashToken("abc", "pep1"), hashToken("abc", "pep1"));
  assert.notEqual(hashToken("abc", "pep1"), hashToken("abc", "pep2"));
});

test("site API keys can be encrypted for server-side use without storing plaintext", () => {
  const secret = "cms_test_read_key_1234567890";
  const pepper = "test-api-key-pepper-with-at-least-32-characters";
  const encrypted = encryptApiKey(secret, pepper);
  assert.notEqual(encrypted, secret);
  assert.equal(decryptApiKey(encrypted, pepper), secret);
  assert.throws(() => decryptApiKey(encrypted, "a-different-pepper-value-that-is-long-enough"));
  assert.throws(() => encryptApiKey(secret, "too-short"));
});

test("browser refresh cookies are HttpOnly, scoped, and secure for cross-site production use", () => {
  const cookie = serializeRefreshCookie("refresh.token+value", 60_000, { sameSite: "none", production: true });
  assert.match(cookie, new RegExp(`^${REFRESH_COOKIE_NAME}=`));
  assert.match(cookie, /Path=\/api\/admin\/auth/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=none/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /Max-Age=60/);
  assert.equal(readCookieHeader(`theme=dark; ${cookie}`, REFRESH_COOKIE_NAME), "refresh.token+value");
  assert.match(clearRefreshCookie({ sameSite: "lax", production: true }), /Max-Age=0/);
  assert.throws(() => serializeRefreshCookie("token", 1000, { sameSite: "invalid" }));
  assert.equal(isAllowedCookieOrigin("https://admin.example.com", ["https://admin.example.com"]), true);
  assert.equal(isAllowedCookieOrigin("https://attacker.example", ["https://admin.example.com"]), false);
  assert.equal(isAllowedCookieOrigin(undefined, []), true);
});
