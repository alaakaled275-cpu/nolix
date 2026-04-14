import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/schema";
import { getSession, setSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { storeUrl, analysis } = await req.json();

    if (!storeUrl) {
      return NextResponse.json({ error: "Store URL is required." }, { status: 400 });
    }

    // Clean URL
    let checkUrl = storeUrl.trim();
    if (!checkUrl.startsWith("http://") && !checkUrl.startsWith("https://")) {
      checkUrl = "https://" + checkUrl;
    }

    // Ping the URL
    console.log(`[VERIFY] Checking URL: ${checkUrl}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    let htmlText = "";
    try {
      const response = await fetch(checkUrl, {
        headers: {
          "User-Agent": "Zeno/1.0 (NOLIX Verification Bot)",
          "Accept": "text/html,application/xhtml+xml"
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP fetch failed: ${response.status}`);
      }

      htmlText = await response.text();
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      console.warn(`[VERIFY ERROR] Could not fetch ${checkUrl}: ${fetchErr.message}`);
      return NextResponse.json({ 
        error: "Could not reach the store URL. Ensure the site is live and the URL is correct."
      }, { status: 400 });
    }

    // Check for the script
    const hasScript = htmlText.includes("cdn.nolix.app/v1/master.js") || htmlText.includes("localhost:3000/master.js") || htmlText.includes("localhost:5173/master.js");

    if (!hasScript) {
      return NextResponse.json({ 
        verified: false,
        error: "Script not found. Please paste the provided script into the <head> of your website."
      }, { status: 400 });
    }

    // Verified! Update DB
    if (analysis) {
      await query(
        "UPDATE users SET store_url = $1, store_verified = true, store_analysis = $3 WHERE id = $2", 
        [storeUrl, session.id, analysis]
      );
    } else {
      await query(
        "UPDATE users SET store_url = $1, store_verified = true WHERE id = $2", 
        [storeUrl, session.id]
      );
    }
    // Update Session Cookie
    await setSession({
      ...session,
      store_url: storeUrl,
      store_verified: true
    });

    console.log(`[VERIFY SUCCESS] Script found on ${checkUrl} for user ${session.email}`);
    return NextResponse.json({ success: true, verified: true, store_url: storeUrl }, { status: 200 });

  } catch (error: any) {
    console.error("[VERIFY CATCH ERROR]", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
