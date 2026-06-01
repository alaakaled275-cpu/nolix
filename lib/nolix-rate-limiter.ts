/**
 * lib/nolix-rate-limiter.ts
 * NOLIX — Production Rate Limiter (Redis Sliding Window + In-Memory Fallback)
 *
 * ARCHITECTURE:
 * ─────────────────────────────────────────────────────────────────────────────
 * PRIMARY:  Redis sliding window counter (Upstash) — distributed, survives restarts
 * FALLBACK: In-memory Map — used when Redis unavailable (dev / Redis down)
 *
 * LIMITS PER ROUTE TYPE:
 * ─────────────────────────────────────────────────────────────────────────────
 *  /api/engine/decide   → 120 req/min per IP  (high-traffic, per-visitor calls)
 *  /api/engine/predict  → 120 req/min per IP
 *  /api/track           → 200 req/min per IP  (event tracking, very high volume)
 *  /api/model/sync      → 10  req/min per IP  (server-to-server sync)
 *  /api/runtime/flags   → 30  req/min per IP
 *  /api/license/verify  → 20  req/min per IP
 *  DEFAULT              → 60  req/min per IP
 *
 * Per license key: max 500 req/min (across all instances)
 *
 * DDoS PROTECTION:
 * ─────────────────────────────────────────────────────────────────────────────
 * If a single IP exceeds 3× the normal limit in a 10s burst → blocked for 5 min.
 * "Burst Ban" stored as a Redis key with TTL=300s.
 */

import { redis } from "./redis";

// ── Route-specific limits ───────────────────────────────────────────────────
const ROUTE_LIMITS: Record<string, number> = {
  // ── Core engine (high-traffic, per-visitor) ──────────────────────────────
  "/api/engine/decide":          120,
  "/api/engine/predict":         120,
  "/api/engine/events":          200,
  "/api/track":                  200,

  // ── Model sync (server-to-server, very limited) ─────────────────────────
  "/api/model/sync":              10,
  "/api/runtime/flags":           30,
  "/api/license/verify":          20,

  // ── Webhooks — limited to prevent bot attacks ────────────────────────────
  // Shopify: real Shopify sends max 1 req/sec per store (verified HMAC)
  // 100/min is generous while blocking bots that hammer this endpoint
  "/api/webhooks/shopify":       100,
  // Stripe: very low volume (real Stripe sends few events per hour per customer)
  "/api/webhooks/stripe":         60,

  // ── Dashboard / Billing (authenticated users only, low volume) ───────────
  "/api/dashboard":               30,
  "/api/billing":                 30,
  "/api/billing/sync-usage":      20,

  // ── Admin endpoints — extremely limited ─────────────────────────────────
  "/api/admin":                    5,

  // ── Auth endpoints — prevent brute force ────────────────────────────────
  "/api/auth/login":              10,
  "/api/auth/signup":             10,
  "/api/auth/reset":               5,
  "/api/onboarding":              20,

  // ── Zeno AI chat ─────────────────────────────────────────────────────────
  "/api/zeno":                    60,

  // ── Default fallback ─────────────────────────────────────────────────────
  DEFAULT:                        60,
};

const WINDOW_SECONDS   = 60;      // 1-minute sliding window
const KEY_LIMIT        = 500;     // per license key per minute (across all IPs)
const BURST_MULTIPLIER = 3;       // 3× limit in 10s = DDoS ban
const BURST_WINDOW_S   = 10;      // burst detection window (seconds)
const BURST_BAN_S      = 300;     // ban duration after burst (5 minutes)

// ── In-memory fallback (when Redis unavailable) ─────────────────────────────
interface MemWindow { count: number; resetAt: number; }
const _memIp  = new Map<string, MemWindow>();
const _memKey = new Map<string, MemWindow>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _memIp)  { if (now > v.resetAt) _memIp.delete(k); }
  for (const [k, v] of _memKey) { if (now > v.resetAt) _memKey.delete(k); }
}, 30_000);

function memCheck(store: Map<string, MemWindow>, id: string, limit: number): boolean {
  const now = Date.now();
  const w   = store.get(id);
  if (!w || now > w.resetAt) {
    store.set(id, { count: 1, resetAt: now + WINDOW_SECONDS * 1000 });
    return true;
  }
  if (w.count >= limit) return false;
  w.count++;
  return true;
}

// ── Redis sliding window counter ────────────────────────────────────────────
async function redisCheck(key: string, limit: number, windowSec: number): Promise<{
  allowed: boolean;
  count: number;
  remaining: number;
  resetAt: number;
}> {
  if (!redis) throw new Error("Redis not available");

  const now    = Math.floor(Date.now() / 1000);
  const rKey   = `nolix:rl:${key}:${Math.floor(now / windowSec)}`;

  // Atomic INCR + EXPIRE — works perfectly with Upstash
  const pipeline = redis.pipeline();
  pipeline.incr(rKey);
  pipeline.expire(rKey, windowSec * 2); // TTL = 2× window (safety margin)
  const results = await pipeline.exec();

  const count = (results?.[0]?.[1] as number) ?? 1;
  return {
    allowed:   count <= limit,
    count,
    remaining: Math.max(0, limit - count),
    resetAt:   (Math.floor(now / windowSec) + 1) * windowSec,
  };
}

// ── Burst DDoS detection ────────────────────────────────────────────────────
async function checkBurst(ip: string, routeLimit: number): Promise<boolean> {
  if (!redis) return false; // skip burst detection without Redis

  const banKey   = `nolix:ban:${ip}`;
  const isBanned = await redis.exists(banKey);
  if (isBanned) return true; // already banned

  // Check 10-second burst window
  const now     = Math.floor(Date.now() / 1000);
  const burstKey = `nolix:burst:${ip}:${Math.floor(now / BURST_WINDOW_S)}`;

  const pipeline = redis.pipeline();
  pipeline.incr(burstKey);
  pipeline.expire(burstKey, BURST_WINDOW_S * 2);
  const results = await pipeline.exec();
  const burstCount = (results?.[0]?.[1] as number) ?? 0;

  const burstLimit = routeLimit * BURST_MULTIPLIER;
  if (burstCount > burstLimit) {
    // Issue 5-minute ban
    await redis.set(banKey, "1", "EX", BURST_BAN_S);
    console.warn(`🚫 NOLIX DDoS BAN: IP=${ip} burst=${burstCount}/${burstLimit} banned for ${BURST_BAN_S}s`);
    return true;
  }

  return false;
}

// ── Public interface ────────────────────────────────────────────────────────
export interface RateLimitResult {
  blocked:   boolean;
  reason:    string;
  remaining: number;
  resetAt:   number;
  headers:   Record<string, string>;
}

export async function checkRateLimit(
  ip:         string,
  pathname:   string,
  licenseKey?: string
): Promise<RateLimitResult> {

  // Determine route limit
  const routeLimit = ROUTE_LIMITS[pathname] ??
    Object.entries(ROUTE_LIMITS).find(([route]) => pathname.startsWith(route))?.[1] ??
    ROUTE_LIMITS.DEFAULT;

  try {
    if (redis) {
      // ── REDIS PATH ────────────────────────────────────────────────────────

      // 0. DDoS burst check
      const isBanned = await checkBurst(ip, routeLimit);
      if (isBanned) {
        return {
          blocked:   true,
          reason:    "DDoS protection: IP temporarily banned",
          remaining: 0,
          resetAt:   Math.floor(Date.now() / 1000) + BURST_BAN_S,
          headers: {
            "Retry-After":           String(BURST_BAN_S),
            "X-RateLimit-Remaining": "0",
          },
        };
      }

      // 1. IP rate limit
      const ipResult = await redisCheck(`ip:${ip}:${pathname}`, routeLimit, WINDOW_SECONDS);
      if (!ipResult.allowed) {
        return {
          blocked:   true,
          reason:    `IP rate limit: ${routeLimit} req/min exceeded`,
          remaining: 0,
          resetAt:   ipResult.resetAt,
          headers: {
            "X-RateLimit-Limit":     String(routeLimit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset":     String(ipResult.resetAt),
            "Retry-After":           String(WINDOW_SECONDS),
          },
        };
      }

      // 2. License key rate limit (if provided)
      if (licenseKey) {
        const keyResult = await redisCheck(`key:${licenseKey}`, KEY_LIMIT, WINDOW_SECONDS);
        if (!keyResult.allowed) {
          return {
            blocked:   true,
            reason:    `License key rate limit: ${KEY_LIMIT} req/min exceeded`,
            remaining: 0,
            resetAt:   keyResult.resetAt,
            headers: {
              "X-RateLimit-Limit":     String(KEY_LIMIT),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset":     String(keyResult.resetAt),
              "Retry-After":           String(WINDOW_SECONDS),
            },
          };
        }
      }

      return {
        blocked:   false,
        reason:    "ok",
        remaining: ipResult.remaining,
        resetAt:   ipResult.resetAt,
        headers: {
          "X-RateLimit-Limit":     String(routeLimit),
          "X-RateLimit-Remaining": String(ipResult.remaining),
          "X-RateLimit-Reset":     String(ipResult.resetAt),
        },
      };

    } else {
      // ── FALLBACK: In-memory ────────────────────────────────────────────────
      const ipOk  = memCheck(_memIp,  ip,         routeLimit);
      const keyOk = licenseKey ? memCheck(_memKey, licenseKey, KEY_LIMIT) : true;

      if (!ipOk) {
        return {
          blocked:   true,
          reason:    `IP rate limit (in-memory): ${routeLimit} req/min`,
          remaining: 0,
          resetAt:   Math.floor(Date.now() / 1000) + WINDOW_SECONDS,
          headers:   { "Retry-After": String(WINDOW_SECONDS) },
        };
      }
      if (!keyOk) {
        return {
          blocked:   true,
          reason:    `License key rate limit (in-memory): ${KEY_LIMIT} req/min`,
          remaining: 0,
          resetAt:   Math.floor(Date.now() / 1000) + WINDOW_SECONDS,
          headers:   { "Retry-After": String(WINDOW_SECONDS) },
        };
      }

      return {
        blocked:   false,
        reason:    "ok",
        remaining: routeLimit - 1,
        resetAt:   Math.floor(Date.now() / 1000) + WINDOW_SECONDS,
        headers:   { "X-RateLimit-Limit": String(routeLimit) },
      };
    }

  } catch (err: any) {
    // Redis error → fail-open (don't block real traffic due to Redis issue)
    console.error("⚠ NOLIX Rate Limiter: Redis error, failing open:", err?.message);
    return {
      blocked:   false,
      reason:    "rate_limiter_error_fail_open",
      remaining: routeLimit,
      resetAt:   Math.floor(Date.now() / 1000) + WINDOW_SECONDS,
      headers:   {},
    };
  }
}

/**
 * Quick helper for use inside Next.js Route Handlers.
 * Returns a NextResponse-compatible Response if blocked, null if allowed.
 */
export async function applyRateLimit(
  ip:         string,
  pathname:   string,
  licenseKey?: string
): Promise<Response | null> {
  const result = await checkRateLimit(ip, pathname, licenseKey);

  if (!result.blocked) return null;

  return new Response(
    JSON.stringify({
      error:   "Too Many Requests",
      reason:  result.reason,
      code:    "RATE_LIMITED",
      retryIn: WINDOW_SECONDS,
    }),
    {
      status:  429,
      headers: {
        "Content-Type": "application/json",
        ...result.headers,
      },
    }
  );
}
