import { NextResponse } from "next/server";
import { query } from "@/lib/schema";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const adminKey = body.adminKey;

    if (adminKey !== "nolix_admin_reset_2024") {
      return NextResponse.json({ error: "Invalid admin key" }, { status: 401 });
    }

    await query("DELETE FROM waitlist");
    await query("DELETE FROM users");
    await query("DELETE FROM stores");
    await query("DELETE FROM popup_sessions");
    await query("DELETE FROM conversions");
    await query("DELETE FROM ai_decisions");
    await query("DELETE FROM user_events");
    await query("DELETE FROM zeno_action_metrics");
    await query("DELETE FROM zeno_reality_logs");
    await query("DELETE FROM nolix_uplift_model");
    await query("DELETE FROM nolix_signal_outcomes");

    return NextResponse.json({ 
      success: true, 
      message: "All user data has been reset. System is ready for new users." 
    });
  } catch (error: any) {
    console.error("[Admin Reset] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: "ready",
    message: "POST with adminKey to reset all user data"
  });
}