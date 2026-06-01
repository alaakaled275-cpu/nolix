/**
 * app/api/stores/check/route.ts
 * Verify that a script is properly installed on a store domain.
 * 
 * Endpoint: GET /api/stores/check?domain=https://store.com
 * Returns: { installed: boolean, script_found: boolean, error?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain");

  if (!domain) {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }

  try {
    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
    const checkUrl = `https://${cleanDomain}`;
    
    const response = await fetch(checkUrl, {
      method: "GET",
      signal: AbortSignal.timeout(10000),
    });

    const html = await response.text();

    const hasNolixScript = html.includes(" Nolix") || 
                           html.includes("nolix") || 
                           html.includes("NOLIX") ||
                           html.includes("zeno.ai") ||
                           html.includes("zenox") ||
                           html.includes("master.js");

    const hasMetaTag = html.includes(" Nolix") || html.includes("x-nolix");

    return NextResponse.json({
      domain: cleanDomain,
      checked_at: new Date().toISOString(),
      installed: hasNolixScript,
      script_found: hasMetaTag,
      http_status: response.status,
      has_https: checkUrl.startsWith("https"),
      recommendation: hasNolixScript 
        ? "Script detected! Your store is protected."
        : "Script not found. Add the NOLIX script to your store.",
    });
  } catch (err: any) {
    const isTimeout = err.name === "TimeoutError" || err.message?.includes("timeout");
    const isFetchError = err.message?.includes("fetch") || err.message?.includes("ENOTFOUND");

    return NextResponse.json({
      domain,
      checked_at: new Date().toISOString(),
      installed: false,
      script_found: false,
      error: isTimeout ? "timeout" : isFetchError ? "unreachable" : err.message,
      recommendation: isTimeout 
        ? "Store took too long to respond. Make sure it's accessible and try again."
        : isFetchError
        ? "Cannot reach this domain. Check the URL and ensure your store is online."
        : "Error checking store.",
    });
  }
}