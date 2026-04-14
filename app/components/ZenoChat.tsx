"use client";
import { useState, useEffect, useRef } from "react";
import styles from "./ZenoChat.module.css";

// ── Types ──────────────────────────────────────────────────────────────────────
interface StoreAnalysisSnapshot {
  foundation_score?: number;
  judgment?: string;
  business_type?: string;
  audience_age?: string;
  audience_income?: string;
  product_classification?: string;
  is_consumable?: boolean;
  strengths?: string[];
  weaknesses?: string[];
  market_strength?: string;
  demand_level?: string;
  monthly_revenue_low?: number;
  monthly_revenue_high?: number;
  cvr_est?: number;
  aov_est?: number;
  valuation_low?: number;
  valuation_high?: number;
  repeat_purchase?: boolean;
  upsell_potential?: string | null;
  // Module 3
  final_verdict?: string;
  overall_recommendation?: string;
  fix_first?: string;
  growth_2x?: string;
  growth_10x?: string;
  zeno_summary?: string;
  data_source?: "live" | "benchmark" | "offline";
}

interface ZenoChatProps {
  context?: Record<string, unknown>;
  storeName?: string;
  storeAnalysis?: StoreAnalysisSnapshot;
}

interface Message {
  role: "zeno" | "user";
  text: string;
  ts: number;
}

// ── Quick chips — full 3-module coverage ─────────────────────────────────────
// Module 1 — Foundation
const CHIPS_FOUNDATION = [
  "What's the foundation score?",
  "What type of business is this?",
  "Who is the target buyer?",
  "Is the homepage effective?",
];

// Module 2 — Market & Revenue
const CHIPS_MARKET = [
  "How much revenue could this make?",
  "What's the estimated monthly profit?",
  "Is this market saturated?",
  "What's the business valuation?",
];

// Module 3 — Strategic Audit
const CHIPS_STRATEGIC = [
  "What's the final verdict?",
  "What should be fixed first?",
  "How do we 2x this store?",
  "What's the realistic scenario?",
  "Is this worth investing in?",
];

// Chip set when no analysis data available
const QUICK_CHIPS_DEFAULT = [
  "Why am I losing revenue?",
  "What should I fix first?",
  "What did you detect?",
  "What did you learn from this analysis?",
  "Which A/B variant is better?",
];

// Build context-aware chip set
function getChips(analysis?: StoreAnalysisSnapshot): string[] {
  if (!analysis) return QUICK_CHIPS_DEFAULT;
  const all = [...CHIPS_FOUNDATION, ...CHIPS_MARKET, ...CHIPS_STRATEGIC];
  // Rotate: show 5 most relevant based on what data is present
  if (analysis.final_verdict) return [
    "What's the final verdict?",
    "What should be fixed first?",
    "What did you learn from this analysis?",
    "How do we 2x this store?",
    "How much revenue could this make?",
  ];
  if (analysis.monthly_revenue_high) return [
    "What's the foundation score?",
    "How much revenue could this make?",
    "What did you learn from this analysis?",
    "Is this market saturated?",
    "Who is the target buyer?",
  ];
  return [...all.slice(0, 4), "What did you learn from this analysis?"];
}

// ── Status phrases that cycle ─────────────────────────────────────────────────
const STATUS_PHRASES = [
  "Monitoring visitors",
  "Analyzing behavior",
  "Watching checkout funnel",
  "Intent detection active",
  "Revenue engine running",
];

// ── Proactive insight generator based on real data ────────────────────────────
function getProactiveInsight(
  ctx: Record<string, unknown>,
  analysis?: StoreAnalysisSnapshot
): string | null {
  // Module 3 — Lead with verdict if available
  if (analysis?.final_verdict) {
    const v = analysis.final_verdict;
    if (v.includes("High")) return `🔥 Verdict: High potential. ${analysis.fix_first ? `Next move: ${analysis.fix_first}` : "Ask me where to invest first."}` ;
    if (v.includes("Not")) return `❌ Verdict: Not recommended. ${analysis.overall_recommendation ?? "Ask me why and what would need to change."}` ;
    return `⚠️ Verdict: Medium risk. ${analysis.fix_first ? `Fix first: ${analysis.fix_first}` : "Ask me what's holding it back."}` ;
  }

  // Module 1 — Foundation insights
  if (analysis?.foundation_score != null) {
    const score = analysis.foundation_score;
    if (score <= 4) return `⚠️ Foundation score ${score}/10 — critical structural weaknesses. Ask me what to fix first.`;
    if (score >= 8) return `🚀 Foundation score ${score}/10 — strong store. Revenue potential is real. Ask me for the market breakdown.`;
    if (analysis.market_strength === "Weak") return `📉 Market strength is Weak despite a ${score}/10 foundation. High competition risk.`;
    if (analysis.monthly_revenue_high != null) {
      return `💰 Est. $${analysis.monthly_revenue_low?.toLocaleString()}–$${analysis.monthly_revenue_high?.toLocaleString()}/mo revenue potential. Ask me how to get there.`;
    }
  }

  // Behavioral data proactive insight
  const sessions = (ctx.total_sessions as number) ?? 0;
  if (sessions === 0) return null;

  const cvr = (ctx.cvr_pct as number) ?? 0;
  const highIntent = (ctx.high_intent_sessions as number) ?? 0;
  const today = ctx.today as { actions_taken: number; conversions: number } | undefined;
  const frictionDist = (ctx.friction_distribution as { friction_detected: string; count: string }[]) ?? [];
  const topFriction = [...frictionDist].sort((a, b) => Number(b.count) - Number(a.count))[0];

  if (cvr < 2 && sessions > 10) return `⚠️ CVR is ${cvr}% — below 2% threshold. Checkout leakage is the primary cause.`;
  if (topFriction?.friction_detected === "stuck_cart" && Number(topFriction.count) > 3) {
    return `⚠️ ${topFriction.count} sessions stuck in cart without converting. Urgency or discount needed.`;
  }
  if (highIntent > 0 && sessions > 0 && highIntent / sessions > 0.35) {
    return `🧠 ${Math.round((highIntent / sessions) * 100)}% of traffic is high-intent. Strong buying signals today.`;
  }
  if (today && today.actions_taken > 0) {
    return `⚡ ${today.actions_taken} smart actions triggered today → ${today.conversions} conversions recovered.`;
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ZenoChat({ context = {}, storeName, storeAnalysis }: ZenoChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [proactiveInsight, setProactiveInsight] = useState<string | null>(null);
  const [insightVisible, setInsightVisible] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasGreeted = useRef(false);

  // Determine chip set based on available data
  const chips = getChips(storeAnalysis);

  // Cycle status phrase
  useEffect(() => {
    const t = setInterval(() => setStatusIdx(i => (i + 1) % STATUS_PHRASES.length), 3800);
    return () => clearInterval(t);
  }, []);

  // Show proactive insight bubble after 5s
  useEffect(() => {
    const insight = getProactiveInsight(context, storeAnalysis);
    if (!insight) return;
    const t1 = setTimeout(() => { setProactiveInsight(insight); setInsightVisible(true); }, 5000);
    const t2 = setTimeout(() => setInsightVisible(false), 14000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeAnalysis]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // Greet on open
  useEffect(() => {
    if (!open || hasGreeted.current) return;
    hasGreeted.current = true;

    let greeting: string;

    if (storeAnalysis?.zeno_summary) {
      // Store analysis greeting — use real dual-module context
      const src = storeAnalysis.data_source === "benchmark" ? " (benchmark estimates — store was unreachable)" : "";
      greeting = storeAnalysis.zeno_summary + src + " What do you want to dig into?";
    } else {
      // Behavioral dashboard greeting
      const sessions = (context.total_sessions as number) ?? 0;
      const cvr = (context.cvr_pct as number) ?? 0;
      const today = context.today as { analyzed: number; conversions: number } | undefined;
      if (sessions === 0) {
        greeting = `Zeno active. No sessions recorded yet — engine is watching. Send traffic to start seeing behavioral data.`;
      } else {
        greeting = `${sessions} sessions analyzed. CVR is ${cvr}%${today?.analyzed ? `, ${today.analyzed} visitors scanned today` : ""}. What do you want to know?`;
      }
    }

    setTimeout(() => {
      setMessages([{ role: "zeno", text: greeting, ts: Date.now() }]);
    }, 300);
    setTimeout(() => inputRef.current?.focus(), 500);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendMessage(text: string) {
    if (!text.trim() || thinking) return;
    const userMsg: Message = { role: "user", text: text.trim(), ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setThinking(true);

    try {
      const res = await fetch("/api/zeno/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          context,
          storeAnalysis: storeAnalysis ?? null,
        }),
      });
      const data = await res.json();
      const reply = data.reply ?? "I can't access that data right now. Try again.";
      setMessages(prev => [...prev, { role: "zeno", text: reply, ts: Date.now() }]);
    } catch {
      setMessages(prev => [...prev, { role: "zeno", text: "Connection issue. Check your API setup.", ts: Date.now() }]);
    } finally {
      setThinking(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <>
      {/* ── Proactive insight bubble ── */}
      {insightVisible && !open && (
        <div className={styles.insightBubble} onClick={() => setOpen(true)}>
          <span className={styles.insightIcon}>🧠</span>
          <span>{proactiveInsight}</span>
        </div>
      )}

      {/* ── Floating panel ── */}
      {open && (
        <div className={styles.panel}>
          {/* Panel header */}
          <div className={styles.panelHeader}>
            <div className={styles.zenoBrand}>
              <div className={styles.zenoAvatar}>Z</div>
              <div>
                <div className={styles.zenoName}>Zeno</div>
                <div className={styles.zenoStatus}>
                  <span className={styles.statusDot} />
                  {STATUS_PHRASES[statusIdx]}
                </div>
              </div>
            </div>
            <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Close Zeno">✕</button>
          </div>

          {/* Quick chips */}
          {messages.length <= 1 && (
            <div className={styles.chips}>
              {chips.map((q: string) => (
                <button key={q} className={styles.chip} onClick={() => sendMessage(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className={styles.messages}>
            {messages.map((m, i) => (
              <div key={i} className={`${styles.msg} ${m.role === "zeno" ? styles.msgZeno : styles.msgUser}`}>
                {m.role === "zeno" && <div className={styles.msgAvatar}>Z</div>}
                <div className={styles.msgBubble}>{m.text}</div>
              </div>
            ))}
            {thinking && (
              <div className={`${styles.msg} ${styles.msgZeno}`}>
                <div className={styles.msgAvatar}>Z</div>
                <div className={`${styles.msgBubble} ${styles.thinkingBubble}`}>
                  <span className={styles.dot} /><span className={styles.dot} /><span className={styles.dot} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className={styles.inputRow}>
            <input
              ref={inputRef}
              className={styles.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Zeno anything..."
              disabled={thinking}
            />
            <button
              className={styles.sendBtn}
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || thinking}
              aria-label="Send"
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* ── Trigger button (always visible) ── */}
      <button
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => setOpen(o => !o)}
        id="zeno-chat-trigger"
        aria-label="Open Zeno AI"
      >
        {open ? (
          <span className={styles.triggerClose}>✕</span>
        ) : (
          <>
            <div className={styles.triggerAvatar}>Z</div>
            <div className={styles.triggerLabel}>
              <div className={styles.triggerName}>Zeno</div>
              <div className={styles.triggerSub}>{STATUS_PHRASES[statusIdx]}</div>
            </div>
            <span className={styles.triggerDot} />
          </>
        )}
      </button>
    </>
  );
}
