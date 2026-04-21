import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pubKey = url.searchParams.get("key");

    if (!pubKey) {
      return NextResponse.json({ active: false, error: "Missing key" }, { status: 200 });
    }

    // 1. Get workspace ID
    const wsCheck = await query(`SELECT id FROM nolix_workspaces WHERE public_key = $1`, [pubKey]) as any[];
    if (wsCheck.length === 0) {
      return NextResponse.json({ active: false }, { status: 200 });
    }
    
    const workspaceId = wsCheck[0].id;

    // 2. Check if any 'init' event has hit the system alerts (our chosen tracking mechanism for script install)
    const initCheck = await query(`
      SELECT id FROM nolix_system_alerts 
      WHERE workspace_id = $1 AND alert_type = 'EVENT_INIT'
      LIMIT 1
    `, [workspaceId]) as any[];

    if (initCheck.length > 0) {
      return NextResponse.json({ active: true });
    }

    return NextResponse.json({ active: false });
  } catch (err) {
    return NextResponse.json({ active: false, error: 'Database checking disabled' }, { status: 200 });
  }
}
