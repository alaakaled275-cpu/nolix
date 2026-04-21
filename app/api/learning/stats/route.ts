import { NextRequest, NextResponse } from "next/server";
import { getAccessTier, requireTier } from "@/lib/nolix-security";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-nolix-key");
  if (!requireTier(getAccessTier(key), "read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const weightsStr = await redis.get("nolix:learning:strategy_weights");
    const weights = weightsStr ? JSON.parse(weightsStr) : {};
    
    // Find top strategy
    let top_strategy = "balanced";
    let max = 0;
    for (const [s, w] of Object.entries(weights)) {
      if ((w as number) > max) { max = w as number; top_strategy = s; }
    }

    const mlPerfStr = await redis.get("nolix:learning:ml_success_rate");
    const pricingEffStr = await redis.get("nolix:learning:pricing_efficiency");

    return NextResponse.json({
      top_strategy,
      ml_performance: mlPerfStr ? parseFloat(mlPerfStr) : 0,
      pricing_efficiency: pricingEffStr ? parseFloat(pricingEffStr) : 0,
      learning_status: "active"
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch learning stats", message: err.message }, { status: 500 });
  }
}
