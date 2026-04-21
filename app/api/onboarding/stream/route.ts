import { NextRequest } from "next/server";
import { getAccessTier, requireTier } from "@/lib/nolix-security";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-nolix-key");
  if (!requireTier(getAccessTier(key), "read")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const session_id = new URL(req.url).searchParams.get("session_id");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      if (!redis) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "SSE mock mode" })}\n\n`));
        controller.close();
        return;
      }

      const subscriber = redis.duplicate();
      const listener = (channel: string, message: string) => {
        if (channel === "zeno_onboarding") {
           const payload = JSON.parse(message);
           if (!session_id || payload.session_id === session_id) {
             controller.enqueue(encoder.encode(`data: ${message}\n\n`));
           }
        }
      };

      await subscriber.subscribe("zeno_onboarding");
      subscriber.on("message", listener);

      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 30000);

      req.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        subscriber.unsubscribe("zeno_onboarding");
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
