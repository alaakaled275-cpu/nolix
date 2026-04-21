"use client";

import { useEffect, useState } from "react";
import type { ZenoEvent } from "@/lib/nolix-event-types";

export function useZenoStream() {
  const [events, setEvents] = useState<ZenoEvent[]>([]);

  useEffect(() => {
    // In actual deployment, might need to pass API key in query if not using cookies
    const es = new EventSource("/api/engine/events?stream=true");

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data && data.type) {
          setEvents((prev) => [data, ...prev].slice(0, 500));
        }
      } catch (err) {
        console.error("Zeno Stream parse error:", err);
      }
    };

    es.onerror = () => {
      // Stream error, silently retry natively by browser
    };

    return () => {
      es.close();
    };
  }, []);

  return events;
}
