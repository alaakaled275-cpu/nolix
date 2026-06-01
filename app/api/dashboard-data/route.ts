import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/dashboard-data?store=domain.com
 *
 * Returns dashboard metrics for a given store domain.
 * Priority:
 * 1. If DB is connected and has real data → return real data
 * 2. If DB has no data or unavailable → return smart demo data seeded by domain
 *    (not fake zeros — realistic numbers that feel real)
 */

// Deterministic seeded random (so same domain always gets same numbers)
function seeded(seed: number, min: number, max: number, offset = 0): number {
  const h = ((seed * 1664525 + offset * 22695477 + 1013904223) >>> 0) / 4294967296;
  return Math.round(min + h * (max - min));
}

function hashDomain(domain: string): number {
  let h = 0;
  for (let i = 0; i < domain.length; i++) {
    h = (Math.imul(31, h) + domain.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function generateStoreDemoData(domain: string) {
  const seed = hashDomain(domain);

  // Core metrics (realistic mid-tier store range)
  const totalSessions = seeded(seed, 1800, 12000, 1);
  const highIntent = seeded(seed, Math.round(totalSessions * 0.25), Math.round(totalSessions * 0.38), 2);
  const popupsShown = seeded(seed, Math.round(totalSessions * 0.18), Math.round(totalSessions * 0.28), 3);
  const conversions = seeded(seed, Math.round(popupsShown * 0.08), Math.round(popupsShown * 0.18), 4);
  const cvrPct = +((conversions / Math.max(popupsShown, 1)) * 100).toFixed(1);
  const offerRate = +((popupsShown / Math.max(totalSessions, 1)) * 100).toFixed(1);
  const avgOrderValue = seeded(seed, 45, 120, 5);
  const revenueAttributed = conversions * avgOrderValue;
  const discountAvoided = seeded(seed, Math.round(conversions * 0.3), Math.round(conversions * 0.55), 6);
  const discountSavedPct = Math.round((discountAvoided / Math.max(conversions, 1)) * 100);

  // Today metrics
  const todayAnalyzed = seeded(seed, Math.round(totalSessions * 0.04), Math.round(totalSessions * 0.09), 7);
  const todayActions = seeded(seed, Math.round(todayAnalyzed * 0.15), Math.round(todayAnalyzed * 0.28), 8);
  const todayConversions = seeded(seed, Math.round(todayActions * 0.08), Math.round(todayActions * 0.18), 9);
  const todayRevenue = todayConversions * avgOrderValue;
  const todayDiscountsAvoided = seeded(seed, Math.round(todayConversions * 0.2), Math.round(todayConversions * 0.5), 10);

  // Revenue lift
  const revenueLiftEst = `+${seeded(seed, 12, 34, 11)}%`;

  // Intent distribution
  const intentDistribution = [
    { intent_level: "high", count: String(highIntent) },
    { intent_level: "medium", count: String(seeded(seed, Math.round(totalSessions * 0.3), Math.round(totalSessions * 0.45), 12)) },
    { intent_level: "low", count: String(totalSessions - highIntent - seeded(seed, Math.round(totalSessions * 0.3), Math.round(totalSessions * 0.45), 12)) },
  ];

  // Friction distribution
  const stuckCart = seeded(seed, Math.round(totalSessions * 0.06), Math.round(totalSessions * 0.14), 13);
  const bounceRisk = seeded(seed, Math.round(totalSessions * 0.1), Math.round(totalSessions * 0.22), 14);
  const paralysis = seeded(seed, Math.round(totalSessions * 0.03), Math.round(totalSessions * 0.08), 15);
  const frictionDistribution = [
    { friction_detected: "stuck_cart", count: String(stuckCart) },
    { friction_detected: "bounce_risk", count: String(bounceRisk) },
    { friction_detected: "paralysis", count: String(paralysis) },
    { friction_detected: "none", count: String(totalSessions - stuckCart - bounceRisk - paralysis) },
  ];

  // A/B results
  const abImprA = seeded(seed, 80, 200, 16);
  const abImprB = seeded(seed, 80, 200, 17);
  const abConvA = seeded(seed, Math.round(abImprA * 0.08), Math.round(abImprA * 0.16), 18);
  const abConvB = seeded(seed, Math.round(abImprB * 0.1), Math.round(abImprB * 0.22), 19);
  const abResults = [
    { variant: "A", offer_type: "discount_10", impressions: abImprA, conversions: abConvA },
    { variant: "B", offer_type: "discount_15", impressions: abImprB, conversions: abConvB },
  ];

  // Insights
  const insights: string[] = [];
  if (highIntent / totalSessions > 0.28) {
    insights.push(`${Math.round((highIntent / totalSessions) * 100)}% of your visitors show high buying intent — they are ready to purchase.`);
  }
  if (cvrPct > 10) {
    insights.push(`Visitors who saw an offer converted at ${cvrPct}% — significantly above average.`);
  }
  if (discountSavedPct > 30) {
    insights.push(`${discountSavedPct}% of conversions happened without any discount — your product sells itself most of the time.`);
  }
  if (stuckCart > 50) {
    insights.push(`Cart abandonment is your biggest friction point — ${stuckCart} visitors got stuck before checkout.`);
  }
  if (abConvB > abConvA) {
    const lift = Math.round(((abConvB / abImprB - abConvA / abImprA) / (abConvA / abImprA)) * 100);
    insights.push(`Variant B (15% discount) is outperforming Variant A by ${lift}% relative lift.`);
  }
  if (insights.length === 0) {
    insights.push("System is analyzing visitor patterns. More insights will appear as data grows.");
  }

  // Critical alerts
  const criticalAlerts = [];
  if (stuckCart > 80) {
    criticalAlerts.push({
      type: "warning",
      title: "🛒 High Cart Abandonment",
      message: `${stuckCart} visitors added to cart but didn't complete checkout.`,
      recommendation: "Enable exit-intent popups with 15% discount for cart abandoners.",
    });
  }

  // Recent sessions (generated)
  const sources = ["organic", "paid_ads", "social", "direct", "email"];
  const intents = ["high", "high", "medium", "medium", "low"];
  const frictions = ["stuck_cart", null, "bounce_risk", null, "paralysis"];
  const offers = ["discount_10", "urgency", null, "discount_5", null];
  const sessions = Array.from({ length: 8 }, (_, i) => ({
    id: `sess_${seed}_${i}`,
    session_id: `s${(seed + i * 1000).toString(36).slice(0, 8)}`,
    created_at: new Date(Date.now() - i * 7 * 60000).toISOString(),
    intent_level: intents[i % intents.length],
    intent_score: seeded(seed, 3, 9, 20 + i),
    friction_detected: frictions[i % frictions.length],
    show_popup: offers[i % offers.length] !== null,
    offer_type: offers[i % offers.length],
    converted: i % 3 === 0,
    order_value: i % 3 === 0 ? avgOrderValue : null,
    traffic_source: sources[i % sources.length],
    cart_status: i % 2 === 0 ? "checkout" : "added",
    device: i % 3 === 0 ? "desktop" : "mobile",
    business_explanation:
      i % 3 === 0
        ? "Strong buying intent detected at checkout. Urgency message secured the sale."
        : "Visitor browsed with intent but didn't convert. System applied a targeted offer.",
  }));

  return {
    store: domain,
    total_sessions: totalSessions,
    high_intent_sessions: highIntent,
    popups_shown: popupsShown,
    total_conversions: conversions,
    cvr_pct: cvrPct,
    offer_rate_pct: offerRate,
    revenue_attributed: revenueAttributed,
    revenue_lift_est: revenueLiftEst,
    discount_avoided_count: discountAvoided,
    discount_saved_pct: discountSavedPct,
    today: {
      analyzed: todayAnalyzed,
      actions_taken: todayActions,
      conversions: todayConversions,
      revenue: todayRevenue,
      discounts_avoided: todayDiscountsAvoided,
    },
    top_action: "urgency",
    top_action_cvr: seeded(seed, 9, 18, 20),
    intent_distribution: intentDistribution,
    friction_distribution: frictionDistribution,
    ab_results: abResults,
    insights,
    critical_alerts: criticalAlerts,
    sessions,
    _demo: true,
    _demo_note: "Data is seeded from your store domain for demonstration. Connect Nolix script to see real data.",
  };
}

export async function GET(req: NextRequest) {
  const store = req.nextUrl.searchParams.get("store");

  if (!store) {
    return NextResponse.json({ error: "store parameter required" }, { status: 400 });
  }

  // Try real DB first
  try {
    const { query, ensureNolixSchema } = await import("@/lib/schema");
    await ensureNolixSchema();

    const rows = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM popup_sessions WHERE store_domain = $1`,
      [store]
    );
    const realCount = Number(rows[0]?.count ?? 0);

    if (realCount > 0) {
      // Has real data → redirect to real stats endpoint
      return NextResponse.json({
        _source: "real_db",
        store,
        message: "Real data available — use /api/convert/stats for full metrics",
        session_count: realCount,
      });
    }
  } catch {
    // DB unavailable — fall through to demo data
  }

  // Return demo data seeded by domain
  const data = generateStoreDemoData(store);
  return NextResponse.json(data);
}
