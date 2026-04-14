"use client";

import React, { useEffect, useState } from "react";
import { ZenoAppShell } from "@/app/components/ZenoAppShell";
import { CinematicFlow } from "@/app/components/CinematicFlow";

interface StatsData {
  decisions_today: number;
  revenue_protected: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    // We just fetch small stats to populate the sidebar Live Link
    fetch("/api/convert/stats")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setStats({
            decisions_today: d.today?.actions_taken || 0,
            revenue_protected: d.revenue_attributed || 0
          });
        }
      })
      .catch(() => {});
  }, []);

  const intelData = {
    last_action: "",
    last_reason: "",
    last_uplift: 0,
    last_confidence: 0,
    alternatives_rejected: [],
    decisions_today: stats?.decisions_today ?? 0,
    conversions_today: 0,
    revenue_protected: stats?.revenue_protected ?? 0,
    brier_score: null,
    brier_label: "",
    drift_detected: false,
    drift_direction: ""
  };

  return (
    <ZenoAppShell activeTab="dashboard" intelData={intelData}>
      {/* ── Cinematic Flow Takes 100% of the Central Dimension ── */}
      <CinematicFlow />
    </ZenoAppShell>
  );
}
