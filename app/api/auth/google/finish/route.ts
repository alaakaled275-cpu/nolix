import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/schema";
import { hashPassword, getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { password, confirm_password } = await req.json();

    if (!password || !confirm_password) {
      return NextResponse.json({ error: "Password and confirm_password are required." }, { status: 400 });
    }

    if (password !== confirm_password) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long." }, { status: 400 });
    }

    const hashedPassword = await hashPassword(password);

    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [hashedPassword, session.id]);

    return NextResponse.json({ success: true, message: "Password updated successfully." }, { status: 200 });
  } catch (error: any) {
    console.error("[GOOGLE ALIGN PASSWORD ERROR]", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
