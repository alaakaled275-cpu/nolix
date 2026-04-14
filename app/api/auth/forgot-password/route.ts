import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/schema";
import crypto from "crypto";
import { Resend } from "resend";
import { getEnv } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const env = getEnv();
    const resend = new Resend(env.RESEND_API_KEY || "dummy_key");

    // Check if user exists
    const result = await query<any>("SELECT id, name FROM users WHERE email = $1", [email]);
    if (result.length === 0) {
      // Return 200 anyway to prevent email enumeration
      return NextResponse.json({ success: true, message: "If an account exists, a reset link was sent." }, { status: 200 });
    }

    const user = result[0];

    // Generate reset token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    // Save token to DB
    await query("UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3", [tokenHash, expiry, user.id]);

    // Send Email
    const resetUrl = `${process.env.NODE_ENV === "production" ? "https://nolix.vercel.app" : "http://localhost:3000"}/reset-password?token=${rawToken}`;
    
    // Attempt sending via Resend
    try {
      await resend.emails.send({
        from: "NOLIX Team <noreply@resend.dev>", // Change this when domain is verified
        to: email,
        subject: "Reset your NOLIX Password",
        html: `
          <h2>Password Reset Request</h2>
          <p>Hi ${user.name || "there"},</p>
          <p>You requested a password reset for your NOLIX account. Click the button below to set a new password:</p>
          <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#ef4444;color:#FFF;text-decoration:none;border-radius:6px;font-weight:bold;">Reset Password</a>
          <p><br>If you didn't request this, you can ignore this email.</p>
        `,
      });
      console.log("[AUTH RESEND] Sent reset email to:", email, "URL:", resetUrl);
    } catch (e: any) {
      console.error("[AUTH RESEND ERROR] Failed to send email via Resend:", e);
      // Even if Resend fails in development, output the link so the user can test locally
      console.log("[AUTH] Reset URL for manual testing:", resetUrl);
    }

    return NextResponse.json({ success: true, message: "If an account exists, a reset link was sent." }, { status: 200 });
  } catch (error: any) {
    console.error("[AUTH FORGOT PWD ERROR]", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
