/**
 * lib/redis.ts
 * NOLIX — Unified Redis Client (Upstash / ioredis)
 *
 * Uses REDIS_URL from environment (Upstash TLS-enabled URL).
 * Singleton pattern: one connection reused across the entire process.
 * Falls back gracefully to null if REDIS_URL not set (dev without Redis).
 */

import Redis from "ioredis";

// ── Global singleton (survives HMR in dev) ─────────────────────────────────
const globalAny = global as any;

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn("⚠ NOLIX Redis: REDIS_URL not set. Rate limiting will use in-memory fallback.");
    return null;
  }

  // ── ROBUST CONNECTION WITH AUTO-RECONNECT ──
  const client = new Redis(url, {
    // Upstash requires TLS
    tls: url.startsWith("rediss://") ? {} : undefined,
    // Retry strategy: 5 attempts with exponential backoff
    maxRetriesPerRequest: 5,
    retryStrategy: (times: number) => {
      if (times > 5) {
        console.warn("⚠ NOLIX Redis: Max retries exceeded. Using fallback.");
        return null; // stop retrying - use fallback
      }
      return Math.min(times * 300, 3000); // max 3s delay
    },
    // Never block the process if Redis is down
    enableOfflineQueue: false,
    // Lazy connect - don't block startup
    lazyConnect: true,
    // Connect timeout
    connectTimeout: 5000,
    // Keep alive
    keepAlive: 30000,
  });

  // ── CONNECTION EVENT HANDLERS ──
  client.on("connect", () => {
    console.log("✅ NOLIX Redis: Connected to Upstash.");
  });

  client.on("ready", () => {
    console.log("✅ NOLIX Redis: Ready to serve requests.");
  });

  client.on("error", (err) => {
    // Don't spam logs for common auth errors
    if (err.message?.includes("WRONGPASS") || err.message?.includes("AUTH")) {
      console.error("❌ NOLIX Redis Auth Error: Invalid credentials. Check REDIS_URL in .env.local");
    } else if (err.message?.includes("ECONNREFUSED")) {
      console.warn("⚠ NOLIX Redis: Connection refused. Using in-memory fallback.");
    } else {
      console.error("❌ NOLIX Redis Error:", err.message);
    }
  });

  client.on("reconnecting", () => {
    console.log("🔄 NOLIX Redis: Reconnecting...");
  });

  client.on("close", () => {
    console.warn("⚠ NOLIX Redis: Connection closed. Using fallback.");
  });

  // ── ATTEMPT CONNECTION (non-blocking) ──
  client.connect().catch((err) => {
    if (err.message?.includes("WRONGPASS") || err.message?.includes("AUTH")) {
      console.error("❌ NOLIX Redis: Auth failed. Check REDIS_URL in .env.local");
    } else {
      console.warn("⚠ NOLIX Redis: Initial connection failed, will retry. Error:", err.message);
    }
  });

  return client;
}

// ── CHECK REDIS HEALTH (for API routes) ──
export async function checkRedisHealth(): Promise<{
  connected: boolean;
  latency?: number;
  error?: string;
}> {
  if (!redis) {
    return { connected: false, error: "REDIS_URL not configured" };
  }

  try {
    const start = Date.now();
    await redis.ping();
    return {
      connected: true,
      latency: Date.now() - start
    };
  } catch (err: any) {
    return {
      connected: false,
      error: err.message
    };
  }
}

// ── IN-MEMORY FALLBACK (when Redis unavailable) ──
const _memoryStore = new Map<string, { value: string; expireAt: number }>();

export async function memorySet(key: string, value: string, ttlSeconds: number = 3600): Promise<void> {
  _memoryStore.set(key, {
    value,
    expireAt: Date.now() + (ttlSeconds * 1000)
  });
}

export async function memoryGet(key: string): Promise<string | null> {
  const entry = _memoryStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expireAt) {
    _memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

export async function memoryIncr(key: string): Promise<number> {
  const entry = _memoryStore.get(key);
  if (!entry) {
    _memoryStore.set(key, { value: "1", expireAt: Date.now() + 60000 });
    return 1;
  }
  const newVal = parseInt(entry.value) + 1;
  _memoryStore.set(key, { value: String(newVal), expireAt: entry.expireAt });
  return newVal;
}

// Singleton
if (!globalAny.__nolixRedis) {
  globalAny.__nolixRedis = createRedisClient();
}

export const redis: Redis | null = globalAny.__nolixRedis;
export default redis;
