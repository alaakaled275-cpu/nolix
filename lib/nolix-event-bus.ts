/**
 * lib/nolix-event-bus.ts
 * NOLIX — In-Process Event Bus for SSE (Server-Sent Events)
 *
 * This is the message broker that connects:
 *   /api/track (producer) → emits decisions
 *   /api/stream (consumer) → streams decisions to dashboard
 *
 * Uses Node.js EventEmitter with a process-level singleton so all
 * Next.js API routes share the same bus instance.
 *
 * IMPORTANT: This is an in-process bus. In a multi-instance
 * deployment (multiple pods/servers), use Redis pub/sub instead.
 * For single-server or Vercel Edge (single instance), this works perfectly.
 *
 * Events emitted:
 *   "decision" — { session_id, store, decision, model_score, hesitation, timestamp }
 *   "event"    — { event, store, session, decision, timestamp } (every track call)
 */

import { EventEmitter } from "events";

// ── Singleton pattern: survive Next.js Hot Module Replacement ─────────────────
const globalAny = global as any;

if (!globalAny._nolixEventBus) {
  const bus = new EventEmitter();
  bus.setMaxListeners(200); // support up to 200 simultaneous SSE connections
  globalAny._nolixEventBus = bus;
}

export const eventBus: EventEmitter = globalAny._nolixEventBus;
