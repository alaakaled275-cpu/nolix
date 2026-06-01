import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeUrl(raw: string): string | null {
  let url = raw.trim().toLowerCase();
  if (!url) return null;
  // Strip protocol if present
  url = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  // Take only hostname portion
  url = url.split("/")[0].split("?")[0];
  // Basic domain validation
  const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/;
  if (!domainRegex.test(url)) return null;
  return url;
}

async function checkReachability(domain: string): Promise<{
  reachable: boolean;
  statusCode?: number;
  finalUrl?: string;
  isShopify?: boolean;
  error?: string;
}> {
  const urls = [`https://www.${domain}`, `https://${domain}`, `http://www.${domain}`];

  for (const targetUrl of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(targetUrl, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; NolixBot/1.0; +https://nolix.ai/bot)",
          Accept:
            "text/html,application/xhtml+xml,application/xhtml;q=0.9,*/*;q=0.8",
        },
      });

      clearTimeout(timeout);

      const html = await res.text().catch(() => "");
      const isShopify =
        html.includes("Shopify.theme") ||
        html.includes("cdn.shopify.com") ||
        html.includes("shopify-features") ||
        html.includes("myshopify.com") ||
        res.headers.get("x-shopid") !== null ||
        res.headers.get("x-shardid") !== null;

      return {
        reachable: res.ok || res.status < 500,
        statusCode: res.status,
        finalUrl: res.url,
        isShopify,
      };
    } catch (err: any) {
      if (err?.name === "AbortError") {
        return { reachable: false, error: "timeout" };
      }
      // try next URL
      continue;
    }
  }

  return { reachable: false, error: "unreachable" };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawUrl: string = body.url ?? "";

    if (!rawUrl.trim()) {
      return NextResponse.json(
        { valid: false, error: "empty", message: "Please enter a store URL." },
        { status: 400 }
      );
    }

    const domain = normalizeUrl(rawUrl);
    if (!domain) {
      return NextResponse.json(
        {
          valid: false,
          error: "invalid_format",
          message:
            "That doesn't look like a valid website. Please enter a domain like yourstore.com",
        },
        { status: 400 }
      );
    }

    // Block obvious non-store domains
    const blocked = [
      "google.com", "facebook.com", "instagram.com", "twitter.com",
      "youtube.com", "tiktok.com", "amazon.com", "ebay.com",
      "localhost", "example.com", "test.com",
    ];
    if (blocked.some((b) => domain === b || domain.endsWith("." + b))) {
      return NextResponse.json(
        {
          valid: false,
          error: "blocked_domain",
          message:
            "We couldn't analyze this store. Please enter your own store's URL.",
        },
        { status: 400 }
      );
    }

    const reach = await checkReachability(domain);

    if (!reach.reachable) {
      return NextResponse.json(
        {
          valid: false,
          error: reach.error === "timeout" ? "timeout" : "unreachable",
          message:
            "We couldn't reach this website. Please check the URL and try again.",
          domain,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      valid: true,
      domain,
      normalizedUrl: `https://${domain}`,
      isShopify: reach.isShopify ?? false,
      statusCode: reach.statusCode,
    });
  } catch (err) {
    console.error("[validate-store]", err);
    return NextResponse.json(
      { valid: false, error: "server_error", message: "Validation failed. Please try again." },
      { status: 500 }
    );
  }
}
