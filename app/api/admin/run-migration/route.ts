import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import fs from 'fs';
import path from 'path';

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sqlPath3 = path.join(process.cwd(), 'scripts', 'nolix-level3-schema.sql');
    const sql3 = fs.readFileSync(sqlPath3, 'utf8');
    await query(sql3);

    const sqlPathBic = path.join(process.cwd(), 'scripts', 'nolix-bic-schema.sql');
    const sqlBic = fs.readFileSync(sqlPathBic, 'utf8');
    await query(sqlBic);
    
    return NextResponse.json({ success: true, message: "Level 3 and BIC Schemas applied successfully!" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
