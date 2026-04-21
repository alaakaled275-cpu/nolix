import { NextRequest, NextResponse } from "next/server";
import { getAccessTier, requireTier } from "@/lib/nolix-security";
import { measureExperiment } from "@/lib/nolix-experiment-analytics";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-nolix-key");
  if (!requireTier(getAccessTier(key), "read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const experiment_id = new URL(req.url).searchParams.get("experiment_id");

  try {
    if (experiment_id) {
       const stats = await measureExperiment(experiment_id);
       return NextResponse.json({ success: true, experiment_id, stats });
    } else {
       const active = await query(`SELECT id, name, status FROM nolix_experiments ORDER BY created_at DESC`) as any[];
       
       const overview = await Promise.all(active.map(async (exp: any) => {
          const stats = await measureExperiment(exp.id);
          return { id: exp.id, name: exp.name, status: exp.status, stats };
       }));

       return NextResponse.json({ success: true, experiments: overview });
    }
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch stats", message: err.message }, { status: 500 });
  }
}
