import { getPool } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

async function main(): Promise<void> {
  await ensureSchema();
  const pool = getPool();

  const tenantRes = await pool.query<{ id: string }>(
    `insert into tenants(name)
     values ('Default Tenant')
     on conflict do nothing
     returning id;`
  );

  let tenantId = tenantRes.rows[0]?.id;
  if (!tenantId) {
    const existing = await pool.query<{ id: string }>(
      `select id from tenants order by created_at asc limit 1;`
    );
    tenantId = existing.rows[0]?.id;
  }

  if (!tenantId) {
    throw new Error("Failed to create or find a tenant");
  }

  await pool.query(
    `insert into templates(tenant_id, key, channel, subject, body, enabled)
     values
      ($1, 'initial_email', 'email', 'Quick question about {{company}}', 'Hi {{full_name}},\n\nI noticed you\'re leading growth at {{company}}. We help teams generate qualified leads on autopilot (targeting + outreach + qualification + booking + CRM sync).\n\nIf I could show you a simple setup that delivers 10–20 qualified conversations/week, would it be worth a quick look?', true),
      ($1, 'followup_email_1', 'email', 'Re: {{company}}', 'Hi {{full_name}},\n\nJust following up—happy to share a 2-min overview of how the system qualifies leads (Hot/Warm/Cold) and books meetings automatically.\n\nShould I send it?', true)
     on conflict (tenant_id, key)
     do update set subject = excluded.subject, body = excluded.body, enabled = excluded.enabled;`,
    [tenantId]
  );

  await pool.query(
    `insert into qualification_questions(tenant_id, key, question, enabled, order_index)
     values
      ($1, 'budget', 'Do you have a monthly budget allocated for lead generation?', true, 1),
      ($1, 'timeline', 'When do you want to start seeing new qualified meetings on the calendar?', true, 2),
      ($1, 'target', 'Who is your ideal customer (role, company size, industry)?', true, 3)
     on conflict (tenant_id, key)
     do update set question = excluded.question, enabled = excluded.enabled, order_index = excluded.order_index;`,
    [tenantId]
  );

  await pool.end();
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err));
  process.exit(1);
});
