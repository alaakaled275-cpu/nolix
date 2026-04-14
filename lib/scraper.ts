/**
 * lib/scraper.ts
 * Real Server-side Puppeteer JS rendering, Schema.org parsing, and Signal Extraction.
 * Bypasses JS Blindness and accurately identifies prices & currencies.
 */

import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

export interface ExtractedData<T> {
  value: T;
  confidence: number;
  source: string;
}

export interface StoreSignals {
  url: string;
  status: number;
  reachable: boolean;
  businessModel: ExtractedData<string>; // "E-Commerce", "SaaS", "Content", "Unknown"
  title: ExtractedData<string | null>;
  metaDescription: ExtractedData<string | null>;
  h1: ExtractedData<string | null>;
  prices: ExtractedData<string[]>;     // Keep string[] for compatibility with Results UI
  currency: ExtractedData<string | null>;
  lowestPrice: ExtractedData<number | null>;
  highestPrice: ExtractedData<number | null>;
  trustKeywords: ExtractedData<string[]>;
  navItems: ExtractedData<string[]>;
  platform: ExtractedData<string | null>;
  nicheHints: ExtractedData<string[]>;
  wordCount: number;
}

export function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!u.startsWith("http://") && !u.startsWith("https://")) {
    u = "https://" + u;
  }
  return u;
}

// ── HTML Signal Extractor (Schema + DOM) ───────────────────────────────────────
export function parseStoreSignals(html: string, url: string): StoreSignals {
  const $ = cheerio.load(html);
  
  const base: StoreSignals = {
    url,
    status: 200,
    reachable: true,
    businessModel: { value: "Unknown", confidence: 0, source: "fallback" },
    title: { value: null, confidence: 0, source: "fallback" },
    metaDescription: { value: null, confidence: 0, source: "fallback" },
    h1: { value: null, confidence: 0, source: "fallback" },
    prices: { value: [], confidence: 0, source: "fallback" },
    currency: { value: null, confidence: 0, source: "fallback" },
    lowestPrice: { value: null, confidence: 0, source: "fallback" },
    highestPrice: { value: null, confidence: 0, source: "fallback" },
    trustKeywords: { value: [], confidence: 0, source: "fallback" },
    navItems: { value: [], confidence: 0, source: "fallback" },
    platform: { value: null, confidence: 0, source: "fallback" },
    nicheHints: { value: [], confidence: 0, source: "fallback" },
    wordCount: 0,
  };

  if (!html) {
    base.reachable = false;
    base.status = 0;
    return base;
  }

  // 1. Meta / Head Parsing
  const title = $("title").text().trim().slice(0, 200);
  if (title) base.title = { value: title, confidence: 100, source: "DOM <title>" };

  const metaDesc = $("meta[name='description'], meta[property='og:description']").attr("content");
  if (metaDesc) base.metaDescription = { value: metaDesc.slice(0, 400), confidence: 95, source: "meta description" };

  const h1 = $("h1").first().text().trim().slice(0, 200);
  if (h1) base.h1 = { value: h1, confidence: 90, source: "DOM <h1>" };

  // 2. Schema.org (JSON-LD) Parsing - The Holy Grail
  let schemaPrices: number[] = [];
  let schemaCurrency: string | null = null;
  let schemaType: string | null = null;

  $("script[type='application/ld+json']").each((_, el) => {
    try {
      const content = $(el).html();
      if (!content) return;
      const data = JSON.parse(content);
      
      // Handle arrays of schemas
      const schemas = Array.isArray(data) ? data : [data];
      
      for (const s of schemas) {
        if (!s) continue;
        const type = s["@type"];
        if (type) schemaType = type;
        
        // Extract Price & Currency from Product/Offer
        if (type === "Product" || s.offers) {
          const offers = Array.isArray(s.offers) ? s.offers : [s.offers];
          for (const offer of offers) {
            if (offer && offer.price) {
              const p = parseFloat(offer.price);
              if (!isNaN(p)) schemaPrices.push(p);
            }
            if (offer && offer.priceCurrency && !schemaCurrency) {
              schemaCurrency = offer.priceCurrency;
            }
          }
        }
      }
    } catch (e) {
      // Quiet fail on invalid JSON
    }
  });

  if (schemaPrices.length > 0) {
    const rawPrices = schemaPrices.map(p => p.toString());
    base.prices = { value: rawPrices, confidence: 100, source: "application/ld+json" };
    base.lowestPrice = { value: Math.min(...schemaPrices), confidence: 100, source: "application/ld+json" };
    base.highestPrice = { value: Math.max(...schemaPrices), confidence: 100, source: "application/ld+json" };
    if (schemaCurrency) {
      base.currency = { value: schemaCurrency, confidence: 100, source: "application/ld+json" };
    }
  } else {
    // DOM Price Fallback (Better regex supporting global currencies)
    const priceText = $("body").text();
    // Match $, €, £, AED, SAR, and numbers
    const priceRegex = /(?:[\$€£]|AED|SAR|Rs\.?)\s*(\d{1,5}(?:[.,]\d{2})?)/gi;
    const matches = [...priceText.matchAll(priceRegex)];
    const fallbackPrices: number[] = [];
    const rawStrs: string[] = [];
    
    for (const m of matches.slice(0, 20)) {
      rawStrs.push(m[0].trim());
      const num = parseFloat(m[1].replace(/,/g, ""));
      if (!isNaN(num) && num > 0) fallbackPrices.push(num);
    }

    if (fallbackPrices.length > 0) {
      base.prices = { value: [...new Set(rawStrs)].slice(0, 10), confidence: 60, source: "DOM Text Regex" };
      base.lowestPrice = { value: Math.min(...fallbackPrices), confidence: 60, source: "DOM Text Regex" };
      base.highestPrice = { value: Math.max(...fallbackPrices), confidence: 60, source: "DOM Text Regex" };
    }
    
    // Currency Fallback
    if (priceText.includes("$") || priceText.includes("USD")) base.currency = { value: "USD", confidence: 50, source: "DOM Inference" };
    else if (priceText.includes("€") || priceText.includes("EUR")) base.currency = { value: "EUR", confidence: 50, source: "DOM Inference" };
    else if (priceText.includes("SAR") || priceText.includes("ريال")) base.currency = { value: "SAR", confidence: 50, source: "DOM Inference" };
  }

  // 3. Platform Detection
  const lowerHtml = html.toLowerCase();
  let platform = null;
  if (lowerHtml.includes('cdn.shopify.com') || lowerHtml.includes('shopify.theme')) platform = "Shopify";
  else if (lowerHtml.includes('wp-content') || lowerHtml.includes('woocommerce')) platform = "WooCommerce";
  else if (lowerHtml.includes('_next/static')) platform = "Next.js Custom";
  else if (lowerHtml.includes('webflow')) platform = "Webflow";
  if (platform) base.platform = { value: platform, confidence: 90, source: "HTML Signatures" };

  // 4. Business Model Detection
  let model = "Unknown";
  let modelConf = 0;
  let modelSource = "";

  if (schemaType === "Product" || base.prices.value.length > 2 || platform === "Shopify" || platform === "WooCommerce") {
    model = "E-Commerce";
    modelConf = schemaType === "Product" ? 95 : 80;
    modelSource = schemaType === "Product" ? "Schema.org" : "Pricing/Platform Inference";
  } else if (lowerHtml.includes("pricing") && (lowerHtml.includes("monthly") || lowerHtml.includes("annual") || lowerHtml.includes("start free trial"))) {
    model = "SaaS";
    modelConf = 85;
    modelSource = "DOM Terminology";
  } else if (schemaType === "Article" || schemaType === "NewsArticle" || lowerHtml.includes("read more")) {
    model = "Content/Media";
    modelConf = 75;
    modelSource = schemaType ? "Schema.org" : "DOM Terminology";
  }
  
  if (model !== "Unknown") {
    base.businessModel = { value: model, confidence: modelConf, source: modelSource };
  }

  // 5. Trust Keywords
  const TRUST_TERMS = ["money-back", "guarantee", "refund", "free shipping", "reviews", "verified", "secure checkout", "ssl"];
  const bodyText = $("body").text().toLowerCase();
  const trustMatches = TRUST_TERMS.filter(t => bodyText.includes(t));
  base.trustKeywords = { value: trustMatches, confidence: 100, source: "DOM Text" };

  // 6. Word Count (Cleaned)
  base.wordCount = bodyText.replace(/\s+/g, " ").trim().split(" ").length;

  return base;
}

// ── Headless Fetch Engine ──────────────────────────────────────────────────────
export async function scrapeStore(rawUrl: string): Promise<StoreSignals> {
  const url = normalizeUrl(rawUrl);
  let browser = null;
  let html = "";
  
  try {
    // Launch headless Chromium via Puppeteer.
    // Handles React/Next.js/Shopify Headless stores by waiting for network idle.
    browser = await puppeteer.launch({ 
      headless: true, // Opt in to new Headless
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
      ] 
    });
    
    const page = await browser.newPage();
    
    // Scraper Stealth: Spoff headers to look like a real consumer browser
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    ];
    await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Upgrade-Insecure-Requests': '1'
    });
    
    // Set fake viewport
    await page.setViewport({ width: 1366 + Math.floor(Math.random() * 100), height: 768 + Math.floor(Math.random() * 100) });

    // Evaluate overriding webdriver properties
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    
    // Navigate and wait for DOM, JS excution, and primary network requests
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
    
    // Scroll down to trigger lazy loaded images or JSON-LD
    await page.evaluate(() => window.scrollTo(0, 1000));
    // Wait slightly
    await new Promise(r => setTimeout(r, 500));
    
    html = await page.content();
    
    const signals = parseStoreSignals(html, url);
    signals.status = response?.status() ?? 200;
    signals.reachable = signals.status < 400;
    
    return signals;
  } catch (err: any) {
    console.error("[Scraper] Puppeteer block/timeout:", err.message);
    
    // Fallback: If Puppeteer fails (bot protection), try standard fetch
    try {
      const fb = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000)
      });
      html = await fb.text();
      const signals = parseStoreSignals(html, url);
      signals.status = fb.status;
      signals.reachable = fb.ok;
      return signals;
    } catch {
      return parseStoreSignals("", url); // Returns unreachable structured base
    }
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
