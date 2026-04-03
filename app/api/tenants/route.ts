import { NextResponse } from "next/server";
import { ensureSchema } from "@/lib/schema";
import { query } from "@/lib/db";

export async function GET() {
  await ensureSchema();
  const tenants = await query(
    `select id, name, created_at from tenants order by created_at asc`
  );
  return NextResponse.json({ tenants });
}
