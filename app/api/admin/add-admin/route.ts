import { NextResponse } from "next/server";
import { z } from "zod";

const addAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  adminToken: z.string(),
});

let additionalAdmins: Array<{email: string, password: string, name: string}> = [];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = addAdminSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { email, password, name, adminToken } = parsed.data;

    const adminEmail = Buffer.from(adminToken, 'base64').toString().split(':')[0];
    
    if (adminEmail !== "alaakaled2752gmail.com") {
      return NextResponse.json({ error: "Only main admin can add new admins" }, { status: 403 });
    }

    const existingAdmin = additionalAdmins.find(a => a.email === email);
    if (existingAdmin) {
      return NextResponse.json({ error: "Admin already exists" }, { status: 400 });
    }

    additionalAdmins.push({ email, password, name });

    return NextResponse.json({ 
      success: true, 
      message: `Admin ${email} added successfully` 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    additionalAdmins: additionalAdmins.map(a => ({ email: a.email, name: a.name }))
  });
}