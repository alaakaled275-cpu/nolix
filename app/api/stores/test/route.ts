/**
 * app/api/stores/test/route.ts
 * Trigger a test decision on a store to verify the script is working.
 * 
 * This sends a synthetic session event to the decision engine
 * using the store's public_key, simulating a real visitor.
 * Returns the AI decision to confirm the loop is active.
 * 
 * Endpoint: POST /api/stores/test
 * Body: { domain?: string } — optional, uses user's primary store
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getStoreForUser } from "@/lib/store-auth";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = await getStoreForUser(session.id);
  if (!store) {
    return NextResponse.json({ error: "No store found. Add a store URL in Settings first." }, { status: 404 });
  }

  const testSessionId = `test_${uuidv4().replace(/-/g, "").slice(0, 24)}`;

  const syntheticEvent = {
    session_id: testSessionId,
    timestamp: new Date().toISOString(),
    source: "dashboard_test",
    store_domain: store.domain,
    public_key: store.public_key,
    visitor: {
      time_on_site: 45,
      pages_viewed: 3,
      scroll_depth: 0.7,
      mouse_moves: 82,
      idle_time: 12,
      device: "desktop",
      country: "US",
    },
    cart: {
      status: "present",
      value: 127.50,
      items: 2,
    },
    traffic: {
      source: "direct",
      medium: "none",
      campaign: "none",
    },
  };

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const trackRes = await fetch(`${baseUrl}/api/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": store.public_key,
      },
      body: JSON.stringify(syntheticEvent),
      signal: AbortSignal.timeout(15000),
    });

    const decision = await trackRes.json();

    return NextResponse.json({
      test_id: testSessionId,
      store_domain: store.domain,
      store_status: store.active ? "active" : "inactive",
      plan: store.plan,
      triggered_at: new Date().toISOString(),
      synthetic_visitor: syntheticEvent.visitor,
      decision,
      success: trackRes.ok,
      note: trackRes.ok
        ? "Test successful! Script is active on your store."
        : "Test failed. Check your script installation.",
    });
  } catch (err: any) {
    return NextResponse.json({
      test_id: testSessionId,
      store_domain: store.domain,
      triggered_at: new Date().toISOString(),
      success: false,
      error: err.message || "Failed to reach decision engine",
      note: "Ensure your server is running and the track API is accessible.",
    });
  }
}