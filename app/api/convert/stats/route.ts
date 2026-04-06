import { NextResponse } from "next/server";
import { query, ensureConvertAISchema } from "@/lib/schema";

let schemaReady = false;

// ── Human-readable decision translator ──────────────────────────────────────
function toBusinessLanguage(reasoning: string, action: string | null): string {
  const r = reasoning ?? "";
  const intent  = r.includes("intent=high") ? "high"   : r.includes("intent=medium") ? "medium" : "low";
  const friction = r.includes("stuck_cart") ? "stuck_cart" : r.includes("paralysis") ? "paralysis" : r.includes("bounce_risk") ? "bounce_risk" : "none";

  if (!action || action === "do_nothing") {
    if (friction === "bounce_risk") return "Visitor just arrived — too early to intervene. System waited to gather more data.";
    return "Visitor showed low buying intent. System stayed silent to avoid being disruptive.";
  }
  if (action === "urgency") {
    if (intent === "high") return "Strong buying intent detected at checkout. A gentle urgency message was shown — no discount needed.";
    return "Visitor was close to purchasing. A time-sensitive nudge was applied to close the sale.";
  }
  if (action.startsWith("discount")) {
    const pct = action.replace("discount_", "");
    if (friction === "stuck_cart")
      return `Visitor spent a long time with items in their cart but didn't checkout. A ${pct}% discount was offered to rescue the sale.`;
    return `Visitor showed buying intent but needed a small incentive. A ${pct}% discount was applied to secure the purchase.`;
  }
  if (action === "free_shipping") {
    return "Visitor browsed extensively but hadn't committed. Free shipping was offered to remove the last barrier.";
  }
  if (action === "bundle") {
    return "Visitor explored many products but couldn't decide. A bundle deal was suggested to increase perceived value.";
  }
  return "System analyzed visitor behavior and selected the best action to maximize conversion.";
}

// ── Insights generator ────────────────────────────────────────────────────────
function generateInsights(data: {
  total: number;
  highIntent: number;
  shown: number;
  convs: number;
  discountCount: number;
  discountAvoided: number;
  frictionCounts: Record<string, number>;
}): string[] {
  const insights: string[] = [];
  const { total, highIntent, shown, convs, discountCount, discountAvoided, frictionCounts } = data;

  if (total > 0 && (highIntent / total) > 0.3) {
    insights.push(`${Math.round((highIntent / total) * 100)}% of your visitors show high buying intent — they are ready to purchase.`);
  }
  if (shown > 0 && (convs / shown) > 0.15) {
    insights.push(`Visitors who saw an offer converted at ${((convs / shown) * 100).toFixed(1)}% — significantly above average.`);
  }
  if (discountAvoided > 0 && (discountAvoided + discountCount) > 0) {
    const savedPct = Math.round((discountAvoided / (discountAvoided + discountCount)) * 100);
    insights.push(`${savedPct}% of conversions happened without any discount — your product sells itself most of the time.`);
  }
  if ((frictionCounts["stuck_cart"] ?? 0) > 0) {
    insights.push(`Cart abandonment is your biggest friction point — ${frictionCounts["stuck_cart"]} visitors got stuck before checkout.`);
  }
  if ((frictionCounts["paralysis"] ?? 0) > 0) {
    insights.push(`${frictionCounts["paralysis"]} visitors browsed extensively but didn't add to cart — consider simplifying your product selection.`);
  }
  if (discountCount > 0 && discountAvoided > discountCount) {
    insights.push("Discounts are only needed in a minority of cases — the system is protecting your margins effectively.");
  }
  if (insights.length === 0 && total > 0) {
    insights.push("System is analyzing visitor patterns. More insights will appear as data grows.");
  }
  return insights;
}

// ── Mock data generator (used when DB is unavailable) ─────────────────────────
function generateMockResponse() {
  return {
    total_sessions:        0,
    high_intent_sessions:  0,
    popups_shown:          0,
    total_conversions:     0,
    cvr_pct:               0,
    offer_rate_pct:        0,
    revenue_attributed:    0,
    revenue_lift_est:      "—",
    discount_avoided_count: 0,
    discount_saved_pct:     0,
    today: {
      analyzed:          0,
      actions_taken:     0,
      conversions:       0,
      revenue:           0,
      discounts_avoided: 0,
    },
    top_action:     null,
    top_action_cvr: 0,
    intent_distribution:   [],
    friction_distribution: [],
    ab_results:            [],
    insights:              ["No data available yet. Start getting traffic to see insights."],
    sessions:              [],
    _mock:                 true, // flag so frontend can tell it's mock data if needed
  };
}

// ── GET handler ──────────────────────────────────────────────────────────────
export async function GET() {
  // ── 1. Try real database ──────────────────────────────────────────────────
  try {
    // Ensure schema exists (only first call)
    if (!schemaReady) {
      try {
        await ensureConvertAISchema();
        schemaReady = true;
      } catch (schemaErr) {
        console.warn("[stats] ⚠ Schema not ready, falling back to mock data:", (schemaErr as Error).message);
        return NextResponse.json(generateMockResponse());
      }
    }

    // Run all queries in parallel to maximize speed
    const [
      overviewRows,
      intentRows,
      frictionRows,
      todayRows,
      topActionRows,
      abRows,
      recentRows
    ] = await Promise.all([
      // 1. Overview
      query<{ total: string; shown: string; convs: string; revenue: string; discount_avoided: string; discount_count: string; }>(`
        SELECT
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE show_popup = true)::text  AS shown,
          COUNT(*) FILTER (WHERE converted = true)::text   AS convs,
          COALESCE(SUM(order_value) FILTER (WHERE influenced_by_system = true), 0)::text AS revenue,
          COUNT(*) FILTER (WHERE discount_avoided = true AND converted = true)::text AS discount_avoided,
          COUNT(*) FILTER (WHERE action_taken LIKE 'discount%' AND converted = true)::text AS discount_count
        FROM popup_sessions
      `),
      // 2. Intent
      query<{ intent_level: string; count: string }>(
        `SELECT intent_level, COUNT(*)::text AS count FROM popup_sessions GROUP BY intent_level`
      ),
      // 3. Friction
      query<{ friction_detected: string; count: string }>(
        `SELECT COALESCE(friction_detected,'none') AS friction_detected, COUNT(*)::text AS count
         FROM popup_sessions GROUP BY friction_detected`
      ),
      // 4. Today
      query<{ analyzed: string; actions: string; convs_today: string; revenue_today: string; discounts_avoided_today: string; }>(`
        SELECT
          COUNT(*)::text AS analyzed,
          COUNT(*) FILTER (WHERE show_popup = true)::text AS actions,
          COUNT(*) FILTER (WHERE converted = true)::text  AS convs_today,
          COALESCE(SUM(order_value) FILTER (WHERE influenced_by_system=true),0)::text AS revenue_today,
          COUNT(*) FILTER (WHERE discount_avoided = true AND converted = true)::text AS discounts_avoided_today
        FROM popup_sessions
        WHERE created_at >= CURRENT_DATE
      `),
      // 5. Top Action
      query<{ action_taken: string; cvr: string }>(
        `SELECT
           COALESCE(action_taken, offer_type, 'unknown') AS action_taken,
           ROUND(100.0 * COUNT(*) FILTER (WHERE converted=true) / NULLIF(COUNT(*),0), 1)::text AS cvr
         FROM popup_sessions
         WHERE show_popup = true AND COALESCE(action_taken, offer_type) IS NOT NULL
         GROUP BY action_taken
         ORDER BY cvr::numeric DESC
         LIMIT 1`
      ),
      // 6. A/B results
      query<{ variant: string; offer_type: string; impressions: number; conversions: number }>(
        `SELECT variant, offer_type, impressions, conversions FROM ab_test_results ORDER BY variant, impressions DESC`
      ),
      // 7. Recent sessions
      query<{
        id: string; session_id: string; created_at: string; intent_level: string; intent_score: number;
        friction_detected: string | null; show_popup: boolean; offer_type: string | null;
        action_taken: string | null; converted: boolean; order_value: number | null;
        discount_avoided: boolean; reasoning: string | null; traffic_source: string;
        cart_status: string; device: string;
      }>(
        `SELECT id, session_id, created_at, intent_level, intent_score, friction_detected,
                show_popup, offer_type, action_taken, converted, order_value, discount_avoided,
                reasoning, traffic_source, cart_status, device
         FROM popup_sessions
         ORDER BY created_at DESC LIMIT 50`
      )
    ]);

    const overview = overviewRows[0];
    const total           = Number(overview?.total ?? 0);
    const shown           = Number(overview?.shown ?? 0);
    const convs           = Number(overview?.convs ?? 0);
    const revenue         = Number(overview?.revenue ?? 0);
    const discountAvoided  = Number(overview?.discount_avoided ?? 0);
    const discountCount   = Number(overview?.discount_count ?? 0);
    const cvr             = shown > 0 ? +((convs / shown) * 100).toFixed(1) : 0;
    const offerRate       = total > 0 ? +((shown / total) * 100).toFixed(1) : 0;
    const totalConverted  = discountAvoided + discountCount;
    const discountSavedPct = totalConverted > 0 ? Math.round((discountAvoided / totalConverted) * 100) : 0;

    const highIntent      = Number(intentRows.find(r => r.intent_level === "high")?.count ?? 0);
    const frictionCounts  = Object.fromEntries(frictionRows.map(r => [r.friction_detected, Number(r.count)]));

    const today           = todayRows[0];
    const sessions        = recentRows.map(s => ({
      ...s,
      business_explanation: toBusinessLanguage(s.reasoning ?? "", s.action_taken ?? s.offer_type),
    }));

    const insights = generateInsights({ total, highIntent, shown, convs, discountCount, discountAvoided, frictionCounts });

    return NextResponse.json({
      total_sessions:        total,
      high_intent_sessions:  highIntent,
      popups_shown:          shown,
      total_conversions:     convs,
      cvr_pct:               cvr,
      offer_rate_pct:        offerRate,
      revenue_attributed:    revenue,
      revenue_lift_est:      cvr > 0 ? `+${(cvr * 1.4).toFixed(1)}%` : "—",
      discount_avoided_count: discountAvoided,
      discount_saved_pct:     discountSavedPct,
      today: {
        analyzed:          Number(today?.analyzed ?? 0),
        actions_taken:     Number(today?.actions ?? 0),
        conversions:       Number(today?.convs_today ?? 0),
        revenue:           Number(today?.revenue_today ?? 0),
        discounts_avoided: Number(today?.discounts_avoided_today ?? 0),
      },
      top_action: topActionRows[0]?.action_taken ?? null,
      top_action_cvr: Number(topActionRows[0]?.cvr ?? 0),
      intent_distribution: intentRows,
      friction_distribution: frictionRows,
      ab_results: abRows,
      insights,
      sessions,
    });

  } catch (err) {
    // ── 2. Database failed → fallback to mock data ──────────────────────────
    console.warn("[stats] ⚠ Database query failed, serving mock data:", (err as Error).message);
    try {
      return NextResponse.json(generateMockResponse());
    } catch (mockErr) {
      // This should never happen, but guard against it
      console.error("[stats] ✖ Mock data generation also failed:", mockErr);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }
}
