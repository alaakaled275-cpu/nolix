import { NextRequest, NextResponse } from "next/server";
import { getAccessTier, requireTier } from "@/lib/nolix-security";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-nolix-key") || req.headers.get("x-nolix-sync-secret");
  if (!requireTier(getAccessTier(key), "read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = new URL(req.url).searchParams.get("type");
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") || "100"), 500);

  try {
    let q = `SELECT * FROM nolix_structured_events`;
    const params: any[] = [];
    
    if (type) {
      q += ` WHERE type = $1 ORDER BY created_at DESC LIMIT $2`;
      params.push(type, limit);
    } else {
      q += ` ORDER BY created_at DESC LIMIT $1`;
      params.push(limit);
    }

    const rows = await query(q, params);
    
    return NextResponse.json({ 
      success: true, 
      count: rows.length,
      events: rows 
    });
  } catch (e: any) {
    return NextResponse.json({ error: "DB Error", message: e.message }, { status: 500 });
  }
}
