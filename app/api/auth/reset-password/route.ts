/**
 * app/api/auth/reset-password/route.ts
 * NOLIX — Reset Password Endpoint
 *
 * Flow:
 *  1. Validate token, new_password, confirm_password
 *  2. Check if token is valid and not expired
 *  3. Hash new password
 *  4. Update user record (clear token/expiry, set new hash)
 *  5. Auto-login user (setSession)
 *  6. Return success
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/schema";
import { hashPassword, setSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { token, new_password, confirm_password } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Invalid or missing token." }, { status: 400 });
    }

    if (!new_password || new_password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long." }, { status: 400 });
    }

    if (new_password !== confirm_password) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    // Find user with this token where expiry > now
    const users = await query<any>(
      `SELECT id, email, name, provider, store_url, store_verified 
       FROM users 
       WHERE password_reset_token = $1 AND password_reset_expires > NOW()
       LIMIT 1`,
      [token]
    );

    if (users.length === 0) {
      return NextResponse.json({ error: "Invalid or expired reset token. Please request a new link." }, { status: 400 });
    }

    const user = users[0];

    // Hash the new password
    const hashedPassword = await hashPassword(new_password);

    // Update user: set new password, clear reset token
    await query(
      `UPDATE users 
       SET password_hash = $1, 
           password_reset_token = NULL, 
           password_reset_expires = NULL 
       WHERE id = $2`,
      [hashedPassword, user.id]
    );

    // Auto-login the user after successful reset
    await setSession({
      id: user.id,
      email: user.email,
      name: user.name,
      provider: user.provider,
      store_url: user.store_url,
      store_verified: user.store_verified,
    });

    return NextResponse.json({ success: true, message: "Password reset successful." });

  } catch (error: any) {
    console.error("[RESET-PASSWORD] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
