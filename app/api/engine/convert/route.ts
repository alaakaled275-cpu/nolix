import { NextRequest, NextResponse } from "next/server";
import { query, ensureNolixSchema } from "@/lib/schema";

export async function POST(req: NextRequest) {
  try {
    await ensureNolixSchema();
    const { session_id, action } = await req.json();

    if (!session_id) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    // Mark session as converted
    await query(
      `UPDATE popup_sessions 
       SET converted = true, 
           influenced_by_system = true,
           order_value = 85.00
       WHERE session_id = $1`,
      [session_id]
    );

    // CLOSE THE LEARNING LOOP: Find what intent & friction this session had
    const sessionRes = await query(
      `SELECT intent_level, friction_detected, action_taken 
       FROM popup_sessions 
       WHERE session_id = $1 LIMIT 1`,
      [session_id]
    );

    if (sessionRes.length > 0) {
      const s = sessionRes[0] as any;
      const intentCat = s.intent_level || 'low';
      const frictionTyp = s.friction_detected || 'none';
      const actTaken = s.action_taken || action;

      await query(
        `UPDATE zeno_action_metrics 
         SET conversions = conversions + 1,
             revenue_earned = revenue_earned + 85.00,
             updated_at = now()
         WHERE intent_category = $1 AND friction_type = $2 AND action_name = $3`,
        [intentCat, frictionTyp, actTaken]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Zeno Engine] Convert failed:", err.message);
    return NextResponse.json({ error: "DB Error" }, { status: 500 });
  }
}
