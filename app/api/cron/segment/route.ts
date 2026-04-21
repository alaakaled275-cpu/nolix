/**
 * NOLIX — Cron: Segment clustering (STEP 15 PART 11)
 * app/api/cron/segment/route.ts
 */
import { NextRequest, NextResponse }   from "next/server";
import { runKMeansClustering }         from "@/lib/nolix-segmentation";
import { runMonitor }                  from "@/lib/nolix-model-monitor";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.NOLIX_CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [centroids, monitorReport] = await Promise.all([
    runKMeansClustering().catch(e => ({ error: String(e) })),
    runMonitor().catch(e   => ({ error: String(e) }))
  ]);

  return NextResponse.json({
    ok:        true,
    segments:  Array.isArray(centroids) ? centroids.map(c => ({ id: (c as any).id, label: (c as any).label, size: (c as any).size })) : centroids,
    monitor:   monitorReport ? { alert_level: (monitorReport as any).alert_level } : null,
    ran_at:    new Date().toISOString()
  });
}
