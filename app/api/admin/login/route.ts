import { NextResponse } from "next/server";

const ADMIN_EMAIL = "alaakaled275@gmail.com";
const ADMIN_PASSWORD = "wfwf8834__:;<.'\"=)9@0138126Jygtcw";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = (body.email || "").trim();
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    // Direct comparison
    const emailMatch = email === ADMIN_EMAIL;
    const passwordMatch = password === ADMIN_PASSWORD;

    if (!emailMatch || !passwordMatch) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');
    
    return NextResponse.json({ 
      success: true, 
      token,
      admin: {
        email: ADMIN_EMAIL,
        name: "Main Admin",
        role: "main"
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Admin login API" });
}