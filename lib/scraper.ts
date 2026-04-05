/**
 * lib/scraper.ts
 * Server-side URL validation, fetching, and HTML signal extraction
 * for Zeno Store Analysis. All functions run server-side only.
 */

export interface StoreSignals {
  /** Normalized store URL */
  url: string;
  /** HTTP status from fetch (0 = unreachable) */
  status: number;
  /** Whether we got real page data */
  reachable: boolean;
  /** Page <title> content */
  title: string | null;
  /** <meta name="description"> content */
  metaDescription: string | null;
  /** First <h1> text */
  h1: string | null;
  /** All detected price strings (e.g. "$29.99") */
  prices: string[];
  /** Lowest detected price as number, or null */
  lowestPrice: number | null;
  /** Highest detected price as number, or null */
  highestPrice: number | null;
  /** Trust-signal keywords found on page */
  trustKeywords: string[];
  /** Top-level nav link texts */
  navItems: string[];
  /** Detected platform signals (shopify, woocommerce, etc.) */
  platform: string | null;
  /** Raw category/niche inference from page text */
  nicheHints: string[];
  /** Page word count (rough content depth signal) */
  wordCount: number;
}

export function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!u.startsWith("http://") && !u.startsWith("https://")) {
    u = "https://" + u;
  }
  return u;
}

// ── Page Fetcher ───────────────────────────────────────────────────────────────
async function tryFetch(url: string, timeoutMs: number): Promise<{ html: string; status: number; ok: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "DNT": "1",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    const html = await res.text();
    return { html, status: res.status, ok: res.ok };
  } catch {
    clearTimeout(timer);
    return { html: "", status: 0, ok: false };
  }
}

export async function fetchStorePage(
  url: string,
  timeoutMs = 12000
): Promise<{ html: string; status: number; ok: boolean }> {
  // Try the exact URL first
  const first = await tryFetch(url, timeoutMs);
  if (first.ok && first.html.length > 500) return first;

  // If that fails, try just the homepage (root domain)
  try {
    const parsed = new URL(url);
    const homepage = `${parsed.protocol}//${parsed.hostname}`;
    if (homepage !== url) {
      const fallback = await tryFetch(homepage, timeoutMs);
      if (fallback.ok && fallback.html.length > 500) return fallback;
    }
  } catch { /* ignore */ }

  return first; // Return whatever we got (even if empty)
}


// ── HTML Signal Extractor ──────────────────────────────────────────────────────
export function parseStoreSignals(html: string, url: string): StoreSignals {
  const base: StoreSignals = {
    url,
    status: 200,
    reachable: true,
    title: null,
    metaDescription: null,
    h1: null,
    prices: [],
    lowestPrice: null,
    highestPrice: null,
    trustKeywords: [],
    navItems: [],
    platform: null,
    nicheHints: [],
    wordCount: 0,
  };

  if (!html) return { ...base, reachable: true, status: 0 };

  // ── Title ────────────────────────────────────────────────────────────────────
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) base.title = titleMatch[1].trim().slice(0, 200);

  // ── Meta Description ─────────────────────────────────────────────────────────
  const metaMatch = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
  ) || html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i
  );
  if (metaMatch) base.metaDescription = metaMatch[1].trim().slice(0, 400);

  // ── H1 ───────────────────────────────────────────────────────────────────────
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) base.h1 = h1Match[1].replace(/<[^>]+>/g, "").trim().slice(0, 200);

  // ── Prices ───────────────────────────────────────────────────────────────────
  const priceRegex = /\$\s*(\d{1,4}(?:[.,]\d{2})?)/g;
  const priceMatches = [...html.matchAll(priceRegex)];
  const prices: string[] = [];
  const priceNums: number[] = [];
  for (const m of priceMatches.slice(0, 30)) {
    const raw = m[0].trim();
    const num = parseFloat(m[1].replace(",", ""));
    if (!prices.includes(raw) && num > 0 && num < 10000) {
      prices.push(raw);
      priceNums.push(num);
    }
  }
  base.prices = prices.slice(0, 10);
  if (priceNums.length > 0) {
    base.lowestPrice = Math.min(...priceNums);
    base.highestPrice = Math.max(...priceNums);
  }

  // ── Trust Keywords ───────────────────────────────────────────────────────────
  const TRUST_TERMS = [
    "money-back", "guarantee", "refund", "free shipping", "free returns",
    "reviews", "stars", "trustpilot", "verified", "secure checkout",
    "ssl", "satisfaction", "no risk", "warranty", "privacy",
  ];
  const lowerHtml = html.toLowerCase();
  base.trustKeywords = TRUST_TERMS.filter((t) => lowerHtml.includes(t));

  // ── Nav Items ────────────────────────────────────────────────────────────────
  const navMatch = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/i);
  if (navMatch) {
    const linkMatches = [...navMatch[1].matchAll(/<a[^>]*>([^<]+)<\/a>/gi)];
    base.navItems = linkMatches
      .map((m) => m[1].trim())
      .filter((t) => t.length > 0 && t.length < 50)
      .slice(0, 10);
  }

  // ── Platform Detection ───────────────────────────────────────────────────────
  if (html.includes("cdn.shopify.com") || html.includes("Shopify.theme")) base.platform = "Shopify";
  else if (html.includes("wp-content") || html.includes("woocommerce")) base.platform = "WooCommerce";
  else if (html.includes("bigcommerce")) base.platform = "BigCommerce";
  else if (html.includes("squarespace")) base.platform = "Squarespace";
  else if (html.includes("wixsite") || html.includes("wix.com")) base.platform = "Wix";
  else if (html.includes("webflow")) base.platform = "Webflow";

  // ── Niche Hints ──────────────────────────────────────────────────────────────
  const NICHE_TERMS: Record<string, string[]> = {
    fashion: ["clothing", "apparel", "dress", "shirt", "fashion", "outfit", "wear"],
    beauty: ["skincare", "makeup", "beauty", "serum", "moisturizer", "cosmetics", "glow"],
    fitness: ["workout", "gym", "protein", "supplement", "fitness", "exercise", "training"],
    home: ["home decor", "furniture", "kitchen", "living room", "bedroom", "interior"],
    pets: ["dog", "cat", "pet", "paw", "puppy", "kitten", "animal"],
    tech: ["gadget", "electronics", "tech", "wireless", "smart", "device", "charger"],
    wellness: ["wellness", "health", "organic", "natural", "cbd", "sleep", "stress"],
    kids: ["baby", "kids", "children", "toy", "nursery", "toddler"],
  };
  const hints: string[] = [];
  for (const [niche, terms] of Object.entries(NICHE_TERMS)) {
    if (terms.some((t) => lowerHtml.includes(t))) hints.push(niche);
  }
  base.nicheHints = hints.slice(0, 3);

  // ── Word Count ───────────────────────────────────────────────────────────────
  const textContent = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  base.wordCount = textContent.split(" ").filter((w) => w.length > 2).length;

  return base;
}

// ── Full Scrape Pipeline ───────────────────────────────────────────────────────
export async function scrapeStore(rawUrl: string): Promise<StoreSignals> {
  const url = normalizeUrl(rawUrl);
  const { html, status, ok } = await fetchStorePage(url);

  if (!ok || !html) {
    return {
      url,
      status,
      reachable: true, // Force true so Zeno analyzes the URL anyway
      title: null,
      metaDescription: null,
      h1: null,
      prices: [],
      lowestPrice: null,
      highestPrice: null,
      trustKeywords: [],
      navItems: [],
      platform: null,
      nicheHints: [],
      wordCount: 0,
    };
  }

  const signals = parseStoreSignals(html, url);
  signals.status = status;
  return signals;
}
