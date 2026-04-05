import { NextResponse } from "next/server";
import { query, ensureConvertAISchema } from "@/lib/schema";
import { z } from "zod";

const waitlistSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  name: z.string().optional(),
  storeUrl: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = waitlistSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { email, name, storeUrl } = parsed.data;

    await ensureConvertAISchema();

    // Check if email already exists
    const existing = await query("SELECT id FROM waitlist WHERE email = $1", [email]);
    const existingRows = (existing as any).rows || (existing as any[]);
    
    // Step 2 Submission (Update with name and storeUrl)
    if (name || storeUrl) {
      if (existingRows.length === 0) {
        // They should have registered first, but we can insert anyway just in case
        await query("INSERT INTO waitlist (email, name, store_url) VALUES ($1, $2, $3)", [email, name || null, storeUrl || null]);
      } else {
        await query("UPDATE waitlist SET name = $1, store_url = $2 WHERE email = $3", [name, storeUrl, email]);
      }
      return NextResponse.json({ success: true, message: "Thank you for completing your registration!" });
    }

    // Step 1 Submission
    if (existingRows.length > 0) {
      return NextResponse.json({ error: "Email is already on the waitlist." }, { status: 400 });
    }

    // Insert new email (Step 1)
    await query("INSERT INTO waitlist (email) VALUES ($1)", [email]);

    return NextResponse.json({ success: true, message: "Step 1 complete!" });
  } catch (error: any) {
    console.error("[Waitlist API Error]:", error);
    // Send actual error message during dev to help the user know why it failed
    return NextResponse.json({ error: error?.message || "Something went wrong. Please try again later." }, { status: 500 });
  }
}
