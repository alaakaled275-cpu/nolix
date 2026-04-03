import { NextResponse } from "next/server";
import { ensureSchema } from "@/lib/schema";
import { query } from "@/lib/db";

export async function GET(req: Request) {
  await ensureSchema();
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  const [kpis] = await query<{
    leads_count: number;
    hot_count: number;
    warm_count: number;
    cold_count: number;
    booked_count: number;
    appointments_count: number;
    replies_count: number;
    estimated_revenue: string;
    conversion_rate: number;
  }>(
    `select
      (select count(*)::int from leads where tenant_id = $1) as leads_count,
      (select count(*)::int from leads where tenant_id = $1 and temperature = 'hot') as hot_count,
      (select count(*)::int from leads where tenant_id = $1 and temperature = 'warm') as warm_count,
      (select count(*)::int from leads where tenant_id = $1 and temperature = 'cold') as cold_count,
      (select count(*)::int from leads where tenant_id = $1 and stage = 'booked') as booked_count,
      (select count(*)::int from appointments where tenant_id = $1) as appointments_count,
      (select count(*)::int from lead_messages where tenant_id = $1 and direction = 'in') as replies_count,
      0::numeric(12,2) as estimated_revenue,
      case
        when (select count(*) from leads where tenant_id = $1) = 0 then 0
        else (select count(*) from leads where tenant_id = $1 and stage = 'booked')::float
          / (select count(*) from leads where tenant_id = $1)::float
      end as conversion_rate`,
    [tenantId]
  );

  const stages = await query<{ stage: string; count: number }>(
    `select stage::text as stage, count(*)::int as count
     from leads
     where tenant_id = $1
     group by stage
     order by count desc`,
    [tenantId]
  );

  return NextResponse.json({ kpis, stages });
}
