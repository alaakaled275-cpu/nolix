import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSchema } from "@/lib/schema";
import { query } from "@/lib/db";

const createLeadSchema = z.object({
  tenantId: z.string().uuid(),
  fullName: z.string().min(1).optional(),
  company: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  linkedinUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
});

export async function GET(req: Request) {
  await ensureSchema();
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  const stage = searchParams.get("stage");

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  const rows = await query(
    `select id, tenant_id, full_name, company, title, email, phone, source, stage, temperature, score, created_at, updated_at
     from leads
     where tenant_id = $1
       and ($2::text is null or stage = $2::lead_stage)
     order by created_at desc
     limit 200`,
    [tenantId, stage]
  );

  return NextResponse.json({ leads: rows });
}

export async function POST(req: Request) {
  await ensureSchema();
  const body = await req.json().catch(() => null);
  const parsed = createLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const rows = await query(
    `insert into leads(
      tenant_id, full_name, company, title, linkedin_url, website, email, phone, source
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    returning id`,
    [
      data.tenantId,
      data.fullName ?? null,
      data.company ?? null,
      data.title ?? null,
      data.linkedinUrl ?? null,
      data.website ?? null,
      data.email ?? null,
      data.phone ?? null,
      data.source ?? null,
    ]
  );

  return NextResponse.json({ id: (rows[0] as { id: string }).id });
}
