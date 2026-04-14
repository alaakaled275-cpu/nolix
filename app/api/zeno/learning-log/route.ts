/**
 * app/api/zeno/learning-log/route.ts
 * GET  — fetch recent learning log entries for Dashboard / ZenoChat
 * POST — (internal) save a new learning entry after analysis
 */
import { NextRequest, NextResponse } from "next/server";
import { ensureNolixSchema, query } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await ensureNolixSchema();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);

    const result = await query(
      `SELECT id, url, business_model, error_type, error_description, correction_rule,
              confidence_before, confidence_after, phase, created_at
       FROM zeno_learning_log
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    return NextResponse.json({ entries: result, count: result.length });
  } catch (err: any) {
    console.error("[zeno/learning-log GET] error:", err);
    return NextResponse.json({ entries: [], count: 0 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureNolixSchema();
    const body = await req.json();
    const { url, business_model, entries } = body as {
      url: string;
      business_model: string;
      entries: {
        error_type: string;
        error_description: string;
        correction_rule: string;
        confidence_before: number;
        confidence_after: number;
        phase: string;
      }[];
    };

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ saved: 0 });
    }

    let saved = 0;
    for (const e of entries) {
      await query(
        `INSERT INTO zeno_learning_log
           (url, business_model, error_type, error_description, correction_rule, confidence_before, confidence_after, phase)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          url,
          business_model ?? "Unknown",
          e.error_type,
          e.error_description,
          e.correction_rule,
          e.confidence_before ?? 0,
          e.confidence_after ?? 0,
          e.phase ?? "general",
        ]
      );
      saved++;
    }

    return NextResponse.json({ saved });
  } catch (err: any) {
    console.error("[zeno/learning-log POST] error:", err);
    return NextResponse.json({ saved: 0, error: err.message }, { status: 500 });
  }
}
