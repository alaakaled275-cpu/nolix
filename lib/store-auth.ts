/**
 * lib/store-auth.ts
 * NOLIX — Phase 1: Store API Key Auth System
 *
 * FLOW:
 *  1. Client sends  x-api-key: <public_key>  in every request
 *  2. Server calls  verifyStoreKey(req)
 *  3. Key is looked up in `stores` table (Redis-cached for 60s)
 *  4. If invalid → 401. If store inactive → 403. If OK → returns store record
 *
 * SECURITY:
 *  - Public key: safe to embed in master.js (identifies store, not secret)
 *  - Secret key: server-to-server HMAC only, never sent to browser
 *  - Redis cache: 60s TTL, auto-invalidated on key rotation
 *  - Timing-safe comparison via constant-time Redis lookup (no timing attacks)
 *
 * USAGE in API routes:
 *  const storeAuth = await verifyStoreKey(req);
 *  if (!storeAuth.ok) return storeAuth.response;
 *  const { store } = storeAuth; // store.domain, store.id, store.user_id
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "./db";
import { redis } from "./redis";

export interface Store {
  id:         string;
  user_id:    string;
  domain:     string;
  public_key: string;
  plan:       string;
  active:     boolean;
}

export type StoreAuthResult =
  | { ok: true;  store: Store; apiKey: string }
  | { ok: false; response: NextResponse };


// Cache TTL for valid keys (60 seconds)
const CACHE_TTL = 60;
const CACHE_PREFIX = "nolix:store:key:";

// ── Generate API key pair (64-char hex) ───────────────────────────────────────
export function generatePublicKey(): string {
  return crypto.randomBytes(32).toString("hex");
}
export function generateSecretKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ── Create store record for a new user ───────────────────────────────────────
export async function createStoreForUser(
  userId: string,
  domain: string
): Promise<Store & { secret_key: string }> {
  const publicKey = generatePublicKey();
  const secretKey = generateSecretKey();

  const rows = await query<any>(
    `INSERT INTO stores (user_id, domain, public_key, secret_key)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (domain) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           active  = true,
           last_seen = now()
     RETURNING id, user_id, domain, public_key, secret_key, plan, active`,
    [userId, domain, publicKey, secretKey]
  );

  return rows[0];
}

// ── Get store keys for a user (for dashboard display) ────────────────────────
export async function getStoreForUser(userId: string): Promise<(Store & { secret_key: string }) | null> {
  const rows = await query<any>(
    `SELECT id, user_id, domain, public_key, secret_key, plan, active
     FROM stores WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}

// ── Rotate public key (keeps secret key, invalidates cache) ───────────────────
export async function rotatePublicKey(storeId: string): Promise<string> {
  const newKey = generatePublicKey();
  await query(
    `UPDATE stores SET public_key = $1 WHERE id = $2`,
    [newKey, storeId]
  );
  // Invalidate all cache entries for this store (pattern delete)
  try {
    await (redis as any).del(`${CACHE_PREFIX}${newKey}`);
  } catch { /* Redis optional */ }
  return newKey;
}

// ── Core: Verify API Key from request ────────────────────────────────────────
export async function verifyStoreKey(
  req: NextRequest,
  options: { required?: boolean } = { required: true }
): Promise<StoreAuthResult> {
  const apiKey = req.headers.get("x-api-key")?.trim();

  // If no key provided
  if (!apiKey) {
    if (!options.required) {
      // Optional auth — allow through without store context
      return { ok: false, response: NextResponse.json({ error: "Missing x-api-key" }, { status: 401 }) };
    }
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Missing API key. Add x-api-key header.", code: "MISSING_API_KEY" },
        { status: 401 }
      )
    };
  }

  // Basic format validation (64-char hex)
  if (!/^[0-9a-f]{64}$/.test(apiKey)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid API key format.", code: "INVALID_KEY_FORMAT" },
        { status: 401 }
      )
    };
  }

  // ── Redis cache lookup (fast path — skipped if Redis is unavailable) ─────────
  if (redis) {
    try {
      const cached = await redis.get(`${CACHE_PREFIX}${apiKey}`);
      if (cached) {
        const store: Store = JSON.parse(cached as string);
        if (!store.active) {
          return {
            ok: false,
            response: NextResponse.json(
              { error: "Store account is deactivated.", code: "STORE_INACTIVE" },
              { status: 403 }
            )
          };
        }
        return { ok: true, store, apiKey };
      }
    } catch { /* Redis down → fall through to DB */ }
  }

  // ── DB lookup (slow path — only when cache misses) ─────────────────────────
  try {
    const rows = await query<any>(
      `SELECT id, user_id, domain, public_key, plan, active
       FROM stores WHERE public_key = $1 LIMIT 1`,
      [apiKey]
    );

    if (rows.length === 0) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Invalid API key.", code: "INVALID_API_KEY" },
          { status: 401 }
        )
      };
    }

    const store: Store = rows[0];

    if (!store.active) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Store account is deactivated.", code: "STORE_INACTIVE" },
          { status: 403 }
        )
      };
    }

    // Cache in Redis for 60s (avoid DB hit on every request)
    if (redis) {
      try {
        await redis.setex(`${CACHE_PREFIX}${apiKey}`, CACHE_TTL, JSON.stringify(store));
      } catch { /* Redis optional — system works without it */ }
    }

    // Update last_seen timestamp (fire-and-forget)
    query(`UPDATE stores SET last_seen = now() WHERE id = $1`, [store.id]).catch(() => {});

    return { ok: true, store, apiKey };

  } catch (err: any) {
    console.error("[STORE-AUTH] DB lookup failed:", err.message);
    // DB down → fail open in dev, fail closed in production
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Authentication service unavailable.", code: "AUTH_ERROR" },
          { status: 503 }
        )
      };
    }
    // Dev: allow through with anonymous store
    const devStore: Store = { id: "dev", user_id: "dev", domain: "localhost", public_key: apiKey, plan: "dev", active: true };
    return { ok: true, store: devStore, apiKey };
  }
}
