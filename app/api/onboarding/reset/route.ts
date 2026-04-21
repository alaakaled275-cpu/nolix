import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAccessTier, requireTier } from "@/lib/nolix-security";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-nolix-key");
  if (!requireTier(getAccessTier(key), "admin")) {
    return NextResponse.json({ error: "Unauthorized. Admin required for reset." }, { status: 401 });
  }

  try {
    const { session_id, workspace_id } = await req.json();
    if (!session_id && !workspace_id) return NextResponse.json({ error: "Missing parameter" }, { status: 400 });

    if (session_id) {
       await query(`DELETE FROM nolix_onboarding_sessions WHERE id = $1`, [session_id]);
       await query(`DELETE FROM nolix_onboarding_metrics WHERE session_id = $1`, [session_id]);
    } else {
       await query(`DELETE FROM nolix_onboarding_sessions WHERE workspace_id = $1`, [workspace_id]);
    }

    return NextResponse.json({ success: true, message: "Onboarding state eradicated" });
  } catch (err: any) {
    return NextResponse.json({ error: "Reset failed", message: err.message }, { status: 500 });
  }
}
