import { NextRequest, NextResponse } from "next/server";
import { markWinner } from "@/lib/nolix-experiment-analytics";
import { getAccessTier, requireTier } from "@/lib/nolix-security";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-nolix-key");
  if (!requireTier(getAccessTier(key), "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { experiment_id, variant_id } = await req.json();
    if (!experiment_id || !variant_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await markWinner(experiment_id, variant_id);

    return NextResponse.json({ success: true, message: `Winner ${variant_id} successfully promoted.` });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to declare winner", message: err.message }, { status: 500 });
  }
}
