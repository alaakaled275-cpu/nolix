/**
 * NOLIX — Security Hardening (STEP 15 PART 14)
 * lib/nolix-security.ts
 *
 * 1. Signed requests — HMAC-SHA256 request validation
 * 2. Model access control — API key tiers (read/write/admin)
 * 3. Rate limits — per-client, per-endpoint
 * 4. Request fingerprinting — detect replay attacks
 * 5. Input sanitization — prevent injection
 */

import { createHmac, createHash, timingSafeEqual } from "crypto";
import { query } from "./db";

// ── HMAC Request Signing ──────────────────────────────────────────────────────
const SECRET = process.env.NOLIX_API_SECRET || "fallback_change_me";

export function signPayload(payload: Record<string, any>, timestamp?: number): string {
  const ts  = timestamp || Math.floor(Date.now() / 1000);
  const raw = `${ts}.${JSON.stringify(payload)}`;
  return createHmac("sha256", SECRET).update(raw).digest("hex");
}

export function verifySignature(
  signature:   string,
  payload:     Record<string, any>,
  timestamp:   number,
  maxAgeMs:    number = 120_000
): { valid: boolean; reason?: string } {
  const now = Date.now();
  const ts  = timestamp * 1000;

  if (Math.abs(now - ts) > maxAgeMs) {
    return { valid: false, reason: `TIMESTAMP_EXPIRED: delta=${Math.abs(now-ts)}ms > ${maxAgeMs}ms` };
  }

  const expected = signPayload(payload, timestamp);

  try {
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return { valid: false, reason: "SIGNATURE_LENGTH_MISMATCH" };
    const ok = timingSafeEqual(a, b);
    return ok ? { valid: true } : { valid: false, reason: "SIGNATURE_INVALID" };
  } catch {
    return { valid: false, reason: "SIGNATURE_PARSE_ERROR" };
  }
}

// ── Access Control Tiers ──────────────────────────────────────────────────────
export type AccessTier = "read" | "write" | "admin" | "none";

export function getAccessTier(apiKey: string | null | undefined): AccessTier {
  if (!apiKey) return "none";

  const syncSecret = process.env.NOLIX_SYNC_SECRET;
  const apiSecret  = process.env.NOLIX_API_SECRET;
  const cronSecret = process.env.NOLIX_CRON_SECRET;

  if (apiKey === syncSecret) return "admin";
  if (apiKey === cronSecret) return "write";
  if (apiKey === apiSecret)  return "read";

  return "none";
}

export function requireTier(
  actual:   AccessTier,
  required: AccessTier
): boolean {
  const HIERARCHY: Record<AccessTier, number> = { admin: 3, write: 2, read: 1, none: 0 };
  return HIERARCHY[actual] >= HIERARCHY[required];
}

// ── Rate Limiter (in-memory sliding window) ───────────────────────────────────
interface RateBucket { count: number; windowStart: number }
const _rateLimits = new Map<string, RateBucket>();

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  "predict":       { max: 100,  windowMs: 60_000 },  // 100/min per client
  "train":         { max: 10,   windowMs: 60_000 },  // 10/min
  "admin":         { max: 30,   windowMs: 60_000 },  // 30/min
  "vector_search": { max: 50,   windowMs: 60_000 },  // 50/min
  "default":       { max: 60,   windowMs: 60_000 }   // fallback
};

export function checkRateLimit(
  clientId: string,
  endpoint: keyof typeof RATE_LIMITS | string
): { allowed: boolean; remaining: number; reset_at: number } {
  const limit  = RATE_LIMITS[endpoint] || RATE_LIMITS["default"];
  const key    = `${clientId}:${endpoint}`;
  const now    = Date.now();

  const bucket = _rateLimits.get(key) || { count: 0, windowStart: now };

  if (now - bucket.windowStart > limit.windowMs) {
    // New window
    bucket.count       = 1;
    bucket.windowStart = now;
    _rateLimits.set(key, bucket);
    return { allowed: true, remaining: limit.max - 1, reset_at: now + limit.windowMs };
  }

  bucket.count++;
  _rateLimits.set(key, bucket);

  const remaining = limit.max - bucket.count;
  const reset_at  = bucket.windowStart + limit.windowMs;

  return { allowed: remaining >= 0, remaining: Math.max(0, remaining), reset_at };
}

// ── Replay Attack Prevention ──────────────────────────────────────────────────
const _usedNonces = new Map<string, number>();

export function checkNonce(nonce: string): boolean {
  if (!nonce || _usedNonces.has(nonce)) return false;
  _usedNonces.set(nonce, Date.now());

  // Cleanup nonces older than 10 minutes
  if (_usedNonces.size > 10_000) {
    const cutoff = Date.now() - 10 * 60_000;
    for (const [k, ts] of _usedNonces) {
      if (ts < cutoff) _usedNonces.delete(k);
    }
  }

  return true;
}

// ── Input Sanitization ────────────────────────────────────────────────────────
export function sanitizeString(input: any, maxLen = 256): string {
  if (typeof input !== "string") return "";
  return input.replace(/[<>\&"'`]/g, "").trim().substring(0, maxLen);
}

export function sanitizeNumber(input: any, min = 0, max = 1): number {
  const n = Number(input);
  if (!isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function sanitizeFeatures(features: any): number[] | null {
  if (!Array.isArray(features)) return null;
  if (features.length !== 8) return null;
  const sanitized = features.map(f => sanitizeNumber(f, -10, 10));
  if (sanitized.some(f => !isFinite(f))) return null;
  return sanitized;
}

// ── Audit log ────────────────────────────────────────────────────────────────
export async function auditLog(
  action:   string,
  clientId: string,
  tier:     AccessTier,
  details:  Record<string, any> = {}
): Promise<void> {
  try {
    await query(
      `INSERT INTO nolix_audit_log (action, client_id, access_tier, details_json, logged_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [action, clientId.substring(0, 64), tier, JSON.stringify(details)]
    );
  } catch { /* non-blocking */ }
}

// ── Security middleware helper ─────────────────────────────────────────────────
export function getClientId(req: { headers: { get(k: string): string | null } }): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || req.headers.get("x-nolix-client-id")
      || "anonymous";
}
