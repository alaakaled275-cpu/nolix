"use client";

import { useState, useEffect } from "react";
import { DecisionState, RiskLevel } from "@/app/components/ui/DecisionBadge";

export interface DecisionLog {
  id: string;
  userState: "HESITATOR" | "BUYER_READY" | "UNKNOWN";
  intentScore: number;
  confidence: number;
  triggerReason: string;
  actionTaken: string;
  expectedUplift: string;
  actionState: DecisionState;
  riskLevel: RiskLevel;
  timestamp: string;
}

export function useZenoDecisions() {
  const [decisions, setDecisions] = useState<DecisionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Phase 6 Data Integration: Placeholder structure ready for /api/engine/decide
    const mockFeed: DecisionLog[] = [
      {
        id: "evt_392xa9",
        userState: "HESITATOR",
        intentScore: 42,
        confidence: 88,
        triggerReason: "User hesitated at checkout for 18s without moving mouse.",
        actionTaken: "Injected 10% Surgial Discount via popup",
        expectedUplift: "+$45.00",
        actionState: "DISCOUNTED",
        riskLevel: "HIGH",
        timestamp: "Just now"
      },
      {
        id: "evt_991bx2",
        userState: "BUYER_READY",
        intentScore: 95,
        confidence: 96,
        triggerReason: "Direct organic search, scrolled to bottom instantly. High velocity.",
        actionTaken: "Held Firm (0% Discount). Retained margin.",
        expectedUplift: "+$12.50 vs avg",
        actionState: "RETAINED",
        riskLevel: "LOW",
        timestamp: "1m ago"
      },
      {
        id: "evt_44xx81",
        userState: "UNKNOWN",
        intentScore: 50,
        confidence: 45,
        triggerReason: "A/B Routing Matrix triggered. Baseline control group.",
        actionTaken: "Assigned to test cohort B (Control). No action.",
        expectedUplift: "0.00",
        actionState: "AB_TEST",
        riskLevel: "MED",
        timestamp: "4m ago"
      }
    ];

    setTimeout(() => {
      setDecisions(mockFeed);
      setLoading(false);
    }, 500); // 500ms fake network delay
    
  }, []);

  return { decisions, loading };
}

export function useZenoMetrics() {
  const [metrics, setMetrics] = useState({
    mlContribution: 78.4,
    fallbackContribution: 12.1,
    avgLatencyMs: 18,
    incrementalRevenue: 12450,
    retainedMargin: 4200,
    interventionRate: 18.2,
    avgOfferRoi: 3.4
  });

  // Ready for API integration
  // useEffect(() => { fetch('/api/engine/metrics')... }, []);

  return metrics;
}
