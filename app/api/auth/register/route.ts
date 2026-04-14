import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/schema";
import { hashPassword, setSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, name, password, confirm_password } = await req.json();

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
    let newUser;

    if (existing.length > 0) {
      const existingUser = existing[0];
      
      // If the existing user doesn't have a password, it means they registered via Google.
      // We will allow them to "upgrade" their account by setting a password now.
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
      // Complete New Registration
      const insertResult = await query<any>(
        "INSERT INTO users (email, name, password_hash, provider) VALUES ($1, $2, $3, 'local') RETURNING id, email, name, provider, store_url, store_verified",
        [email, name || "User", hashedPassword]
      );
      newUser = insertResult[0];
    }

    // Set secure HTTP-only cookie session
    await setSession({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      provider: newUser.provider,
      store_url: newUser.store_url,
      store_verified: newUser.store_verified
    });

    return NextResponse.json({ success: true, user: newUser }, { status: 201 });
  } catch (error: any) {
    console.error("[AUTH REGISTER ERROR]", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
