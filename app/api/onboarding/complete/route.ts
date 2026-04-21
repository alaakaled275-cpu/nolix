import { NextRequest, NextResponse } from "next/server";
import { markStepCompleted } from "@/lib/nolix-onboarding-engine";
import { getAccessTier, requireTier } from "@/lib/nolix-security";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-nolix-key");
  if (!requireTier(getAccessTier(key), "read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { session_id, step_id } = await req.json();
    if (!session_id || !step_id) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

    const success = await markStepCompleted(session_id, null, step_id);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ error: "Complete step failed", message: err.message }, { status: 500 });
  }
}
