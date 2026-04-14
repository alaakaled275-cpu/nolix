import { NextRequest, NextResponse } from "next/server";
import { scrapeStore } from "@/lib/scraper";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ success: false, error: "Missing URL" });

    // Use the scraper to check if reachable
    const signals = await scrapeStore(url);
    
    if (!signals.reachable) {
      return NextResponse.json({ 
        success: false, 
        reachable: false,
        error: "Target infrastructure is not responding or rejecting connections." 
      });
    }

    return NextResponse.json({ 
      success: true, 
      reachable: true,
      fingerprint: {
        platform: signals.platform.value || "Custom",
        title: signals.title.value,
        wordCount: signals.wordCount
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
