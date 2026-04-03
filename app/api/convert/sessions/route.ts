import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/schema";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);

    const sessions = await query<{
      id: string;
      session_id: string;
      ab_variant: string;
      time_on_site: number;
      pages_viewed: number;
      traffic_source: string;
      cart_status: string;
      device: string;
      intent_score: number;
      intent_level: string;
      show_popup: boolean;
      offer_type: string | null;
      message: string | null;
      reasoning: string | null;
      converted: boolean;
      created_at: string;
    }>(
      `SELECT * FROM popup_sessions ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );

    // CSV export support
    const format = searchParams.get("format");
    if (format === "csv") {
      const headers = [
        "id","session_id","ab_variant","time_on_site","pages_viewed",
        "traffic_source","cart_status","device","intent_score","intent_level",
        "show_popup","offer_type","converted","created_at"
      ];
      const rows = sessions.map(s =>
        headers.map(h => {
          const v = (s as Record<string, unknown>)[h];
          return typeof v === "string" && v.includes(",") ? `"${v}"` : String(v ?? "");
        }).join(",")
      );
      const csv = [headers.join(","), ...rows].join("\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="sessions_${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({ sessions, total: sessions.length });
  } catch (err) {
    console.error("[sessions] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
