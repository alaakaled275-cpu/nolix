import { NextResponse } from "next/server";
import { query, ensureConvertAISchema } from "@/lib/schema";
import { z } from "zod";

const waitlistSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = waitlistSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { email } = parsed.data;

    await ensureConvertAISchema();

    // Check if email already exists
    const existing = await query("SELECT id FROM waitlist WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: "Email is already on the waitlist." }, { status: 400 });
    }

    // Insert new email
    await query("INSERT INTO waitlist (email) VALUES ($1)", [email]);

    return NextResponse.json({ success: true, message: "Successfully joined the waitlist!" });
  } catch (error: any) {
    console.error("[Waitlist API Error]:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again later." }, { status: 500 });
  }
}
