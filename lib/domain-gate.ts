/**
 * lib/domain-gate.ts — v2 REALITY FINGERPRINT SYSTEM
 * ─────────────────────────────────────────────────────────────────
 * ZENO: Reality Extraction + Domain Classification Layer
 *
 * ABSOLUTE LAW:
 *   Any analysis without a RealityFingerprint is INVALID.
 *   Any number without verified signals is HALLUCINATION.
 *
 * HOW IT WORKS:
 *   Every signal found in the scraped page adds probabilistic weight
 *   to one or more domain categories. No binary rules. No guessing.
 *   The classification emerges from accumulated evidence.
 *
 * THRESHOLDS FOR ANALYSIS ELIGIBILITY:
 *   ecommerce_probability >= 0.70 AND confidence >= 70
 *   → ECOMMERCE_CONFIRMED → full analysis allowed
 *   Otherwise:
 *   → INSUFFICIENT_REALITY_SIGNALS → analysis BLOCKED
 *
 * SIGNAL WEIGHT TIERS:
 *   Tier 1 (Structural): JSON-LD schema, platform signatures         weight: 0.40
 *   Tier 2 (Functional): Cart/checkout DOM elements, API endpoints   weight: 0.30
 *   Tier 3 (Behavioral): Intent signals, CTA patterns, pricing text  weight: 0.20
 *   Tier 4 (Contextual): Nav items, niche keywords, trust terms      weight: 0.10
 * ─────────────────────────────────────────────────────────────────
 */

import type { StoreSignals } from "./scraper";

// ── Output Types ─────────────────────────────────────────────────────────────

export type StoreTypePriority =
  | "shopify_high"    // Shopify: highest revenue leakage potential, best instrumented
  | "woocommerce_high"// WooCommerce: similarly high value
  | "dtc_medium"      // DTC/Instagram: social commerce, brand-driven
  | "tiktok_low"      // TikTok Shop: unstable conversion patterns, early phase
  | "custom_medium"   // Headless/Custom ecommerce
  | null;             // Not ecommerce or unknown

export type DomainType =
  | "ecommerce"
  | "content"
  | "saas"
  | "marketplace"
  | "unknown";

export type DataQuality    = "VERIFIED" | "PARTIAL" | "INFERRED";
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export type BlockReason =
  | "SITE_UNREACHABLE"
  | "LOW_ECOMMERCE_PROBABILITY"       // < 0.70
  | "LOW_CONFIDENCE"                  // confidence < 70
  | "CLASSIFIED_AS_CONTENT"
  | "CLASSIFIED_AS_UNKNOWN"
  | "PLACEHOLDER_DATA_DETECTED"
  | "DEMO_STAGING_URL";

export interface RealityEvidence {
  structured_data: string[];  // JSON-LD, Schema.org signals
  dom_signals:     string[];  // Button text, cart elements, product cards
  network_signals: string[];  // URL patterns, platform CDN signatures
  intent_signals:  string[];  // CTA text, urgency language, purchase flow
}

export interface RealityFingerprint {
  // ── PROBABILITY SCORES (0–1, sum does NOT need to equal 1) ──────────────
  ecommerce_probability:   number;
  content_probability:     number;
  marketplace_probability: number;
  saas_probability:        number;

  // ── EVIDENCE CHAINS (what drove each score) ──────────────────────────────
  evidence: RealityEvidence;

  // ── CONFIDENCE (0–100: how much total evidence was found) ─────────────────
  confidence: number;

  // ── CLASSIFICATION DECISION ───────────────────────────────────────────────
  classification:          DomainType;
  eligible_for_analysis:   boolean;   // ecommerce_prob >= 0.7 AND confidence >= 70

  // ── BLOCK REASON (if not eligible) ───────────────────────────────────────
  block_reason:            BlockReason | null;
  block_explanation:       string | null;
  action_required:         string | null;

  // ── STORE PRIORITY (ecommerce only) ──────────────────────────────────────
  store_priority:          StoreTypePriority;

  // ── ANTI-HALLUCINATION METADATA ───────────────────────────────────────────
  data_quality:            DataQuality;
  confidence_level:        ConfidenceLevel;

  // ── PLATFORM ─────────────────────────────────────────────────────────────
  detected_platform:       string | null;

  // ── PRICE REALITY (has real prices been validated?) ──────────────────────
  price_reality: {
    has_prices:              boolean;
    price_source:            "json_ld" | "dom_regex" | "none";
    price_count:             number;
    price_range:             { min: number; max: number } | null;
    is_placeholder_suspect:  boolean;
  };
}

// ── Signal Weights (Tier 1–4) ─────────────────────────────────────────────────
const W = {
  TIER1: 0.40,  // Structural (JSON-LD, platform)
  TIER2: 0.30,  // Functional (cart/checkout DOM)
  TIER3: 0.20,  // Behavioral (intent, CTA)
  TIER4: 0.10,  // Contextual (nav, keywords)
};

// ── Common template prices (suspect if majority match) ────────────────────────
const TEMPLATE_PRICES = [9.99,19.99,29.99,49.99,99,99.99,149,149.99,199,199.99,299,299.99,399,499,999];
const DEMO_URL_PATTERNS = ["demo","template","preview","staging","localhost","test.","mock","sample","dummy","placeholder",".local"];

// ── Main Entry Point ──────────────────────────────────────────────────────────
export function buildRealityFingerprint(signals: StoreSignals): RealityFingerprint {
  const evidence: RealityEvidence = {
    structured_data: [],
    dom_signals:     [],
    network_signals: [],
    intent_signals:  [],
  };

  // Rolling probability accumulators (will be clamped to 0–1 at the end)
  let pEcommerce   = 0;
  let pContent     = 0;
  let pSaas        = 0;
  let pMarketplace = 0;

  const url     = signals.url.toLowerCase();
  const html    = ""; // We work through signals object, not raw html
  const pageText = [
    signals.title.value ?? "",
    signals.h1.value ?? "",
    signals.metaDescription.value ?? "",
    signals.navItems.value.join(" "),
    signals.trustKeywords.value.join(" "),
  ].join(" ").toLowerCase();
  const platform = signals.platform.value;

  // ── GATE -1: Unreachable ─────────────────────────────────────────────────
  if (!signals.reachable || signals.status >= 400) {
    return block("SITE_UNREACHABLE",
      `Site returned HTTP ${signals.status}. Cannot extract reality from an unreachable domain.`,
      "Ensure the store is live, publicly accessible, and not behind a login wall.",
      evidence
    );
  }

  // ── GATE 0: Demo/Staging URL ─────────────────────────────────────────────
  const demoPattern = DEMO_URL_PATTERNS.find(p => url.includes(p));
  if (demoPattern) {
    evidence.network_signals.push(`⛔ URL contains suspicious pattern: "${demoPattern}"`);
    return block("DEMO_STAGING_URL",
      `URL contains a demo/staging/template pattern ("${demoPattern}"). This is not a live production store.`,
      "Connect a live production store URL (e.g. yourstore.com, not demo.yourstore.com).",
      evidence
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 1 — STRUCTURAL SIGNALS (JSON-LD + Platform) — WEIGHT: 0.40
  // ═══════════════════════════════════════════════════════════════════════════

  // JSON-LD Product schema (highest confidence signal available)
  if (signals.prices.source === "application/ld+json") {
    pEcommerce += W.TIER1 * 1.0;
    evidence.structured_data.push("✅ Schema.org Product/Offer JSON-LD detected (highest confidence ecommerce signal)");
  }

  // Platform signatures
  if (platform === "Shopify") {
    pEcommerce += W.TIER1 * 0.9;
    evidence.network_signals.push("✅ Shopify platform detected (cdn.shopify.com signature)");
  } else if (platform === "WooCommerce") {
    pEcommerce += W.TIER1 * 0.85;
    evidence.network_signals.push("✅ WooCommerce platform detected (wp-content/woocommerce signature)");
  } else if (platform === "Next.js Custom") {
    // Could be anything — no platform bonus
    evidence.network_signals.push("ℹ️ Next.js custom platform (no platform-based ecommerce certainty)");
  } else if (platform === "Webflow") {
    // Webflow alone doesn't imply ecommerce
    evidence.network_signals.push("ℹ️ Webflow detected (could be ecommerce or landing page)");
  }

  // Schema type signals in page text (inferred from nav/meta)
  if (pageText.includes("schema.org/product") || pageText.includes("\"@type\":\"product\"")) {
    pEcommerce += W.TIER1 * 0.6;
    evidence.structured_data.push("✅ Product schema reference in page metadata");
  }
  if (pageText.includes("schema.org/article") || pageText.includes("\"@type\":\"article\"") || pageText.includes("\"@type\":\"newsarticle\"")) {
    pContent += W.TIER1 * 0.7;
    evidence.structured_data.push("✅ Article/NewsArticle schema detected — strong content signal");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 2 — FUNCTIONAL SIGNALS (Cart/Checkout DOM) — WEIGHT: 0.30
  // ═══════════════════════════════════════════════════════════════════════════

  // Cart presence
  if (pageText.includes("add to cart") || pageText.includes("add to bag")) {
    pEcommerce += W.TIER2 * 1.0;
    evidence.dom_signals.push("✅ 'Add to Cart/Bag' button text detected");
  }
  if (pageText.includes("checkout") || pageText.includes("proceed to checkout")) {
    pEcommerce += W.TIER2 * 0.8;
    evidence.dom_signals.push("✅ Checkout flow text detected");
  }
  if (pageText.includes("in stock") || pageText.includes("out of stock") || pageText.includes("only") && pageText.includes("left")) {
    pEcommerce += W.TIER2 * 0.7;
    evidence.dom_signals.push("✅ Inventory/stock status text detected");
  }
  if (pageText.includes("cart") && (pageText.includes("item") || pageText.includes("product"))) {
    pEcommerce += W.TIER2 * 0.5;
    evidence.dom_signals.push("✅ Cart reference with product context");
  }

  // URL path signals (product/shop pages)
  if (url.includes("/products/") || url.includes("/product/")) {
    pEcommerce += W.TIER2 * 0.9;
    evidence.network_signals.push("✅ URL pattern /products/ — product page URL");
  }
  if (url.includes("/shop") || url.includes("/store")) {
    pEcommerce += W.TIER2 * 0.6;
    evidence.network_signals.push("✅ URL pattern /shop or /store");
  }
  if (url.includes("/cart") || url.includes("/checkout")) {
    pEcommerce += W.TIER2 * 0.8;
    evidence.network_signals.push("✅ Cart or checkout URL detected");
  }

  // SaaS functional signals
  if ((pageText.includes("monthly") || pageText.includes("annually") || pageText.includes("/mo") || pageText.includes("/month"))
    && (pageText.includes("plan") || pageText.includes("pricing") || pageText.includes("subscribe"))) {
    pSaas += W.TIER2 * 1.0;
    evidence.dom_signals.push("✅ Subscription/SaaS pricing language detected (plans, monthly/annual)");
    // SaaS is NOT ecommerce for our purposes — slight ecommerce reduction
    pEcommerce -= W.TIER2 * 0.2;
  }

  // Marketplace signals
  if (pageText.includes("seller") && pageText.includes("listing")) {
    pMarketplace += W.TIER2 * 0.8;
    evidence.dom_signals.push("✅ Marketplace seller/listing pattern");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 3 — BEHAVIORAL SIGNALS (Intent + CTA) — WEIGHT: 0.20
  // ═══════════════════════════════════════════════════════════════════════════

  if (pageText.includes("buy now") || pageText.includes("shop now") || pageText.includes("order now")) {
    pEcommerce += W.TIER3 * 0.8;
    evidence.intent_signals.push("✅ Direct purchase CTA detected ('buy now' / 'shop now' / 'order now')");
  }
  if (pageText.includes("free shipping") || pageText.includes("ships in") || pageText.includes("delivery")) {
    pEcommerce += W.TIER3 * 0.6;
    evidence.intent_signals.push("✅ Shipping/delivery intent signal");
  }
  if (pageText.includes("limited time") || pageText.includes("while supplies last") || pageText.includes("limited stock")) {
    pEcommerce += W.TIER3 * 0.5;
    evidence.intent_signals.push("✅ Urgency/scarcity language (conversion-focused ecommerce pattern)");
  }
  if (pageText.includes("wishlist") || pageText.includes("save for later") || pageText.includes("compare")) {
    pEcommerce += W.TIER3 * 0.5;
    evidence.intent_signals.push("✅ Product comparison/wishlist behavior signals");
  }
  if (pageText.includes("size") && pageText.includes("color") && pageText.includes("quantity")) {
    pEcommerce += W.TIER3 * 0.7;
    evidence.intent_signals.push("✅ Product variant signals (size/color/quantity)");
  }

  // Content behavioral signals
  if (pageText.includes("read more") || pageText.includes("latest posts") || pageText.includes("published on") || pageText.includes("written by")) {
    pContent += W.TIER3 * 0.7;
    evidence.intent_signals.push("✅ Content consumption pattern ('read more', 'published on')");
  }
  if (pageText.includes("subscribe to newsletter") || pageText.includes("follow us on")) {
    pContent += W.TIER3 * 0.4;
    evidence.intent_signals.push("ℹ️ Newsletter/social follow — lean toward content site");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 4 — CONTEXTUAL SIGNALS (Nav/Keywords) — WEIGHT: 0.10
  // ═══════════════════════════════════════════════════════════════════════════

  if (pageText.includes("return policy") || pageText.includes("refund") || pageText.includes("money-back")) {
    pEcommerce += W.TIER4 * 0.8;
    evidence.dom_signals.push("ℹ️ Return/refund policy — ecommerce trust signal");
  }
  if (pageText.includes("reviews") || pageText.includes("rating") || pageText.includes("stars")) {
    pEcommerce += W.TIER4 * 0.5;
    evidence.dom_signals.push("ℹ️ Product reviews/ratings (compatible with ecommerce)");
  }
  if ((signals.navItems.value).some(n => /shop|store|cart|collection|categories/i.test(n))) {
    pEcommerce += W.TIER4 * 0.7;
    evidence.dom_signals.push(`ℹ️ Ecommerce nav items: ${signals.navItems.value.filter(n => /shop|store|cart|collection/i.test(n)).join(", ")}`);
  }

  // TikTok shop signal
  if (pageText.includes("tiktok shop") || url.includes("tiktok.com/shop") || pageText.includes("tiktok for business")) {
    evidence.network_signals.push("ℹ️ TikTok Shop signal detected");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRICE REALITY CHECK
  // ═══════════════════════════════════════════════════════════════════════════

  const rawPrices = signals.prices.value
    .map(p => parseFloat(p.replace(/[^0-9.]/g, "")))
    .filter(n => !isNaN(n) && n > 0);

  const priceSource: "json_ld" | "dom_regex" | "none" =
    signals.prices.source === "application/ld+json" ? "json_ld"
    : rawPrices.length > 0 ? "dom_regex"
    : "none";

  // Placeholder price detection (do NOT block — just flag and reduce confidence)
  const templateMatches = rawPrices.filter(n => TEMPLATE_PRICES.some(tp => Math.abs(n - tp) < 0.01));
  const isPlaceholderSuspect = rawPrices.length > 0 && templateMatches.length / rawPrices.length > 0.6;

  if (isPlaceholderSuspect && priceSource !== "json_ld") {
    evidence.structured_data.push(`⚠️ ${templateMatches.length}/${rawPrices.length} prices match common template patterns — placeholder data suspected`);
    pEcommerce -= W.TIER1 * 0.3; // Penalize — not block
  } else if (rawPrices.length > 0 && priceSource === "json_ld") {
    pEcommerce += W.TIER1 * 0.5;
    evidence.structured_data.push(`✅ ${rawPrices.length} verified product prices from JSON-LD schema`);
  } else if (rawPrices.length > 0) {
    pEcommerce += W.TIER4 * 0.6;
    evidence.dom_signals.push(`ℹ️ ${rawPrices.length} price string(s) found via DOM text (${signals.prices.confidence}% confidence)`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NORMALIZE PROBABILITIES TO 0–1
  // ═══════════════════════════════════════════════════════════════════════════
  pEcommerce   = Math.max(0, Math.min(1, pEcommerce));
  pContent     = Math.max(0, Math.min(1, pContent));
  pSaas        = Math.max(0, Math.min(1, pSaas));
  pMarketplace = Math.max(0, Math.min(1, pMarketplace));

  // ── Confidence Score (0–100): based on total evidence quantity + source quality ──
  const evidenceCount = Object.values(evidence).flat().filter(e => e.startsWith("✅")).length;
  const baseConfidence = Math.min(100, evidenceCount * 15 + (priceSource === "json_ld" ? 20 : 0));
  const confidence = Math.round(baseConfidence);

  // ── Classification Decision ───────────────────────────────────────────────
  let classification: DomainType;
  if (pEcommerce >= 0.70) {
    classification = "ecommerce";
  } else if (pContent >= 0.70) {
    classification = "content";
  } else if (pSaas >= 0.70) {
    classification = "saas";
  } else if (pMarketplace >= 0.70) {
    classification = "marketplace";
  } else {
    classification = "unknown";
  }

  // ── Eligibility ───────────────────────────────────────────────────────────
  const eligible = classification === "ecommerce" && confidence >= 70;

  if (!eligible) {
    const reason: BlockReason =
      classification === "content"              ? "CLASSIFIED_AS_CONTENT"
      : classification === "unknown"            ? "CLASSIFIED_AS_UNKNOWN"
      : pEcommerce < 0.70                       ? "LOW_ECOMMERCE_PROBABILITY"
      : "LOW_CONFIDENCE";

    const explanations: Record<BlockReason, string> = {
      CLASSIFIED_AS_CONTENT:         `Content site detected (content_probability: ${(pContent * 100).toFixed(0)}%). NOLIX optimizes ecommerce conversion — not content.`,
      CLASSIFIED_AS_UNKNOWN:         `Insufficient signals to classify this domain. ecommerce_probability: ${(pEcommerce * 100).toFixed(0)}%. Cannot proceed without confirmed ecommerce reality.`,
      LOW_ECOMMERCE_PROBABILITY:     `ecommerce_probability is ${(pEcommerce * 100).toFixed(0)}% — below the 70% threshold. Analysis would require guessing. Guessing is not intelligence.`,
      LOW_CONFIDENCE:                `Only ${confidence}/100 confidence based on ${evidenceCount} verified signals. More evidence needed before analysis is valid.`,
      PLACEHOLDER_DATA_DETECTED:     `Template/placeholder data detected. Prices match common demo patterns without verified product schema.`,
      DEMO_STAGING_URL:              `Demo/staging URL detected. Analysis on non-production sites produces fabricated insights.`,
      SITE_UNREACHABLE:              `Site is unreachable. Cannot gather reality signals.`,
    };

    const actions: Record<BlockReason, string> = {
      CLASSIFIED_AS_CONTENT:         "Connect an ecommerce store URL. Ensure the page has product listings, cart, and checkout flow.",
      CLASSIFIED_AS_UNKNOWN:         "Try submitting your product listing or shop page URL directly. Add Schema.org product markup for cleaner detection.",
      LOW_ECOMMERCE_PROBABILITY:     "Ensure the connected URL contains: product schema, add-to-cart buttons, and a checkout flow.",
      LOW_CONFIDENCE:                "Add product structured data (JSON-LD) to your store for reliable detection.",
      PLACEHOLDER_DATA_DETECTED:     "Connect a live store with real product prices and schema markup.",
      DEMO_STAGING_URL:              "Connect the live production store URL.",
      SITE_UNREACHABLE:              "Ensure the site is publicly accessible. Remove any authentication walls from the main page.",
    };

    return {
      ecommerce_probability:   pEcommerce,
      content_probability:     pContent,
      marketplace_probability: pMarketplace,
      saas_probability:        pSaas,
      evidence,
      confidence,
      classification,
      eligible_for_analysis:   false,
      block_reason:            reason,
      block_explanation:       explanations[reason],
      action_required:         actions[reason],
      store_priority:          null,
      data_quality:            priceSource === "json_ld" ? "VERIFIED" : priceSource === "dom_regex" ? "PARTIAL" : "INFERRED",
      confidence_level:        confidence >= 80 ? "HIGH" : confidence >= 50 ? "MEDIUM" : "LOW",
      detected_platform:       platform,
      price_reality: {
        has_prices:             rawPrices.length > 0,
        price_source:           priceSource,
        price_count:            rawPrices.length,
        price_range:            rawPrices.length > 0 ? { min: Math.min(...rawPrices), max: Math.max(...rawPrices) } : null,
        is_placeholder_suspect: isPlaceholderSuspect,
      },
    };
  }

  // ── Store Priority (ecommerce confirmed) ──────────────────────────────────
  let storePriority: StoreTypePriority = "custom_medium";
  if (platform === "Shopify") {
    storePriority = "shopify_high";
  } else if (platform === "WooCommerce") {
    storePriority = "woocommerce_high";
  } else if (pageText.includes("tiktok shop")) {
    storePriority = "tiktok_low";
  } else if (pageText.includes("instagram") && !platform) {
    storePriority = "dtc_medium";
  }

  return {
    ecommerce_probability:   pEcommerce,
    content_probability:     pContent,
    marketplace_probability: pMarketplace,
    saas_probability:        pSaas,
    evidence,
    confidence,
    classification:          "ecommerce",
    eligible_for_analysis:   true,
    block_reason:            null,
    block_explanation:       null,
    action_required:         null,
    store_priority:          storePriority,
    data_quality:            priceSource === "json_ld" ? "VERIFIED" : priceSource === "dom_regex" ? "PARTIAL" : "INFERRED",
    confidence_level:        confidence >= 80 ? "HIGH" : confidence >= 50 ? "MEDIUM" : "LOW",
    detected_platform:       platform,
    price_reality: {
      has_prices:             rawPrices.length > 0,
      price_source:           priceSource,
      price_count:            rawPrices.length,
      price_range:            rawPrices.length > 0 ? { min: Math.min(...rawPrices), max: Math.max(...rawPrices) } : null,
      is_placeholder_suspect: isPlaceholderSuspect,
    },
  };
}

// ── Internal: Build a blocked RealityFingerprint ──────────────────────────────
function block(
  reason: BlockReason,
  explanation: string,
  action: string,
  evidence: RealityEvidence
): RealityFingerprint {
  return {
    ecommerce_probability:   0,
    content_probability:     0,
    marketplace_probability: 0,
    saas_probability:        0,
    evidence,
    confidence:              0,
    classification:          "unknown",
    eligible_for_analysis:   false,
    block_reason:            reason,
    block_explanation:       explanation,
    action_required:         action,
    store_priority:          null,
    data_quality:            "INFERRED",
    confidence_level:        "LOW",
    detected_platform:       null,
    price_reality: {
      has_prices:             false,
      price_source:           "none",
      price_count:            0,
      price_range:            null,
      is_placeholder_suspect: false,
    },
  };
}

// ── Backward-compatible alias ────────────────────────────────────────────────
export { buildRealityFingerprint as classifyDomain };
// Re-export DomainType under the old name for any existing imports
export type { DomainType as DomainClassification };
