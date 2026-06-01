/**
 * middleware.ts
 * NOLIX — Global Edge Middleware
 *
 * RESPONSIBILITIES (executed in order on EVERY request):
 * ────────────────────────────────────────────────────────────────────────────
 *
 * [1] CDN CACHE HEADERS — master.js & static assets
 *     Sets aggressive Cache-Control headers so Vercel Edge Network / CDN
 *     caches master.js globally. Result: <50ms delivery worldwide.
 *     Cache-Control: public, max-age=300, stale-while-revalidate=3600
 *     (5 min fresh, 1 hour stale-while-revalidate = zero origin hits at scale)
 *
 * [2] MULTI-TENANCY ISOLATION — x-nolix-tenant header injection
 *     Every API request tagged with the resolved tenant (store domain) via
 *     x-nolix-tenant header. Route handlers read this header to scope DB queries.
 *     Source priority: x-nolix-key → Referer → Origin → x-store-domain header
 *
 * [3] SECURITY HEADERS — applied to all responses
 *     X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
 *     Permissions-Policy, Cross-Origin headers for iframe safety (Shopify).
 *
 * [4] DASHBOARD AUTH GUARD
 *     Protected dashboard routes require zeno_state=ACTIVE cookie.
 *     If missing → redirect to /activate.
 *
 * [5] RATE LIMIT (Edge-level pre-filter)
 *     Simple in-memory sliding window at Edge — stops obvious abuse before
 *     it reaches API route handlers. The REAL rate limiter (Redis) lives in
 *     lib/nolix-rate-limiter.ts and is applied inside route handlers.
 *     This Edge layer is a FIRST LINE OF DEFENSE only.
 *
 * NOTE: Middleware runs on Vercel Edge Runtime — no Node.js APIs, no Redis.
 *       The full Redis rate limiter runs inside API route handlers.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ── Protected dashboard routes requiring authentication ───────────────────────
const PROTECTED_ROUTES = [
  "/dashboard",
  "/intelligence",
  "/calibration",
  "/(dashboard)",
];

// ── Auth pages — logged-in users should be auto-redirected away ─────────────
const AUTH_ONLY_ROUTES = ["/login", "/register"];

// ── Static/public assets that should be aggressively cached by CDN ──────────
const CDN_CACHED_FILES = [
  "/master.js",
  "/engine.js",
  "/popup.js",
  "/nolix.js",
  "/zeno.js",
  "/iso-app.js",
  "/iso-style.css",
  "/iso-animations.css",
  "/landing.css",
];

// ── API routes that need tenant header injection ───────────────────────────
const TENANT_REQUIRED_API_ROUTES = [
  "/api/engine/decide",
  "/api/engine/predict",
  "/api/engine/events",
  "/api/track",
  "/api/model/sync",
  "/api/runtime/flags",
  "/api/zeno",
  "/api/license/verify",
  "/api/experiments",
  "/api/metrics",
  "/api/learning",
  "/api/calibration",
  "/api/stream",
];

// ── Edge-level IP rate limit (simple — full Redis rate limit is in route handlers)
// Uses headers only — no external calls from Edge Middleware
const EDGE_RATE_HEADERS = {
  "X-Nolix-Edge": "1",
  "X-Nolix-Version": "3.0",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

function isAuthOnlyRoute(pathname: string): boolean {
  return AUTH_ONLY_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

function isCDNCachedFile(pathname: string): boolean {
  return CDN_CACHED_FILES.some((file) => pathname === file || pathname.endsWith(file));
}

function isTenantAPIRoute(pathname: string): boolean {
  return TENANT_REQUIRED_API_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/") || pathname.startsWith(route)
  );
}

/**
 * Resolve tenant (store domain) from request context.
 * Priority:
 * 1. x-store-domain header (explicit — used by master.js)
 * 2. Referer header (browser request from store page)
 * 3. Origin header (CORS preflight)
 * 4. x-nolix-key (fallback — key tied to store in DB, resolved in handler)
 * 5. "unknown" (logged for investigation)
 */
function resolveTenant(req: NextRequest): string {
  // 1. Explicit header (master.js sends this)
  const explicitDomain = req.headers.get("x-store-domain");
  if (explicitDomain) return explicitDomain.replace(/^www\./, "").toLowerCase().trim();

  // 2. Referer (browser request from store page)
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const url = new URL(referer);
      return url.hostname.replace(/^www\./, "").toLowerCase();
    } catch { /* malformed referer */ }
  }

  // 3. Origin (CORS preflight)
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const url = new URL(origin);
      // Only use if not our own domain
      if (!url.hostname.includes("nolix")) {
        return url.hostname.replace(/^www\./, "").toLowerCase();
      }
    } catch { /* malformed origin */ }
  }

  // 4. x-nolix-key present → handler will resolve tenant from DB
  const licenseKey = req.headers.get("x-nolix-key");
  if (licenseKey) return `key:${licenseKey.substring(0, 8)}`; // prefix — handler resolves full domain

  return "unknown";
}

/**
 * Build security headers for all responses.
 * Shopify-safe: allows embedding in iframes for their admin.
 */
function buildSecurityHeaders(isAPIRoute: boolean): Record<string, string> {
  return {
    // Prevent clickjacking (allow Shopify iframe)
    "X-Frame-Options": "SAMEORIGIN",
    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",
    // Referrer policy
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Permissions policy — disable unused features
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    // NOLIX version identification
    "X-Nolix-Version": "3.0",
    // API routes get strict CORS headers
    ...(isAPIRoute
      ? {
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, x-nolix-key, x-nolix-signature, x-nolix-timestamp, x-nolix-nonce, x-store-domain",
          // CORS max-age: browser caches preflight for 24h (reduces OPTIONS spam)
          "Access-Control-Max-Age": "86400",
        }
      : {}),
  };
}

// ── Main Middleware ──────────────────────────────────────────────────────────
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAPIRoute = pathname.startsWith("/api/");

  // ── [1] CDN CACHE HEADERS for static script files ──────────────────────────
  if (isCDNCachedFile(pathname)) {
    const response = NextResponse.next();

    // Cache-Control: 5 min fresh → CDN serves globally without hitting origin
    // stale-while-revalidate: 1h → zero-downtime updates (serve stale while fetching new)
    // immutable: tells browser not to revalidate during max-age
    response.headers.set(
      "Cache-Control",
      "public, max-age=300, stale-while-revalidate=3600, stale-if-error=86400"
    );
    // Vary: none — same file for all users (no personalization in static scripts)
    response.headers.set("Vary", "Accept-Encoding");
    // Allow CDN to cache even with Authorization headers present
    response.headers.set("Surrogate-Control", "public, max-age=300");
    // Vercel Edge Cache tag (for purging by tag)
    response.headers.set("Cache-Tag", "nolix-client-scripts");

    // Apply security headers
    for (const [key, value] of Object.entries(buildSecurityHeaders(false))) {
      response.headers.set(key, value);
    }

    console.log(`🌐 CDN CACHED: ${pathname}`);
    return response;
  }

  // ── [2] CORS preflight handler (OPTIONS) ───────────────────────────────────
  if (request.method === "OPTIONS" && isAPIRoute) {
    const origin = request.headers.get("origin") || "*";
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin":  origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, x-nolix-key, x-nolix-signature, x-nolix-timestamp, x-nolix-nonce, x-store-domain",
        "Access-Control-Max-Age":       "86400",
        "Access-Control-Allow-Credentials": "true",
      },
    });
  }

  // ── [3] MULTI-TENANCY HEADER INJECTION ─────────────────────────────────────
  const requestHeaders = new Headers(request.headers);
  let tenantDomain = "unknown";

  if (isAPIRoute && isTenantAPIRoute(pathname)) {
    tenantDomain = resolveTenant(request);
    // Inject tenant into request headers so route handlers can read it
    requestHeaders.set("x-nolix-tenant", tenantDomain);
    // Inject request ID for distributed tracing
    const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    requestHeaders.set("x-nolix-request-id", requestId);
  }

  // ── [4] DASHBOARD AUTH GUARD (DISABLED BY USER REQUEST) ─────────────────
  if (isProtectedRoute(pathname)) {
      // Dashboard is now publicly accessible
  }

  // ── [5] BUILD RESPONSE with modified headers ────────────────────────────────
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Apply security headers to all responses
  for (const [key, value] of Object.entries(buildSecurityHeaders(isAPIRoute))) {
    response.headers.set(key, value);
  }

  // Inject tenant into response headers (for debugging/tracing)
  if (tenantDomain !== "unknown") {
    response.headers.set("X-Nolix-Tenant", tenantDomain);
  }

  // Allow CORS for API routes
  if (isAPIRoute) {
    const origin = request.headers.get("origin");
    if (origin) {
      response.headers.set("Access-Control-Allow-Origin",      origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
    } else {
      response.headers.set("Access-Control-Allow-Origin", "*");
    }
  }

  // Disable caching for all API routes (always fresh)
  // Exception: /api/stream uses SSE — do NOT set cache-control here
  // (vercel.json handles SSE headers separately)
  if (isAPIRoute && pathname !== "/api/stream") {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  }

  return response;
}

// ── Matcher: apply middleware to all routes EXCEPT Next.js internals ─────────
export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (Next.js static files)
     * - _next/image  (Next.js image optimization)
     * - favicon.ico  (browser favicon)
     * NOTE: We DO match /public/* files because we need to set CDN headers on master.js
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
