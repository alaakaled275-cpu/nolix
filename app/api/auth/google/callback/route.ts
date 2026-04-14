import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/schema";
import { setSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    
    if (!code) {
      return NextResponse.redirect(new URL("/login?error=NoCodeProvided", req.url));
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${process.env.NODE_ENV === "production" ? "https://nolix.vercel.app" : "http://localhost:3000"}/api/auth/google/callback`;

    if (!clientId || !clientSecret) {
      throw new Error("Missing Google OAuth credentials in environment.");
    }

    // Exchange code for token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      throw new Error(tokenData.error_description || "Token exchange failed");
    }

    // Fetch user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    
    const googleUser = await userRes.json();
    if (!googleUser.email) {
      throw new Error("Google account must have an email attached.");
    }

    // Check DB
    const existingResult: any[] = await query("SELECT id, email, name, password_hash, provider, store_url, store_verified FROM users WHERE email = $1", [googleUser.email]);
    
    let user;
    let isNewUser = false;

    if (existingResult.length > 0) {
      user = existingResult[0];
      // If user registered with email previously and now signs in with Google, we just let them in.
    } else {
      isNewUser = true;
      // Insert new user without password (to be set later)
      const insertResult: any[] = await query(
        "INSERT INTO users (email, name, provider) VALUES ($1, $2, 'google') RETURNING id, email, name, provider, store_url, store_verified",
        [googleUser.email, googleUser.name]
      );
      user = insertResult[0];
    }

    // Provide auth cookie
    await setSession({
      id: user.id,
      email: user.email,
      name: user.name,
      provider: user.provider,
      store_url: user.store_url,
      store_verified: user.store_verified
    });

    // If new user, force them to set a password
    if (isNewUser || !user.password_hash) {
      return NextResponse.redirect(new URL("/complete-google-signup", req.url));
    }

    // Normal successful login
    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (error: any) {
    console.error("[GOOGLE OAUTH ERROR]", error);
    return NextResponse.redirect(new URL("/login?error=ProviderError", req.url));
  }
}
