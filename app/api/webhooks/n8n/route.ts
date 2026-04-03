import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSchema } from "@/lib/schema";
import { getPool } from "@/lib/db";

const webhookSchema = z.object({
  tenantId: z.string().uuid(),
  type: z.enum([
    "reply_received",
    "qualification_result",
    "appointment_booked",
    "crm_synced",
  ]),
  leadId: z.string().uuid().optional(),
  payload: z.record(z.any()).default({}),
});

export async function POST(req: Request) {
  await ensureSchema();
  const body = await req.json().catch(() => null);
  const parsed = webhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { tenantId, type, leadId, payload } = parsed.data;
  const pool = getPool();

  if (type === "reply_received") {
    if (!leadId) {
      return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    }

    const channel = typeof payload.channel === "string" ? payload.channel : "email";
    const subject = typeof payload.subject === "string" ? payload.subject : null;
    const text = typeof payload.body === "string" ? payload.body : JSON.stringify(payload);

    await pool.query(
      `insert into lead_messages(tenant_id, lead_id, channel, direction, subject, body, status, received_at)
       values ($1,$2,$3,'in',$4,$5,'received', now())`,
      [tenantId, leadId, channel, subject, text]
    );

    await pool.query(
      `update leads set stage = 'replied', updated_at = now() where id = $1 and tenant_id = $2`,
      [leadId, tenantId]
    );

    await pool.query(
      `insert into lead_events(tenant_id, lead_id, type, payload)
       values ($1, $2, 'reply_received', $3::jsonb)`,
      [tenantId, leadId, JSON.stringify(payload)]
    );

    return NextResponse.json({ ok: true });
  }

  if (type === "qualification_result") {
    if (!leadId) {
      return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    }

    const temperature = payload.temperature;
    const stage = payload.stage;
    const score = payload.score;

    const tempValue =
      temperature === "hot" || temperature === "warm" || temperature === "cold"
        ? temperature
        : null;

    const stageValue =
      stage === "qualified" || stage === "booked" || stage === "lost" || stage === "won"
        ? stage
        : "qualified";

    await pool.query(
      `update leads
       set temperature = $3::lead_temperature,
           stage = $4::lead_stage,
           score = $5::int,
           updated_at = now()
       where id = $1 and tenant_id = $2`,
      [leadId, tenantId, tempValue, stageValue, typeof score === "number" ? score : null]
    );

    await pool.query(
      `insert into lead_events(tenant_id, lead_id, type, payload)
       values ($1, $2, 'qualification_result', $3::jsonb)`,
      [tenantId, leadId, JSON.stringify(payload)]
    );

    return NextResponse.json({ ok: true });
  }

  if (type === "appointment_booked") {
    if (!leadId) {
      return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    }

    await pool.query(
      `insert into appointments(tenant_id, lead_id, provider, external_id, starts_at, ends_at, meet_url, status)
       values ($1,$2,$3,$4,$5,$6,$7,'scheduled')`,
      [
        tenantId,
        leadId,
        typeof payload.provider === "string" ? payload.provider : "calendly",
        typeof payload.externalId === "string" ? payload.externalId : null,
        payload.startsAt ? new Date(payload.startsAt) : null,
        payload.endsAt ? new Date(payload.endsAt) : null,
        typeof payload.meetUrl === "string" ? payload.meetUrl : null,
      ]
    );

    await pool.query(
      `update leads set stage = 'booked', updated_at = now() where id = $1 and tenant_id = $2`,
      [leadId, tenantId]
    );

    await pool.query(
      `insert into lead_events(tenant_id, lead_id, type, payload)
       values ($1, $2, 'appointment_booked', $3::jsonb)`,
      [tenantId, leadId, JSON.stringify(payload)]
    );

    return NextResponse.json({ ok: true });
  }

  await pool.query(
    `insert into lead_events(tenant_id, lead_id, type, payload)
     values ($1, $2, $3, $4::jsonb)`,
    [tenantId, leadId ?? null, type, JSON.stringify(payload)]
  );

  return NextResponse.json({ ok: true });
}
