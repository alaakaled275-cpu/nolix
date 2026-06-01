/**
 * app/api/auth/forgot-password/route.ts
 * NOLIX — Forgot Password Endpoint
 *
 * Flow:
 *  1. Receive email
 *  2. Check user exists
 *  3. Generate secure token (32 random bytes)
 *  4. Save token + expiry to DB (password_reset_token, password_reset_expires)
 *  5. Send email via Resend with reset link
 *  6. Return success (even if email not found — prevents user enumeration)
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/schema";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// Token expires in 1 hour
const TOKEN_EXPIRY_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check user exists
    const users = await query<any>(
      "SELECT id, name FROM users WHERE email = $1 LIMIT 1",
      [normalizedEmail]
    );

    // SECURITY: Always return success — prevent user enumeration attacks
    if (users.length === 0) {
      return NextResponse.json({ success: true, message: "If that email exists, a reset link was sent." });
    }

    const user = users[0];

    // Generate cryptographically secure token
    const token   = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString();

    // Ensure columns exist (idempotent — safe to call on old schema)
    try {
      await query(`
        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS password_reset_token   TEXT,
          ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ
      `, []);
    } catch { /* columns already exist — ignore */ }

    // Save token to DB
    await query(
      `UPDATE users
         SET password_reset_token   = $1,
             password_reset_expires = $2
       WHERE email = $3`,
      [token, expires, normalizedEmail]
    );

    // Build reset URL
    const baseUrl   = process.env.NOLIX_API_BASE || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const resetLink = `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;

    // Send email via Resend
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (RESEND_API_KEY) {
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from:    "Nolix <noreply@nolix.ai>",
            to:      [normalizedEmail],
            subject: "Reset your Nolix password",
            html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0c0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#111311;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#0d2c1a,#111311);padding:32px 32px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
      <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px;">Nolix</div>
      <div style="font-size:12px;color:#10b981;margin-top:2px;font-family:monospace;">Revenue Brain</div>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#fff;font-size:20px;font-weight:700;margin:0 0 12px;">Reset your password</h2>
      <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Hi ${user.name || "there"},<br><br>
        We received a request to reset the password for your Nolix account. Click the button below to set a new password.
      </p>
      <a href="${resetLink}"
         style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;
                padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;">
        Reset Password
      </a>
      <p style="color:#6b7280;font-size:13px;margin:24px 0 0;">
        This link expires in <strong style="color:#f59e0b;">1 hour</strong>. If you didn't request this, ignore this email.
      </p>
      <p style="color:#374151;font-size:11px;margin:16px 0 0;word-break:break-all;">
        Or copy this link: ${resetLink}
      </p>
    </div>
  </div>
</body>
</html>`,
          }),
        });

        if (!emailRes.ok) {
          const err = await emailRes.text();
          console.error("[FORGOT-PASSWORD] Resend error:", err);
        }
      } catch (emailErr) {
        console.error("[FORGOT-PASSWORD] Email send failed:", emailErr);
      }
    } else {
      // Dev mode — print link to console
      console.log(`\n[FORGOT-PASSWORD] DEV MODE — No RESEND_API_KEY set.`);
      console.log(`[FORGOT-PASSWORD] Reset link for ${normalizedEmail}:`);
      console.log(`${resetLink}\n`);
    }

    return NextResponse.json({ success: true, message: "If that email exists, a reset link was sent." });

  } catch (error: any) {
    console.error("[FORGOT-PASSWORD] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
