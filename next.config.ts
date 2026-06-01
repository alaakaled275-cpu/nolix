import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone", // disabled in dev - causes Turbopack RSC manifest bug
  experimental: {
    // Disable Turbopack to fix "Could not find module in React Client Manifest" bug
  },

  // ── CDN Cache Headers for client scripts ──────────────────────────────────
  // These complement vercel.json headers and work in both local dev and production.
  // master.js: 5 min fresh → served from Vercel Edge Network globally (<50ms)
  async headers() {
    return [
      // Client-side AI scripts — 5 min cache, served from CDN edge
      {
        source: "/master.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=3600, stale-if-error=86400" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Vary", value: "Accept-Encoding" },
          { key: "Cache-Tag", value: "nolix-client-scripts" },
        ],
      },
      {
        source: "/engine.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=3600" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      {
        source: "/popup.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=3600" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      {
        source: "/nolix.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=3600" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      {
        source: "/zeno.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=3600" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      // Static CSS/JS assets — 1h cache (change less often)
      {
        source: "/iso-app.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/(iso-style|iso-animations|landing)\\.css",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
      // API routes — NEVER cache
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control",   value: "no-store, no-cache, must-revalidate" },
          { key: "X-Nolix-Version", value: "3.0" },
          // Security headers for all API responses
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options",        value: "DENY" },
          { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },

  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          destination: "/nolix-home.html",
        },
      ],
    };
  },
};

export default nextConfig;
