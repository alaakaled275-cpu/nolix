import { NextResponse } from "next/server";
import { computeCalibration } from "@/lib/calibration";
import { query } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Use the new per-visitor calibration engine
    const report = await computeCalibration(undefined, 30);

    // Also include store-level prediction samples for display
    const sampleRows = await query<{
      url: string;
      ecoscore: number;
      actual: string;
    }>(
      `SELECT p.url, p.ecommerce_probability as ecoscore, o.actual_type as actual
       FROM prediction_log p
       JOIN outcome_log o ON p.url = o.url
       ORDER BY o.created_at DESC LIMIT 10`
    ).catch(() => []);

    const samples = sampleRows.map((s) => ({
      url: s.url,
      predicted: s.ecoscore,
      actual: s.actual === "ecommerce" ? 1 : 0,
      error: Math.abs(s.ecoscore - (s.actual === "ecommerce" ? 1 : 0)),
    }));

    return NextResponse.json({ ...report, samples });

  } catch (error) {
    console.error("Calibration API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
