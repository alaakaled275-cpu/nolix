/**
 * app/api/stores/me/route.ts
 * NOLIX — Get current user's store API keys
 *
 * Returns the store record for the authenticated user.
 * Used by the dashboard to display public_key for embedding in master.js.
 *
 * SECURITY:
 *  - secret_key is NEVER returned. Only public_key is safe to show.
 *  - Requires valid JWT session cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getStoreForUser, createStoreForUser } from "@/lib/store-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let store = await getStoreForUser(session.id);

    // Auto-create store if user doesn't have one yet (idempotent)
    if (!store) {
      const domain = session.store_url
        ? session.store_url.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase()
        : `user-${session.id.substring(0, 8)}`;

      store = await createStoreForUser(session.id, domain);
    }

    return NextResponse.json({
      store: {
        id:         store.id,
        domain:     store.domain,
        public_key: store.public_key,
        plan:       store.plan,
        active:     store.active,
        // secret_key intentionally omitted — never expose to browser
      },
      embed_snippet: `<!-- NOLIX Store Key -->\n<script>\n  window.NOLIX = window.NOLIX || {};\n  window.NOLIX.store_key = "${store.public_key}";\n</script>`,
      instructions: "Add your public_key to window.NOLIX.store_key BEFORE loading master.js",
    });

  } catch (error: any) {
    console.error("[STORES/ME] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// POST /api/stores/me — manually trigger key regeneration
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action } = await req.json().catch(() => ({ action: null }));

    if (action === "rotate_key") {
      const { rotatePublicKey, getStoreForUser: getStore } = await import("@/lib/store-auth");
      const store = await getStore(session.id);
      if (!store) {
        return NextResponse.json({ error: "No store found. Register first." }, { status: 404 });
      }
      const newKey = await rotatePublicKey(store.id);
      return NextResponse.json({
        success: true,
        message: "Public key rotated. Update your embed snippet.",
        new_public_key: newKey,
      });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
