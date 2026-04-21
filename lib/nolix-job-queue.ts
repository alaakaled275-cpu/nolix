/**
 * NOLIX — Distributed Job Queue (STEP 14 PART 2)
 * lib/nolix-job-queue.ts
 *
 * PRIMARY:  BullMQ + Redis (ioredis) — full distributed queue
 *           Retry, backoff, dead letter, worker specialization
 *
 * FALLBACK: DB-persistent queue with SELECT FOR UPDATE SKIP LOCKED
 *           When Redis not available (REDIS_URL not set)
 *           Same guarantees minus real-time pub/sub
 *
 * WORKERS (PART 9 — Distributed Training):
 *   worker-ingestion  — receives events, validates, deduplicates
 *   worker-training   — ML online training
 *   worker-embedding  — vector storage + similarity
 */

import { query } from "./db";

// ── Config ──────────────────────────────────────────────────────────────────
const REDIS_URL    = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || "";
const USE_REDIS    = !!REDIS_URL;
const QUEUE_NAME   = "nolix-events";

export type JobType =
  | "event_ingest"
  | "online_train"
  | "embedding_update"
  | "batch_train"
  | "health_check"
  | "backlog_drain";

export interface NolixJob {
  type:        JobType;
  visitor_id?: string;
  session_id?: string;
  store?:      string;
  payload:     Record<string, unknown>;
  event_id?:   string;   // for idempotency (PART 4)
  sequence?:   number;   // for ordering (PART 5)
  enqueued_at: number;
}

// ── Redis/BullMQ Mode ────────────────────────────────────────────────────────
let _Queue:  any = null;
let _Worker: any = null;
let _redis:  any = null;
let _redisInitialized = false;

async function initRedis() {
  if (_redisInitialized) return;
  _redisInitialized = true;

  if (!USE_REDIS) {
    console.log("⚙ JOB QUEUE: Redis not configured. Using DB-persistent queue.");
    return;
  }

  try {
    const { Queue, Worker }  = await import("bullmq");
    const { default: Redis } = await import("ioredis");

    _redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck:     false
    });

    _redis.on("error", (e: Error) => console.warn("⚠ Redis error:", e.message));

    _Queue  = Queue;
    _Worker = Worker;

    console.log("🟢 JOB QUEUE: BullMQ + Redis initialized:", REDIS_URL.split("@").pop());
  } catch(e) {
    console.warn("⚠ JOB QUEUE: BullMQ init failed. Falling back to DB queue.", e);
    USE_REDIS && (_redisInitialized = false);
  }
}

// ── Queue Instances (Redis mode) ─────────────────────────────────────────────
let _ingestionQueue: any  = null;
let _trainingQueue:  any  = null;
let _embeddingQueue: any  = null;

async function getQueues() {
  await initRedis();
  if (!USE_REDIS || !_Queue) return null;

  if (!_ingestionQueue) {
    const conn = { connection: _redis };
    _ingestionQueue = new _Queue("nolix-ingestion",  conn);
    _trainingQueue  = new _Queue("nolix-training",   conn);
    _embeddingQueue = new _Queue("nolix-embedding",  conn);
  }
  return { _ingestionQueue, _trainingQueue, _embeddingQueue };
}

// ── ADD JOB (Redis + DB fallback) ────────────────────────────────────────────
export async function addJob(job: NolixJob): Promise<{ id: string; mode: "redis" | "db" }> {
  const queues = await getQueues();

  if (queues && USE_REDIS) {
    // ── REDIS MODE ─────────────────────────────────────────────────────────
    const opts = {
      attempts:       5,
      backoff:        { type: "exponential", delay: 2000 },
      removeOnComplete: { count: 1000 },
      removeOnFail:   { count: 500 }
    };

    let q;
    if (job.type === "online_train" || job.type === "batch_train") q = queues._trainingQueue;
    else if (job.type === "embedding_update")                       q = queues._embeddingQueue;
    else                                                            q = queues._ingestionQueue;

    const added = await q.add(job.type, job, opts);
    return { id: String(added.id), mode: "redis" };
  }

  // ── DB MODE (SELECT FOR UPDATE SKIP LOCKED) ──────────────────────────────
  try {
    const r = await query<any>(
      `INSERT INTO nolix_event_queue
       (event_type, payload, visitor_id, session_id, store, status, enqueued_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
       RETURNING id`,
      [
        job.type, JSON.stringify(job.payload),
        job.visitor_id || null, job.session_id || null, job.store || null
      ]
    );
    return { id: String((r as any[])[0]?.id), mode: "db" };
  } catch(e) {
    console.warn("⚠ addJob DB failed:", e);
    return { id: "0", mode: "db" };
  }
}

// ── PROCESS DB QUEUE (SKIP LOCKED — atomic claim) ───────────────────────────
// Uses SELECT FOR UPDATE SKIP LOCKED for zero double-processing.
// pg_advisory_lock is NOT used here — SKIP LOCKED IS the distributed lock for queues.
// pg_advisory_lock (blocking) is used in nolix-distributed-lock.ts for flag updates.
export async function drainDBQueue(
  batchSize: number = 10,
  processor: (job: NolixJob) => Promise<void>
): Promise<{ processed: number; failed: number }> {
  let processed = 0, failed = 0;

  try {
    // PART 5: ORDER BY event_sequence ASC — guarantees processing order
    const rows = await query<any>(`
      WITH claimed AS (
        SELECT id, event_type, payload, visitor_id, session_id, store, retries
        FROM nolix_event_queue
        WHERE status = 'pending'
          AND (next_retry_at IS NULL OR next_retry_at <= NOW())
        ORDER BY event_sequence ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE nolix_event_queue q
      SET status = 'processing', processed_at = NOW()
      FROM claimed
      WHERE q.id = claimed.id
      RETURNING claimed.*
    `, [batchSize]);

    for (const row of rows as any[]) {
      try {
        const job: NolixJob = {
          type:       row.event_type as JobType,
          visitor_id: row.visitor_id,
          session_id: row.session_id,
          store:      row.store,
          payload:    typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
          enqueued_at: Date.now()
        };

        await processor(job);

        await query("UPDATE nolix_event_queue SET status='done', processed_at=NOW() WHERE id=$1", [row.id]);
        processed++;
      } catch(e: any) {
        failed++;
        const retries = (row.retries || 0) + 1;

        if (retries >= 5) {
          // Move to dead letter
          await query(
            `INSERT INTO nolix_dead_letter (original_id, event_type, payload, error_msg, retries)
             VALUES ($1, $2, $3, $4, $5)`,
            [row.id, row.event_type, JSON.stringify(row.payload), e.message, retries]
          ).catch(() => {});
          await query("UPDATE nolix_event_queue SET status='failed', retries=$1 WHERE id=$2", [retries, row.id]);
        } else {
          // Exponential backoff: 2^retries seconds
          const delayMs = 2000 * Math.pow(2, retries);
          await query(
            `UPDATE nolix_event_queue
             SET status='retrying', retries=$1, next_retry_at=NOW()+($2 * INTERVAL '1 millisecond'), error_msg=$3
             WHERE id=$4`,
            [retries, delayMs, e.message, row.id]
          );
        }
      }
    }
  } catch(e) { console.error("⚠ drainDBQueue error:", e); }

  return { processed, failed };
}

// ── START WORKERS (PART 9 — Distributed Training) ───────────────────────────
let _workersStarted = false;

export async function startDistributedWorkers(
  eventProcessor:     (job: NolixJob) => Promise<void>,
  trainingProcessor:  (job: NolixJob) => Promise<void>,
  embeddingProcessor: (job: NolixJob) => Promise<void>
): Promise<{ mode: "redis" | "db" }> {
  if (_workersStarted) return { mode: USE_REDIS ? "redis" : "db" };
  _workersStarted = true;

  const queues = await getQueues();

  if (queues && USE_REDIS && _Worker) {
    // ── REDIS WORKERS (3 specialized) ──────────────────────────────────────
    const opts = { connection: _redis, concurrency: 5 };

    new _Worker("nolix-ingestion", async (job: any) => {
      await eventProcessor(job.data as NolixJob);
    }, opts);

    new _Worker("nolix-training", async (job: any) => {
      await trainingProcessor(job.data as NolixJob);
    }, { connection: _redis, concurrency: 2 }); // limit training concurrency

    new _Worker("nolix-embedding", async (job: any) => {
      await embeddingProcessor(job.data as NolixJob);
    }, opts);

    console.log("🟢 DISTRIBUTED WORKERS: 3 BullMQ workers active (ingestion + training + embedding)");
    return { mode: "redis" };
  }

  // ── DB QUEUE POLLING (SKIP LOCKED) ─────────────────────────────────────
  setInterval(async () => {
    try {
      await drainDBQueue(20, async (job) => {
        if (job.type === "online_train" || job.type === "batch_train") {
          await trainingProcessor(job);
        } else if (job.type === "embedding_update") {
          await embeddingProcessor(job);
        } else {
          await eventProcessor(job);
        }
      });
    } catch(e) { console.error("⚠ DB queue drain error:", e); }
  }, 2000);

  console.log("⚙ DISTRIBUTED WORKERS: DB-persistent queue mode (SKIP LOCKED), polling 2s");
  return { mode: "db" };
}

// ── QUEUE STATUS ─────────────────────────────────────────────────────────────
export async function getQueueStatus(): Promise<{
  mode:            "redis" | "db";
  pending:         number;
  processing:      number;
  failed:          number;
  dead_letter:     number;
  redis_connected: boolean;
}> {
  const mode: "redis" | "db" = (USE_REDIS && !!_redis) ? "redis" : "db";
  let pending = 0, processing = 0, failed = 0, dead = 0;

  try {
    const r = await query<any>(`
      SELECT status, COUNT(*) as cnt
      FROM nolix_event_queue
      GROUP BY status
    `);
    for (const row of r as any[]) {
      if (row.status === "pending")    pending    = Number(row.cnt);
      if (row.status === "processing") processing = Number(row.cnt);
      if (row.status === "failed")     failed     = Number(row.cnt);
    }
    const dl = await query<any>("SELECT COUNT(*) as cnt FROM nolix_dead_letter");
    dead = Number((dl as any[])[0]?.cnt) || 0;
  } catch {}

  return {
    mode, pending, processing, failed, dead_letter: dead,
    redis_connected: !!(USE_REDIS && _redis)
  };
}
