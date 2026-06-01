import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { query } from "@/lib/db"; // Assuming this is the DB interface

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const storeUrl = req.nextUrl.searchParams.get("store");
  if (!storeUrl) {
    return NextResponse.json({ error: "Store URL required" }, { status: 400 });
  }

  // Normalize store URL
  let domain = storeUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (domain.startsWith("www.")) domain = domain.substring(4);
  const targetUrl = storeUrl.startsWith("http") ? storeUrl : `https://${domain}`;

  const report: Record<string, any> = {};

  // 1. VERIFY SCRIPT INSTALLATION (The absolute truth)
  try {
    const htmlRes = await fetch(targetUrl, { headers: { "User-Agent": "Nolix-Truth-Engine/1.0" } });
    const html = await htmlRes.text();
    if (html.includes("nolix.js") || html.includes("nolix.ai")) {
      report.script = { status: "pass", message: "السكربت مركب فعلياً في المتجر ✅" };
    } else {
      report.script = { status: "fail", message: "أنت لم تضع السكريبت أساساً في الكود الخاص بالمتجر ❌. لن يعمل أي شيء." };
    }
  } catch (err: any) {
    report.script = { status: "fail", message: `فشل في الوصول للمتجر: ${err.message}` };
  }

  // 2. VERIFY DATABASE CONNECTION
  try {
    await query("SELECT 1 as test");
    report.database = { status: "pass", message: "قاعدة البيانات متصلة وتعمل ✅" };
    
    // 2.1 Verify Real Events
    try {
      const events = await query("SELECT count(*) as c FROM rl_decisions WHERE domain = $1", [domain]);
      const count = parseInt(events[0]?.c || "0", 10);
      if (count > 0) {
        report.events = { status: "pass", message: `تم رصد ${count} أحداث حقيقية في قاعدة البيانات ✅` };
      } else {
        report.events = { status: "fail", message: "لم يصل أي حدث حقيقي من هذا المتجر للـ DB حتى الآن ❌" };
      }
    } catch (e: any) {
      report.events = { status: "fail", message: "لا توجد جداول حقيقية للأحداث أو فشل الاستعلام ❌" };
    }
  } catch (err: any) {
    report.database = { status: "fail", message: `قاعدة البيانات مفصولة (ECONNREFUSED) ❌. لن يُحفظ أي شيء.` };
    report.events = { status: "fail", message: "الـ DB مفصولة، لا يمكن التأكد من الأحداث ❌" };
  }

  // 3. VERIFY STRIPE BILLING
  if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes("YOUR_KEY_HERE")) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-03-25.dahlia" });
      await stripe.customers.list({ limit: 1 });
      report.billing = { status: "pass", message: "Stripe متصل ومستعد لفوترة العملاء ✅" };
    } catch (err: any) {
      report.billing = { status: "fail", message: `مفتاح Stripe غير صالح: ${err.message} ❌` };
    }
  } else {
    report.billing = { status: "fail", message: "مفاتيح Stripe غير موجودة أو وهمية. الفوترة لن تعمل ❌" };
  }

  return NextResponse.json({
    domain,
    report,
    is_ready: Object.values(report).every((r: any) => r.status === "pass")
  });
}
