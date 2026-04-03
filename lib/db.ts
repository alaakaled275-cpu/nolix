import { Pool } from "pg";
import { getEnv } from "./env";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (pool) return pool;
  const env = getEnv();

  pool = new Pool({
    host: env.PGHOST,
    port: Number(env.PGPORT),
    database: env.PGDATABASE,
    user: env.PGUSER,
    password: env.PGPASSWORD,
    max: 10,
    connectionTimeoutMillis: 5000,   // fail fast if DB unreachable
    idleTimeoutMillis: 30000,
    statement_timeout: 8000,          // no query can run longer than 8s
  });

  return pool;
}

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  const res = await getPool().query(text, params);
  return res.rows as T[];
}
