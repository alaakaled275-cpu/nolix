import { NextRequest, NextResponse } from "next/server";
import { simulateFirstValueDecision } from "@/lib/nolix-quickstart-engine";

export async function POST(req: NextRequest) {
  try {
    const result = await simulateFirstValueDecision();
    return NextResponse.json(result);
  } catch (err: any) {
     console.error("Simulation failed:", err);
     return NextResponse.json({ error: "Simulation failed", message: err.message }, { status: 500 });
  }
}
