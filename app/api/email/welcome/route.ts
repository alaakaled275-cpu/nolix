/**
 * /app/api/email/welcome/route.ts
 * Send onboarding welcome email after store activates Nolix
 *
 * POST /api/email/welcome
 * Body: { store_domain, store_email, owner_name?, plan? }
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json(
      { status: "skipped", reason: "RESEND_API_KEY not configured" },
      { status: 200 }
    );
  }

  try {
    const {
      store_domain,
      store_email,
      owner_name = "Store Owner",
      plan = "starter",
    } = await req.json();

    if (!store_domain || !store_email) {
      return NextResponse.json(
        { error: "store_domain and store_email required" },
        { status: 400 }
      );
    }

    const dashboardUrl = `${process.env.NOLIX_API_BASE || "https://nolix.ai"}/dashboard`;
    const scriptTag = `&lt;script src="${process.env.NOLIX_API_BASE || "https://nolix.ai"}/nolix.js" data-domain="${store_domain}" async&gt;&lt;/script&gt;`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Welcome to Nolix</title>
</head>
<body style="margin:0;padding:0;background:#050508;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#0d0d14;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a0533,#0d0d14);padding:40px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
      <div style="font-size:28px;font-weight:900;color:#f1f5f9;letter-spacing:-1px;">
        Nolix<span style="color:#7c3aed;">.ai</span>
      </div>
      <div style="margin-top:8px;font-size:13px;color:#64748b;letter-spacing:2px;text-transform:uppercase;">
        Revenue Intelligence Engine
      </div>
    </div>

    <!-- Body -->
    <div style="padding:40px;">
      <h1 style="color:#f8fafc;font-size:24px;font-weight:700;margin:0 0 12px;">
        🎉 Welcome, ${owner_name}!
      </h1>
      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Nolix is now connected to <strong style="color:#e2e8f0;">${store_domain}</strong>
        on the <strong style="color:#a78bfa;">${plan}</strong> plan.
        Zeno AI will start monitoring your visitors and recovering lost revenue automatically.
      </p>

      <!-- What happens next -->
      <div style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:12px;padding:24px;margin-bottom:24px;">
        <div style="font-size:13px;font-weight:700;color:#a78bfa;letter-spacing:1px;text-transform:uppercase;margin-bottom:16px;">
          What happens in the next 24 hours
        </div>
        ${[
          ["🔍", "Zeno AI scans your store's visitor patterns"],
          ["🧠", "Baseline conversion rate is measured"],
          ["💡", "First hesitation offers go live"],
          ["📊", "Your dashboard shows real data"],
        ].map(([icon, text]) => `
          <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
            <span style="font-size:18px;">${icon}</span>
            <span style="color:#cbd5e1;font-size:14px;line-height:1.5;">${text}</span>
          </div>
        `).join("")}
      </div>

      <!-- Script installation reminder if not verified -->
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="font-size:13px;font-weight:600;color:#64748b;margin-bottom:10px;">Your Nolix script tag</div>
        <code style="font-family:monospace;font-size:12px;color:#7c3aed;display:block;word-break:break-all;line-height:1.6;">
          ${scriptTag}
        </code>
        <div style="margin-top:10px;font-size:12px;color:#475569;">
          Paste this just before &lt;/head&gt; in your Shopify theme (Online Store → Themes → Edit Code → theme.liquid)
        </div>
      </div>

      <!-- CTA -->
      <a href="${dashboardUrl}"
         style="display:block;text-align:center;background:linear-gradient(135deg,#7c3aed,#9333ea);color:#fff;font-weight:700;font-size:15px;padding:16px 24px;border-radius:10px;text-decoration:none;margin-bottom:32px;">
        Go to My Dashboard →
      </a>

      <!-- Support -->
      <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;">
        <p style="color:#475569;font-size:13px;margin:0;text-align:center;">
          Questions? Reply to this email or reach us at
          <a href="mailto:support@nolix.ai" style="color:#7c3aed;">support@nolix.ai</a>
        </p>
      </div>
    </div>

  </div>
  <p style="text-align:center;color:#1e293b;font-size:11px;margin-top:20px;">
    Nolix Intelligence · You only pay for attributed conversions.
  </p>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        from:    "Nolix <welcome@nolix.ai>",
        to:      [store_email],
        subject: `🎉 Nolix is now live on ${store_domain}`,
        html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: "Email send failed", detail: result },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success:  true,
      email_id: result.id,
      to:       store_email,
      store:    store_domain,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
