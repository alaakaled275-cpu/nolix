/**
 * app/api/convert/sessions/route.ts
 * NOLIX — Recent popup sessions for the dashboard
 *
 * SECURITY FIX:
 *  - Added mandatory auth (was completely open — ANY caller got ALL tenants' sessions)
 *  - Now uses queryForTenant → RLS-scoped to the authenticated user's store domain
 *  - Returns 401 if not authenticated, empty array if no store configured
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/schema";
import { queryForTenant } from "@/lib/nolix-rls";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    // ── [1] AUTH — mandatory (previously missing — critical security hole) ─────
    const session = await getSession();
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── [2] RESOLVE TENANT — derive store_domain from the authenticated user ───
    const userRows = await query<{ store_url: string | null }>(
      `SELECT store_url FROM users WHERE email = $1 LIMIT 1`,
      [session.email]
    );
    const storeUrl    = userRows[0]?.store_url ?? null;
    let   storeDomain = "unknown";
    if (storeUrl) {
      try {
        storeDomain = new URL(
          storeUrl.startsWith("http") ? storeUrl : `https://${storeUrl}`
        ).hostname.replace(/^www\./, "");
      } catch {
        storeDomain = storeUrl.replace(/^www\./, "").replace(/\/.*$/, "");
      }
    }

    // No store configured yet → return empty (not an error)
    if (!storeDomain || storeDomain === "unknown") {
      return NextResponse.json({
        sessions: [],
        total: 0,
        reason: "No store configured. Complete onboarding to see session data.",
      });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);

    // ── [3] QUERY — RLS-scoped to this tenant (only this store's sessions) ────
    const sessions = await queryForTenant<{
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
      [limit],
      storeDomain
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
          "Content-Disposition": `attachment; filename="sessions_${storeDomain}_${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({ sessions, total: sessions.length, store_domain: storeDomain });
  } catch (err) {
    console.error("[sessions] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
