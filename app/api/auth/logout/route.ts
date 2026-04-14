import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    await clearSession();
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("[AUTH LOGOUT ERROR]", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
