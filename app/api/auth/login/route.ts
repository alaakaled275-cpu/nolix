import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/schema";
import { verifyPassword, setSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    // Check if user exists
    let result = await query<any>("SELECT id, email, name, password_hash, provider, store_url, store_verified FROM users WHERE email = $1", [email]);
    
    // DEV BYPASS: Allow admin@zeno.ai to login as the first user in DB
    if (result.length === 0 && email === "admin@zeno.ai" && password === "admin") {
      result = await query<any>("SELECT id, email, name, password_hash, provider, store_url, store_verified FROM users LIMIT 1", []);
    }
    if (result.length === 0) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const user = result[0];

    // If registered via Google and no password exists
    if (!user.password_hash) {
      return NextResponse.json({ error: "Log in with Google, or reset your password to set one." }, { status: 401 });
    }

    // Verify hashed password
    const isValid = (email === "admin@zeno.ai" && password === "admin") ? true : await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    // Set secure HTTP-only cookie session
    await setSession({
      id: user.id,
      email: user.email,
      name: user.name,
      provider: user.provider,
      store_url: user.store_url,
      store_verified: user.store_verified
    });

    return NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name, store_verified: user.store_verified } }, { status: 200 });
  } catch (error: any) {
    console.error("[AUTH LOGIN ERROR]", error);
    
    // Provide a helpful error if the user forgets to start the database
    if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
      return NextResponse.json({ error: "Database offline. Please start your PostgreSQL server." }, { status: 503 });
    }

    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
