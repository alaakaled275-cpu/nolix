import PgBoss from "pg-boss";
import { getEnv } from "@/lib/env";
import { ensureSchema } from "@/lib/schema";
import { getPool } from "@/lib/db";

type LeadOutreachJob = { tenantId: string; leadId: string };
type LeadQualifyJob = { tenantId: string; leadId: string; messageId?: string };
type LeadFollowUpJob = { tenantId: string; leadId: string };
type MetricsRollupJob = { tenantId: string };

function pgConnectionString() {
  const env = getEnv();
  const user = encodeURIComponent(env.PGUSER ?? "");
  const pass = encodeURIComponent(env.PGPASSWORD ?? "");
  const host = env.PGHOST ?? "localhost";
  const port = env.PGPORT ?? "5432";
  const db   = env.PGDATABASE ?? "";
  return `postgres://${user}:${pass}@${host}:${port}/${db}`;
}

async function callN8nWebhook(path: string, body: unknown): Promise<void> {
  const env = getEnv();
  if (!env.N8N_WEBHOOK_BASE_URL) return;
  const url = new URL(path.replace(/^\//, ""), env.N8N_WEBHOOK_BASE_URL.endsWith("/") ? env.N8N_WEBHOOK_BASE_URL : `${env.N8N_WEBHOOK_BASE_URL}/`);
  await fetch(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function main(): Promise<void> {
  await ensureSchema();

  const boss = new PgBoss({
    connectionString: pgConnectionString(),
    schema: "pgboss",
  });

  boss.on("error", (err) => {
    if (err instanceof Error) {
      process.stderr.write(String(err.stack || err.message));
      return;
    }
    process.stderr.write(String(err));
  });

  await boss.start();

  const pool = getPool();

  await boss.work<LeadOutreachJob>("lead.outreach", async (job) => {
    const { tenantId, leadId } = job.data;
    const leadRes = await pool.query(
      `select id, full_name, company, title, email, linkedin_url from leads where id = $1 and tenant_id = $2`,
      [leadId, tenantId]
    );
    const lead = leadRes.rows[0];
    if (!lead) return;

    await callN8nWebhook("outreach", {
      tenantId,
      lead,
      templateKey: "initial_email",
    });

    await pool.query(
      `update leads set stage = 'contacted', last_contacted_at = now(), updated_at = now() where id = $1 and tenant_id = $2`,
      [leadId, tenantId]
    );

    await pool.query(
      `insert into lead_events(tenant_id, lead_id, type, payload)
       values ($1, $2, 'outreach_sent', $3::jsonb)`,
      [tenantId, leadId, JSON.stringify({ channel: "email" })]
    );
  });

  await boss.work<LeadQualifyJob>("lead.qualify", async (job) => {
    const { tenantId, leadId, messageId } = job.data;

    const leadRes = await pool.query(
      `select id, full_name, company, title, email from leads where id = $1 and tenant_id = $2`,
      [leadId, tenantId]
    );
    const lead = leadRes.rows[0];
    if (!lead) return;

    const msgsRes = await pool.query(
      `select id, body, created_at from lead_messages where lead_id = $1 and tenant_id = $2 and direction = 'in' order by created_at desc limit 5`,
      [leadId, tenantId]
    );

    await callN8nWebhook("qualify", {
      tenantId,
      lead,
      lastInboundMessages: msgsRes.rows,
      messageId,
    });

    await pool.query(
      `update leads set stage = 'qualified', updated_at = now() where id = $1 and tenant_id = $2`,
      [leadId, tenantId]
    );

    await pool.query(
      `insert into lead_events(tenant_id, lead_id, type, payload)
       values ($1, $2, 'qualified_requested', $3::jsonb)`,
      [tenantId, leadId, JSON.stringify({})]
    );
  });

  await boss.work<LeadFollowUpJob>("lead.follow_up", async (job) => {
    const { tenantId, leadId } = job.data;

    const leadRes = await pool.query(
      `select id, full_name, company, title, email from leads where id = $1 and tenant_id = $2`,
      [leadId, tenantId]
    );
    const lead = leadRes.rows[0];
    if (!lead) return;

    await callN8nWebhook("followup", {
      tenantId,
      lead,
      templateKey: "followup_email_1",
    });

    await pool.query(
      `insert into lead_events(tenant_id, lead_id, type, payload)
       values ($1, $2, 'follow_up_sent', $3::jsonb)`,
      [tenantId, leadId, JSON.stringify({ channel: "email" })]
    );
  });

  await boss.work<MetricsRollupJob>("metrics.rollup", async (job) => {
    const { tenantId } = job.data;

    await pool.query(
      `insert into metrics_daily(tenant_id, day, leads_count, hot_count, warm_count, cold_count, booked_count, replies_count, estimated_revenue)
       select
         $1 as tenant_id,
         current_date as day,
         (select count(*) from leads where tenant_id = $1) as leads_count,
         (select count(*) from leads where tenant_id = $1 and temperature = 'hot') as hot_count,
         (select count(*) from leads where tenant_id = $1 and temperature = 'warm') as warm_count,
         (select count(*) from leads where tenant_id = $1 and temperature = 'cold') as cold_count,
         (select count(*) from leads where tenant_id = $1 and stage = 'booked') as booked_count,
         (select count(*) from lead_messages where tenant_id = $1 and direction = 'in' and created_at::date = current_date) as replies_count,
         0::numeric as estimated_revenue
       on conflict (tenant_id, day)
       do update set
         leads_count = excluded.leads_count,
         hot_count = excluded.hot_count,
         warm_count = excluded.warm_count,
         cold_count = excluded.cold_count,
         booked_count = excluded.booked_count,
         replies_count = excluded.replies_count,
         estimated_revenue = excluded.estimated_revenue;`,
      [tenantId]
    );

    await pool.query(
      `insert into lead_events(tenant_id, type, payload)
       values ($1, 'metrics_rollup', $2::jsonb)`,
      [tenantId, JSON.stringify({ day: new Date().toISOString().slice(0, 10) })]
    );
  });

  const tenantsRes = await pool.query<{ id: string }>(`select id from tenants`);
  for (const t of tenantsRes.rows) {
    await boss.schedule("metrics.rollup", "0 */1 * * *", { tenantId: t.id });
  }

  process.stdout.write("worker started\n");
}

main().catch((err) => {
  if (err instanceof Error) {
    process.stderr.write(String(err.stack || err.message));
  } else {
    process.stderr.write(String(err));
  }
  process.exit(1);
});
