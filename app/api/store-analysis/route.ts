import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ─── HTML Signal Extractor ───────────────────────────────────────────────────
function extractSignals(html: string, domain: string) {
  const lower = html.toLowerCase();

  // --- Trust Signals ---
  const trustSignals = {
    hasSSL: html.startsWith("https") || lower.includes("ssl") || lower.includes("secure"),
    hasReviews: lower.includes("review") || lower.includes("rating") || lower.includes("stars") || lower.includes("testimonial"),
    hasMoneyBack: lower.includes("money back") || lower.includes("money-back") || lower.includes("refund") || lower.includes("guarantee"),
    hasFreeShipping: lower.includes("free shipping") || lower.includes("free delivery"),
    hasTrustBadge: lower.includes("trust") || lower.includes("verified") || lower.includes("secure checkout") || lower.includes("safe"),
    hasContactInfo: lower.includes("contact") || lower.includes("support") || lower.includes("@") || lower.includes("chat"),
    hasSocialProof: lower.includes("customers") || lower.includes("sold") || lower.includes("orders") || lower.includes("happy"),
    hasReturnPolicy: lower.includes("return") || lower.includes("exchange"),
  };

  // --- Pricing Visibility ---
  const pricingSignals = {
    hasPriceVisible: /\$[\d,]+/.test(html) || /£[\d,]+/.test(html) || /€[\d,]+/.test(html) || lower.includes("price"),
    hasDiscountCode: lower.includes("discount") || lower.includes("coupon") || lower.includes("promo"),
    hasComparePrice: lower.includes("compare") || lower.includes("was $") || lower.includes("regular price") || lower.includes("sale"),
    hasClearCTA: lower.includes("add to cart") || lower.includes("buy now") || lower.includes("shop now") || lower.includes("order now"),
    hasUrgency: lower.includes("limited") || lower.includes("only") || lower.includes("hurry") || lower.includes("ends"),
    hasScarcity: lower.includes("in stock") || lower.includes("left") || lower.includes("available"),
  };

  // --- Checkout Indicators ---
  const checkoutSignals = {
    hasCheckout: lower.includes("checkout") || lower.includes("cart"),
    hasMultiStep: lower.includes("step 1") || lower.includes("step 2") || lower.includes("shipping information") || lower.includes("payment information"),
    hasGuestCheckout: lower.includes("guest") || lower.includes("continue as guest"),
    hasPaypalOrStripe: lower.includes("paypal") || lower.includes("stripe") || lower.includes("pay with"),
    hasMultiPayment: lower.includes("visa") || lower.includes("mastercard") || lower.includes("apple pay") || lower.includes("google pay"),
    hasCartAbandonment: lower.includes("leave") || lower.includes("before you go") || lower.includes("wait"),
  };

  // --- Mobile Responsiveness ---
  const mobileSignals = {
    hasViewport: lower.includes("viewport") || lower.includes("width=device-width"),
    hasResponsive: lower.includes("responsive") || lower.includes("mobile"),
    hasAMP: lower.includes("amp-") || lower.includes("ampproject"),
    hasFastLoad: !lower.includes("flash") && (lower.includes("lazy") || lower.includes("preload") || lower.includes("async")),
  };

  // --- Platform Detection ---
  const isShopify =
    lower.includes("shopify") ||
    lower.includes("cdn.shopify.com") ||
    lower.includes("myshopify") ||
    lower.includes("shopify-features");
  const isWooCommerce = lower.includes("woocommerce") || lower.includes("woo-") || lower.includes("wp-content");
  const isWix = lower.includes("wix.com") || lower.includes("wixstatic");
  const isSquarespace = lower.includes("squarespace");

  // --- Page Structure ---
  const hasNavigation = lower.includes("<nav") || lower.includes("navigation");
  const hasHeroSection = lower.includes("hero") || lower.includes("banner") || (lower.includes("<h1") || lower.includes("<h1>"));
  const hasFooter = lower.includes("<footer") || lower.includes("footer");
  const pageWordCount = html.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;

  return {
    trustSignals,
    pricingSignals,
    checkoutSignals,
    mobileSignals,
    platform: isShopify ? "Shopify" : isWooCommerce ? "WooCommerce" : isWix ? "Wix" : isSquarespace ? "Squarespace" : "Unknown",
    pageStructure: { hasNavigation, hasHeroSection, hasFooter, pageWordCount },
    rawTrustScore: Object.values(trustSignals).filter(Boolean).length,
    rawPricingScore: Object.values(pricingSignals).filter(Boolean).length,
    rawCheckoutScore: Object.values(checkoutSignals).filter(Boolean).length,
    rawMobileScore: Object.values(mobileSignals).filter(Boolean).length,
  };
}

// ─── Zeno Health Score Calculator ────────────────────────────────────────────
function calculateHealthScore(signals: ReturnType<typeof extractSignals>) {
  const { trustSignals, pricingSignals, checkoutSignals, mobileSignals } = signals;

  // Trust signals (25 pts max)
  const trustItems = Object.values(trustSignals);
  const trustScore = Math.round((trustItems.filter(Boolean).length / trustItems.length) * 25);

  // Checkout friction (25 pts max — higher score = less friction)
  const checkoutItems = Object.values(checkoutSignals);
  const checkoutRaw = checkoutItems.filter(Boolean).length;
  // Penalize multi-step checkout
  const frictionPenalty = checkoutSignals.hasMultiStep ? -3 : 0;
  const checkoutScore = Math.max(0, Math.round((checkoutRaw / checkoutItems.length) * 25) + frictionPenalty);

  // Conversion performance (25 pts max)
  const conversionSignals = [
    pricingSignals.hasClearCTA,
    pricingSignals.hasUrgency,
    pricingSignals.hasComparePrice,
    pricingSignals.hasScarcity,
    trustSignals.hasSocialProof,
    trustSignals.hasMoneyBack,
  ];
  const conversionScore = Math.round((conversionSignals.filter(Boolean).length / conversionSignals.length) * 25);

  // Offer optimization (25 pts max)
  const offerSignals = [
    pricingSignals.hasPriceVisible,
    pricingSignals.hasDiscountCode,
    trustSignals.hasFreeShipping,
    mobileSignals.hasViewport,
    mobileSignals.hasFastLoad,
    signals.pageStructure.hasHeroSection,
  ];
  const offerScore = Math.round((offerSignals.filter(Boolean).length / offerSignals.length) * 25);

  const total = trustScore + checkoutScore + conversionScore + offerScore;

  return {
    total: Math.min(100, Math.max(0, total)),
    breakdown: {
      conversionPerformance: conversionScore,
      checkoutFriction: checkoutScore,
      trustSignals: trustScore,
      offerOptimization: offerScore,
    },
  };
}

// ─── Fetch store HTML ─────────────────────────────────────────────────────────
async function fetchStoreHtml(domain: string): Promise<{ html: string; ok: boolean; limited: boolean }> {
  const urls = [`https://www.${domain}`, `https://${domain}`];
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NolixBot/1.0; +https://nolix.ai/bot)",
          Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        },
        redirect: "follow",
      });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const html = await res.text();
      // Truncate to 80KB for processing
      return { html: html.slice(0, 80000), ok: true, limited: html.length > 80000 };
    } catch {
      continue;
    }
  }
  return { html: "", ok: false, limited: false };
}

// ─── Groq AI Analysis ────────────────────────────────────────────────────────
async function runZenoAnalysis(
  domain: string,
  signals: ReturnType<typeof extractSignals>,
  healthScore: { total: number; breakdown: Record<string, number> },
  limited: boolean
): Promise<{
  zenoSummary: string;
  topIssues: Array<{ icon: string; label: string; detail: string; type: string }>;
  topFix: string;
  estimatedRevenueLoss: string;
  conversionEstimate: string;
}> {
  const apiKey = process.env.GROQ_ANALYZE_KEY;
  if (!apiKey) throw new Error("No Groq key");

  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  const signalSummary = `
Store: ${domain}
Platform: ${signals.platform}
Health Score: ${healthScore.total}/100
Breakdown: Conversion=${healthScore.breakdown.conversionPerformance}/25, Checkout=${healthScore.breakdown.checkoutFriction}/25, Trust=${healthScore.breakdown.trustSignals}/25, Offers=${healthScore.breakdown.offerOptimization}/25

Trust Signals Found: ${Object.entries(signals.trustSignals).filter(([,v])=>v).map(([k])=>k).join(", ") || "none"}
Trust Signals Missing: ${Object.entries(signals.trustSignals).filter(([,v])=>!v).map(([k])=>k).join(", ") || "none"}

Pricing Signals Found: ${Object.entries(signals.pricingSignals).filter(([,v])=>v).map(([k])=>k).join(", ") || "none"}
Pricing Signals Missing: ${Object.entries(signals.pricingSignals).filter(([,v])=>!v).map(([k])=>k).join(", ") || "none"}

Checkout Signals Found: ${Object.entries(signals.checkoutSignals).filter(([,v])=>v).map(([k])=>k).join(", ") || "none"}
Checkout Signals Missing: ${Object.entries(signals.checkoutSignals).filter(([,v])=>!v).map(([k])=>k).join(", ") || "none"}

Mobile Signals Found: ${Object.entries(signals.mobileSignals).filter(([,v])=>v).map(([k])=>k).join(", ") || "none"}
Page Structure: navigation=${signals.pageStructure.hasNavigation}, hero=${signals.pageStructure.hasHeroSection}, footer=${signals.pageStructure.hasFooter}
${limited ? "Note: Only partial page data was available for analysis." : ""}
  `.trim();

  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are Zeno, an elite e-commerce revenue analyst. You analyze real store data and give precise, actionable insights. Always be specific and honest. If data is limited, say so clearly. Never make up numbers. Base all insights on the actual signals provided.

Respond ONLY with valid JSON matching this exact schema:
{
  "zenoSummary": "2-3 sentence summary of what you found. Mention the Health Score and top issue. Be direct.",
  "topIssues": [
    { "icon": "emoji", "label": "Issue name", "detail": "Specific detail based on signals found/missing", "type": "warning|danger|info" }
  ],
  "topFix": "The single most impactful fix to do right now. Be specific.",
  "estimatedRevenueLoss": "Honest estimate based on health score, e.g. '$2,000-$8,000/mo' or 'Unknown - limited data'",
  "conversionEstimate": "CVR estimate based on signals, e.g. '1.2%-1.8%' or 'Insufficient data'"
}

Return 3-5 topIssues based ONLY on what is actually missing from the signals.`,
      },
      {
        role: "user",
        content: signalSummary,
      },
    ],
    temperature: 0.3,
    max_tokens: 800,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw);
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain") ?? "";
  if (!domain) {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }

  try {
    // 1. Fetch real HTML
    const { html, ok, limited } = await fetchStoreHtml(domain);

    if (!ok || !html) {
      return NextResponse.json(
        {
          error: "fetch_failed",
          message: "Could not fetch store content. Analysis unavailable.",
          limited: true,
          healthScore: { total: 0, breakdown: { conversionPerformance: 0, checkoutFriction: 0, trustSignals: 0, offerOptimization: 0 } },
        },
        { status: 422 }
      );
    }

    // 2. Extract signals
    const signals = extractSignals(html, domain);

    // 3. Calculate Health Score
    const healthScore = calculateHealthScore(signals);

    // 4. Run Zeno AI analysis
    let aiAnalysis;
    try {
      aiAnalysis = await runZenoAnalysis(domain, signals, healthScore, limited);
    } catch (aiErr) {
      console.warn("[store-analysis] AI analysis failed, using fallback:", aiErr);
      // Fallback analysis based purely on signals
      const missingTrust = Object.entries(signals.trustSignals).filter(([,v])=>!v).map(([k])=>k);
      const missingCheckout = Object.entries(signals.checkoutSignals).filter(([,v])=>!v).map(([k])=>k);
      aiAnalysis = {
        zenoSummary: `I analyzed ${domain} and found a Health Score of ${healthScore.total}/100. ${missingTrust.length > 2 ? "Trust signals are weak — this is likely hurting conversions." : "Some trust signals are present."} ${missingCheckout.length > 2 ? "Checkout flow needs improvement." : ""}`,
        topIssues: [
          missingTrust.includes("hasReviews") && { icon: "⭐", label: "No reviews visible", detail: "Social proof is missing above the fold. Reviews increase CVR by 15-25%.", type: "warning" },
          missingTrust.includes("hasMoneyBack") && { icon: "🛡️", label: "No money-back guarantee", detail: "No refund policy visible. This is a top conversion killer.", type: "danger" },
          !signals.pricingSignals.hasClearCTA && { icon: "🛒", label: "Weak call-to-action", detail: "No clear 'Add to Cart' or 'Buy Now' detected on the page.", type: "danger" },
          !signals.pricingSignals.hasUrgency && { icon: "⏰", label: "No urgency signals", detail: "No scarcity or time pressure visible. Buyers hesitate without urgency.", type: "warning" },
        ].filter(Boolean) as Array<{ icon: string; label: string; detail: string; type: string }>,
        topFix: missingTrust.includes("hasReviews") ? "Add customer reviews above the fold on your product page." : "Add a visible money-back guarantee to your checkout page.",
        estimatedRevenueLoss: healthScore.total < 40 ? "$5,000-$15,000/mo" : healthScore.total < 60 ? "$2,000-$8,000/mo" : "$500-$3,000/mo",
        conversionEstimate: healthScore.total < 40 ? "0.8%-1.4%" : healthScore.total < 60 ? "1.4%-2.0%" : "2.0%-2.8%",
      };
    }

    return NextResponse.json({
      domain,
      platform: signals.platform,
      healthScore,
      signals: {
        trust: signals.trustSignals,
        pricing: signals.pricingSignals,
        checkout: signals.checkoutSignals,
        mobile: signals.mobileSignals,
        pageStructure: signals.pageStructure,
      },
      zenoSummary: aiAnalysis.zenoSummary,
      topIssues: aiAnalysis.topIssues,
      topFix: aiAnalysis.topFix,
      estimatedRevenueLoss: aiAnalysis.estimatedRevenueLoss,
      conversionEstimate: aiAnalysis.conversionEstimate,
      limited,
      analyzedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[store-analysis]", err);
    return NextResponse.json({ error: "Analysis failed", message: String(err) }, { status: 500 });
  }
}
