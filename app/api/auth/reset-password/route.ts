import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/schema";
import crypto from "crypto";
import { hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { token, new_password, confirm_password } = await req.json();

    if (!token || !new_password || !confirm_password) {
      return NextResponse.json({ error: "Token, new_password, and confirm_password are required." }, { status: 400 });
    }

    if (new_password !== confirm_password) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    if (new_password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long." }, { status: 400 });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Verify token
    const result = await query<any>(
      "SELECT id FROM users WHERE reset_token = $1 AND reset_token_expiry > now()",
      [tokenHash]
    );

    if (result.length === 0) {
      return NextResponse.json({ error: "Invalid or expired reset token." }, { status: 400 });
    }

    const userId = result[0].id;
    const hashedPassword = await hashPassword(new_password);

    // Update password and clear token
    await query(
      "UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2",
      [hashedPassword, userId]
    );

    return NextResponse.json({ success: true, message: "Password updated successfully." }, { status: 200 });
  } catch (error: any) {
    console.error("[AUTH RESET PWD ERROR]", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
