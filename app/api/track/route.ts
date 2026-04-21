import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// Basic Rate Limiting Map (Memory-based for MVP)
const rateLimiter = new Map<string, { count: number; timestamp: number }>();

export async function POST(req: Request) {
  try {
    const rawIp = req.headers.get("x-forwarded-for") || "unknown";
    const ip = rawIp.split(',')[0];
    
    // 1. RATE LIMITING CRITICAL SECURITY
    const now = Date.now();
    const limit = rateLimiter.get(ip);
    if (limit && now - limit.timestamp < 60000) {
      if (limit.count > 100) return new NextResponse("Rate limit exceeded", { status: 429 });
      limit.count++;
    } else {
      rateLimiter.set(ip, { count: 1, timestamp: now });
    }

    const body = await req.json();
    const { key, url, event, data, domain } = body;

    if (!key) {
      return new NextResponse("Unauthorized: Missing key", { status: 401 });
    }

    // 2. CRITICAL TENANT VERIFICATION
    const workspaceQuery = await query(`
      SELECT id, is_active FROM nolix_workspaces WHERE public_key = $1
    `, [key]) as any[];

    if (!workspaceQuery || workspaceQuery.length === 0) {
      return new NextResponse("Forbidden: Invalid Workspace Key", { status: 403 });
    }

    const workspace = workspaceQuery[0];

    if (!workspace.is_active) {
      return new NextResponse("Forbidden: Workspace Inactive", { status: 403 });
    }

    const workspace_id = workspace.id;

    // 3. TRACKING LOGIC ISOLATION
    // Save to isolated table with workspace_id injected
    if (event === "init") {
       await query(`
         INSERT INTO nolix_system_alerts (workspace_id, alert_type, message, severity)
         VALUES ($1, 'EVENT_INIT', 'Store ping received from ' || $2, 'info')
       `, [workspace_id, domain]);
    } else if (event === "conversion") {
       await query(`
         UPDATE nolix_pricing_decisions 
         SET actual_revenue = $1 
         WHERE workspace_id = $2 AND actual_revenue = 0 
         -- simplified linking
       `, [data.revenue, workspace_id]);
    }

    // Dispatch SSE ping using workspace channel (channel = "workspace:" + workspace_id)
    // pushToRedis(workspace_id, { type: event, payload: data })

    return NextResponse.json({ success: true, workspace: workspace_id });
  } catch (error: any) {
    console.error("[TRACK API] Error:", error.message);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
