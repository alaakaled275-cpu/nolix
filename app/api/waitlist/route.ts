import { NextResponse } from "next/server";
import { query, ensureConvertAISchema } from "@/lib/schema";
import { z } from "zod";

const waitlistSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  name: z.string().optional(),
  storeUrl: z.string().optional(),
  quizAnswers: z.any().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = waitlistSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { email, name, storeUrl, quizAnswers } = parsed.data;

    await ensureConvertAISchema();

    // Check if email already exists
    const existing = await query("SELECT id FROM waitlist WHERE email = $1", [email]);
    const existingRows = (existing as any).rows || (existing as any[]);
    
    // Step 2 Submission (Update with name, storeUrl, and quizAnswers)
    if (name || storeUrl || quizAnswers) {
      const qz = quizAnswers ? JSON.stringify(quizAnswers) : null;
      if (existingRows.length === 0) {
        // They should have registered first, but we can insert anyway just in case
        await query("INSERT INTO waitlist (email, name, store_url, quiz_answers) VALUES ($1, $2, $3, $4)", [email, name || null, storeUrl || null, qz]);
      } else {
        await query("UPDATE waitlist SET name = COALESCE($1, name), store_url = COALESCE($2, store_url), quiz_answers = COALESCE($3, quiz_answers) WHERE email = $4", [name || null, storeUrl || null, qz, email]);
      }
      return NextResponse.json({ success: true, message: "Details saved successfully!" });
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
