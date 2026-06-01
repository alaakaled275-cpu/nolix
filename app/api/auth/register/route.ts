import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/schema";
import { hashPassword, setSession } from "@/lib/auth";
import { createStoreForUser } from "@/lib/store-auth";

export async function POST(req: NextRequest) {
  try {
    const { email, name, password, confirm_password, store_url } = await req.json();

    if (!email || !password || !confirm_password) {
      return NextResponse.json({ error: "Email, password, and confirm_password are required." }, { status: 400 });
    }

    if (password !== confirm_password) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long." }, { status: 400 });
    }

    // Check if email already exists
    const existing = await query<any>("SELECT id, password_hash FROM users WHERE email = $1", [email]);
    const hashedPassword = await hashPassword(password);
    let newUser: any;

    if (existing.length > 0) {
      const existingUser = existing[0];

      // If registered via Google and no password → allow setting password
      if (!existingUser.password_hash) {
        const updateResult = await query<any>(
          "UPDATE users SET password_hash = $1, name = COALESCE(name, $2) WHERE email = $3 RETURNING id, email, name, provider, store_url, store_verified",
          [hashedPassword, name || "User", email]
        );
        newUser = updateResult[0];
      } else {
        return NextResponse.json({ error: "Email is already registered. Please log in." }, { status: 409 });
      }
    } else {
      // New registration
      const insertResult = await query<any>(
        "INSERT INTO users (email, name, password_hash, provider, store_url) VALUES ($1, $2, $3, 'local', $4) RETURNING id, email, name, provider, store_url, store_verified",
        [email, name || "User", hashedPassword, store_url || null]
      );
      newUser = insertResult[0];
    }

    // ── PHASE 1: Generate Store API Keys for new user ──────────────────────────
    // Every user gets a store record with public_key + secret_key on registration.
    // public_key → embedded in master.js script tag as window.NOLIX.store_key
    // secret_key → used for server-to-server HMAC verification
    let storeKeys: { public_key: string; secret_key: string } | null = null;
    if (newUser?.id) {
      try {
        const domain = store_url
          ? store_url.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase()
          : `user-${newUser.id.substring(0, 8)}`;

        const store = await createStoreForUser(newUser.id, domain);
        storeKeys = { public_key: store.public_key, secret_key: store.secret_key };
      } catch (storeErr) {
        // Non-fatal — user still created, keys can be generated later
        console.warn("[REGISTER] Store key generation failed (non-fatal):", storeErr);
      }
    }

    // Set secure HTTP-only cookie session
    await setSession({
      id:             newUser.id,
      email:          newUser.email,
      name:           newUser.name,
      provider:       newUser.provider,
      store_url:      newUser.store_url,
      store_verified: newUser.store_verified,
    });

    return NextResponse.json({
      success: true,
      user:    newUser,
      // Return keys once on registration — client should save public_key
      store_keys: storeKeys ? { public_key: storeKeys.public_key } : null,
      message: "Account created. Your API key has been generated.",
    }, { status: 201 });

  } catch (error: any) {
    console.error("[AUTH REGISTER ERROR]", error);
    if (error.code === "ECONNREFUSED") {
      return NextResponse.json({ error: "Database offline." }, { status: 503 });
    }
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
