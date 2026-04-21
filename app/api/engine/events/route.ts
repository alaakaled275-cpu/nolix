/**
 * NOLIX — Advanced SSE Event Stream (COMMAND 03 - Step 9)
 * app/api/engine/events/route.ts
 *
 * Provides Real-Time Observability of Zeno's thought process.
 * Streams structured ZenoEvents to the Dashboard.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAccessTier, requireTier } from "@/lib/nolix-security";
import { redis } from "@/lib/redis";
import type { ZenoEvent } from "@/lib/nolix-event-types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-nolix-key") || req.url.includes("api_key") 
    ? new URL(req.url).searchParams.get("api_key") 
    : null;

  if (!requireTier(getAccessTier(key || ""), "read")) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Set up SSE headers
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      if (!redis) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Redis not configured for SSE pub/sub" })}\n\n`));
        controller.close();
        return;
      }

      // Create a dedicated subscriber for this connection
      const subscriber = redis.duplicate();
      
      const listener = (channel: string, message: string) => {
        if (channel === "zeno_events") {
          try {
            const ev = JSON.parse(message) as ZenoEvent;
            
            // Format for the UI standard payload to easily parse
            const ssePayload = {
              type: ev.type,
              level: ev.level,
              trace_id: ev.trace_id,
              timestamp: ev.timestamp,
              payload: ev.payload
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(ssePayload)}\n\n`));
          } catch (e) {
            console.error("Failed to parse event for SSE loop", e);
          }
        }
      };

      await subscriber.subscribe("zeno_events");
      subscriber.on("message", listener);

      // Keep connection alive
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 30000);

      req.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        subscriber.unsubscribe("zeno_events");
        subscriber.quit();
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive"
    }
  });
}
