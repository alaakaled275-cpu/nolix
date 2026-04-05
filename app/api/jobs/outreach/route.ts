import { NextResponse } from "next/server";
import { z } from "zod";
import PgBoss from "pg-boss";
import { ensureSchema } from "@/lib/schema";
import { getEnv } from "@/lib/env";

const bodySchema = z.object({
  tenantId: z.string().uuid(),
  leadId: z.string().uuid(),
});

function pgConnectionString() {
  const env = getEnv();

  // Safely fall back to empty string so TypeScript is happy.
  // PgBoss will fail with a clear connection error if DB vars are missing,
  // rather than crashing at the TypeScript / build stage.
  const user = encodeURIComponent(env.PGUSER ?? "");
  const pass = encodeURIComponent(env.PGPASSWORD ?? "");
  const host = env.PGHOST ?? "localhost";
  const port = env.PGPORT ?? "5432";
  const db   = env.PGDATABASE ?? "";

  return `postgres://${user}:${pass}@${host}:${port}/${db}`;
}

export async function POST(req: Request) {
  await ensureSchema();
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const boss = new PgBoss({ connectionString: pgConnectionString(), schema: "pgboss" });
  await boss.start();
  const jobId = await (
    boss as unknown as {
      send: (name: string, data: unknown) => Promise<string>;
    }
  ).send("lead.outreach", parsed.data);
  await boss.stop();

  return NextResponse.json({ ok: true, jobId });
}
