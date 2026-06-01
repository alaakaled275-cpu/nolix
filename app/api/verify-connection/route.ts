import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function detectStoreConnection(domain: string): Promise<{
  connected: boolean;
  platform: string | null;
  method: string | null;
  confidence: "high" | "medium" | "low";
  details: string;
}> {
  const urls = [`https://www.${domain}`, `https://${domain}`];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NolixBot/1.0; +https://nolix.ai/bot)",
        },
        redirect: "follow",
      });

      const html = await res.text().catch(() => "");
      const lower = html.toLowerCase();
      const headers = Object.fromEntries(res.headers.entries());

      // --- Shopify Detection ---
      if (
        lower.includes("cdn.shopify.com") ||
        lower.includes("shopify.theme") ||
        lower.includes("myshopify.com") ||
        headers["x-shopid"] ||
        headers["x-shardid"]
      ) {
        // Check if Nolix script is already installed
        const hasNolixScript =
          lower.includes("nolix.ai/widget") ||
          lower.includes("nolix-widget") ||
          lower.includes("nolix_key");

        return {
          connected: hasNolixScript,
          platform: "Shopify",
          method: hasNolixScript ? "script_tag" : null,
          confidence: "high",
          details: hasNolixScript
            ? "Nolix script detected on your Shopify store."
            : "Shopify store detected. Install the Nolix script to connect.",
        };
      }

      // --- WooCommerce Detection ---
      if (lower.includes("woocommerce") || lower.includes("wp-content/plugins")) {
        const hasNolixScript =
          lower.includes("nolix.ai/widget") || lower.includes("nolix-widget");
        return {
          connected: hasNolixScript,
          platform: "WooCommerce",
          method: hasNolixScript ? "script_tag" : null,
          confidence: "high",
          details: hasNolixScript
            ? "Nolix script detected on your WooCommerce store."
            : "WooCommerce store detected. Add the Nolix script to your theme.",
        };
      }

      // --- Generic E-commerce ---
      if (
        lower.includes("add to cart") ||
        lower.includes("checkout") ||
        lower.includes("product") ||
        /\$[\d,]+/.test(html)
      ) {
        const hasNolixScript =
          lower.includes("nolix.ai/widget") || lower.includes("nolix-widget");
        return {
          connected: hasNolixScript,
          platform: "Custom Store",
          method: hasNolixScript ? "script_tag" : null,
          confidence: "medium",
          details: hasNolixScript
            ? "Nolix script found on your store."
            : "Store detected. Paste the Nolix script in your <head> tag to connect.",
        };
      }

      // Site reachable but doesn't look like a store
      return {
        connected: false,
        platform: null,
        method: null,
        confidence: "low",
        details: "This domain is reachable but doesn't appear to be an e-commerce store.",
      };
    } catch {
      continue;
    }
  }

  return {
    connected: false,
    platform: null,
    method: null,
    confidence: "low",
    details: "Could not reach the store. Check the URL and try again.",
  };
}

export async function POST(req: NextRequest) {
  try {
    const { domain } = await req.json();

    if (!domain) {
      return NextResponse.json({ error: "domain is required" }, { status: 400 });
    }

    const result = await detectStoreConnection(domain);

    return NextResponse.json({
      domain,
      ...result,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[verify-connection]", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
