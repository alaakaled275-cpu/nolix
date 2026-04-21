import { NextRequest, NextResponse } from "next/server";
import { runLearningCycle } from "@/lib/nolix-strategy-controller";

// Used by external CRON platforms (e.g. Vercel Cron, GitHub Actions)
export async function GET(req: NextRequest) {
  const cronKey = req.headers.get("Authorization");
  // Simple check
  if (cronKey !== `Bearer ${process.env.CRON_SECRET || "nolix_cron_secret"}`) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await runLearningCycle();

  return NextResponse.json({ success: true });
}
