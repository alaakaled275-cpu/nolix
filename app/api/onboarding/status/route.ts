import { NextRequest, NextResponse } from "next/server";
import { evaluateOnboardingProgress } from "@/lib/nolix-onboarding-engine";
import { getAccessTier, requireTier } from "@/lib/nolix-security";

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-nolix-key");
  if (!requireTier(getAccessTier(key), "read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session_id = new URL(req.url).searchParams.get("session_id");
  if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

  try {
    const progress = await evaluateOnboardingProgress(session_id);
    
    // Check if blocked
    if (progress.next_action.blocked_reason) {
      return NextResponse.json({
        success: true,
        progress,
        status: "blocked",
        reason: progress.next_action.blocked_reason,
        fix: progress.next_action.fix_suggestion
      });
    }

    return NextResponse.json({ success: true, progress });
  } catch (err: any) {
    return NextResponse.json({ error: "Status failed", message: err.message }, { status: 500 });
  }
}
