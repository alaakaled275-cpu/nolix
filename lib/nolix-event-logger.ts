/**
 * NOLIX — Event Logger (COMMAND 03 - Step 4)
 * lib/nolix-event-logger.ts
 */

import { query } from "@/lib/db";
import type { ZenoEvent } from "./nolix-event-types";
import { redis } from "@/lib/redis"; // Used for SSE pub/sub

export async function emitEvent(event: ZenoEvent) {
  try {
    // 1. Store in PostgreSQL
    await query(
      `INSERT INTO nolix_structured_events (id, trace_id, type, level, payload, created_at)
       VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0))`,
      [
        event.id,
        event.trace_id,
        event.type,
        event.level,
        JSON.stringify(event.payload),
        event.timestamp
      ]
    );

    // 2. Publish to Redis for SSE Real-time Streaming
    // This allows clients to listen to events in real-time
    if (redis) {
      await redis.publish("zeno_events", JSON.stringify(event));
    }
  } catch (error) {
    // Fallback if Postgres/Redis breaks (don't crash the Brain)
    console.error("[ZenoEventLogger] Failed to emit event", event.id, error);
  }
}
