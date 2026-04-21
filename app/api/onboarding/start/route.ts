import { NextRequest, NextResponse } from "next/server";
import { startOnboarding } from "@/lib/nolix-onboarding-engine";
import { getAccessTier, requireTier } from "@/lib/nolix-security";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-nolix-key");
  if (!requireTier(getAccessTier(key), "read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { workspace_id, demo } = await req.json();
    if (!workspace_id) return NextResponse.json({ error: "Missing workspace_id" }, { status: 400 });

    const result = await startOnboarding(workspace_id, { demo: !!demo });
    return NextResponse.json({ success: true, onboarding: result });
  } catch (err: any) {
    return NextResponse.json({ error: "Start failed", message: err.message }, { status: 500 });
  }
}
