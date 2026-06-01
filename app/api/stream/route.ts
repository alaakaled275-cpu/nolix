/**
 * app/api/stream/route.ts
 * NOLIX — Live Decision Stream (SSE — Server-Sent Events)
 *
 * LAYER 4: REALTIME DASHBOARD
 *
 * Architecture:
 *   /api/track → eventBus.emit("decision", ...) → /api/stream → Dashboard
 *
 * The dashboard connects via EventSource("/api/stream").
 * Every time /api/track processes an event and the AI Brain returns a decision,
 * it is pushed in real-time to all connected dashboard clients.
 *
 * Features:
 *   - Keeps connection alive with heartbeat ping every 15s
 *   - Auto-cleans up listener when client disconnects
 *   - Sends "connected" event on handshake
 *   - Supports up to 200 simultaneous dashboard connections (EventEmitter limit)
 *
 * Dashboard usage:
 *   const evtSource = new EventSource("/api/stream");
 *   evtSource.addEventListener("decision", (e) => { ... });
 *   evtSource.addEventListener("event",    (e) => { ... });
 *
 * AUTH: Disabled by user request - Dashboard is publicly accessible.
 */

import { NextRequest } from "next/server";
import { eventBus } from "@/lib/nolix-event-bus";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let isClosed       = false;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(eventName: string, data: unknown) {
        if (isClosed) return;
        try {
          const payload =
            `event: ${eventName}\n` +
            `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          cleanup();
        }
      }

      function cleanup() {
        if (isClosed) return;
        isClosed = true;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        eventBus.off("decision", onDecision);
        eventBus.off("event",    onEvent);
        try { controller.close(); } catch { /* already closed */ }
      }

      function onDecision(data: unknown) {
        send("decision", data);
        send("message", data);
      }

      function onEvent(data: unknown) {
        send("event", data);
      }

      eventBus.on("decision", onDecision);
      eventBus.on("event",    onEvent);

      heartbeatTimer = setInterval(() => {
        if (isClosed) { clearInterval(heartbeatTimer!); return; }
        try {
          controller.enqueue(encoder.encode(
            `event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`
          ));
        } catch { cleanup(); }
      }, 15_000);

      send("connected", {
        status:    "live",
        message:   "Neural Decision Stream connected",
        timestamp: new Date().toISOString(),
      });

      req.signal.addEventListener("abort", cleanup);
    },

    cancel() {
      isClosed = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      eventBus.off("decision", () => {});
      eventBus.off("event",    () => {});
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":                "text/event-stream",
      "Cache-Control":               "no-cache, no-store, must-revalidate",
      "Connection":                  "keep-alive",
      "X-Accel-Buffering":           "no",
      "Access-Control-Allow-Origin": "*",
    },
  });
}