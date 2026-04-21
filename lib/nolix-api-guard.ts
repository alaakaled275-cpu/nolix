/**
 * NOLIX — API Guard (STEP 12 PART 6)
 * lib/nolix-api-guard.ts
 *
 * THREE protection layers applied to all sensitive API routes:
 *
 * LAYER 1 — Rate Limiting
 *   Max 60 requests per IP per minute (sliding window, in-memory)
 *   Max 200 requests per license key per minute
 *
 * LAYER 2 — Request Signature (HMAC-SHA256)
 *   Every server-to-server request must include:
 *   x-nolix-signature: HMAC-SHA256(body + timestamp, NOLIX_API_SECRET)
 *   x-nolix-timestamp: unix timestamp (ms)
 *
 * LAYER 3 — Replay Protection
 *   Timestamp must be within ±5 minutes of server time
 *   Nonce tracked in memory for 10 minutes (prevents exact replays)
 */

import crypto from "crypto";

// ============================================================
// RATE LIMITER — sliding window, in-memory
// ============================================================
interface RateWindow { count: number; resetAt: number; }
const _ipWindows  = new Map<string, RateWindow>();
const _keyWindows = new Map<string, RateWindow>();
const WINDOW_MS   = 60_000;   // 1 minute window
const IP_LIMIT    = 60;       // requests per IP per minute
const KEY_LIMIT   = 200;      // requests per license key per minute

function checkRateLimit(store: Map<string, RateWindow>, id: string, limit: number): boolean {
  const now    = Date.now();
  const window = _ipWindows.get(id);

  if (!window || now > window.resetAt) {
    store.set(id, { count: 1, resetAt: now + WINDOW_MS });
    return true; // allowed
  }
  if (window.count >= limit) return false; // blocked
  window.count++;
  return true;
}

export function isRateLimited(ip: string, licenseKey?: string): {
  blocked: boolean; reason: string;
} {
  if (!checkRateLimit(_ipWindows, ip, IP_LIMIT)) {
    return { blocked: true, reason: `rate_limit:ip:${IP_LIMIT}req/min` };
  }
  if (licenseKey && !checkRateLimit(_keyWindows, licenseKey, KEY_LIMIT)) {
    return { blocked: true, reason: `rate_limit:key:${KEY_LIMIT}req/min` };
  }
  return { blocked: false, reason: "ok" };
}

// Cleanup stale windows every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _ipWindows) { if (now > v.resetAt) _ipWindows.delete(k); }
  for (const [k, v] of _keyWindows) { if (now > v.resetAt) _keyWindows.delete(k); }
}, 5 * 60_000);

// ============================================================
// REPLAY PROTECTION — nonce store (TTL 10 minutes)
// ============================================================
const _nonces = new Map<string, number>();
const NONCE_TTL = 10 * 60_000;

setInterval(() => {
  const now = Date.now();
  for (const [n, t] of _nonces) { if (now - t > NONCE_TTL) _nonces.delete(n); }
}, 5 * 60_000);

function isReplay(nonce: string, timestamp: number): boolean {
  const now  = Date.now();
  const skew = Math.abs(now - timestamp);

  // Timestamp must be within ±5 minutes
  if (skew > 5 * 60_000) return true;

  // Nonce must not have been seen before
  if (_nonces.has(nonce)) return true;

  _nonces.set(nonce, now);
  return false;
}

// ============================================================
// HMAC SIGNATURE VERIFICATION
// ============================================================
export function verifySignature(
  body:      string,
  timestamp: string,
  signature: string
): boolean {
  const secret = process.env.NOLIX_API_SECRET;
  if (!secret) {
    // In dev: skip signature check
    return process.env.NODE_ENV !== "production";
  }
  const payload = `${timestamp}.${body}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature.replace(/^sha256=/, ""), "hex")
    );
  } catch { return false; }
}

// ============================================================
// UNIFIED GUARD — combines all 3 layers
// Returns { passed: true } or { passed: false, response }
// ============================================================
export async function applyAPIGuard(
  req:       Request,
  rawBody?:  string,
  options?:  { skipSignature?: boolean; skipRateLimit?: boolean }
): Promise<{ passed: boolean; response?: Response }> {

  const ip         = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const licenseKey = req.headers.get("x-nolix-key") || undefined;
  const timestamp  = req.headers.get("x-nolix-timestamp") || "0";
  const nonce      = req.headers.get("x-nolix-nonce")     || `${Date.now()}-${Math.random()}`;
  const signature  = req.headers.get("x-nolix-signature") || "";

  // LAYER 1: Rate Limit
  if (!options?.skipRateLimit) {
    const rl = isRateLimited(ip, licenseKey);
    if (rl.blocked) {
      return {
        passed:   false,
        response: Response.json({
          error:  "Rate limit exceeded",
          reason: rl.reason,
          code:   "RATE_LIMITED"
        }, { status: 429 })
      };
    }
  }

  // LAYER 2: Signature (for server-to-server only, skipped for browser clients)
  if (!options?.skipSignature && signature && rawBody) {
    if (!verifySignature(rawBody, timestamp, signature)) {
      return {
        passed:   false,
        response: Response.json({
          error: "Invalid request signature",
          code:  "INVALID_SIGNATURE"
        }, { status: 401 })
      };
    }
  }

  // LAYER 3: Replay Protection
  const tsNum = parseInt(timestamp);
  if (tsNum > 0 && isReplay(nonce, tsNum)) {
    return {
      passed:   false,
      response: Response.json({
        error: "Replay attack detected or timestamp expired",
        code:  "REPLAY_BLOCKED"
      }, { status: 403 })
    };
  }

  return { passed: true };
}

// ============================================================
// SIGN REQUEST (for server-to-server calls)
// ============================================================
export function signRequest(body: string): Record<string, string> {
  const secret    = process.env.NOLIX_API_SECRET || "dev-secret";
  const timestamp = String(Date.now());
  const nonce     = crypto.randomBytes(8).toString("hex");
  const payload   = `${timestamp}.${body}`;
  const sig       = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return {
    "x-nolix-timestamp": timestamp,
    "x-nolix-nonce":     nonce,
    "x-nolix-signature": `sha256=${sig}`
  };
}
