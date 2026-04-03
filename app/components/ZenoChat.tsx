"use client";
import { useState, useEffect, useRef } from "react";
import styles from "./ZenoChat.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ZenoChatProps {
  context?: Record<string, unknown>;
  storeName?: string;
}

interface Message {
  role: "zeno" | "user";
  text: string;
  ts: number;
}

// ── Quick questions Zeno can answer ───────────────────────────────────────────
const QUICK_CHIPS = [
  "Why am I losing revenue?",
  "What should I fix first?",
  "What did you detect?",
  "Which A/B variant is better?",
  "Should I use discounts?",
];

// ── Status phrases that cycle ─────────────────────────────────────────────────
const STATUS_PHRASES = [
  "Monitoring visitors",
  "Analyzing behavior",
  "Watching checkout funnel",
  "Intent detection active",
  "Revenue engine running",
];

// ── Proactive insight generator based on real data ────────────────────────────
function getProactiveInsight(ctx: Record<string, unknown>): string | null {
  const sessions = (ctx.total_sessions as number) ?? 0;
  if (sessions === 0) return null;

  const cvr = (ctx.cvr_pct as number) ?? 0;
  const highIntent = (ctx.high_intent_sessions as number) ?? 0;
  const today = ctx.today as { actions_taken: number; conversions: number } | undefined;
  const frictionDist = (ctx.friction_distribution as { friction_detected: string; count: string }[]) ?? [];
  const topFriction = frictionDist.sort((a, b) => Number(b.count) - Number(a.count))[0];

  if (cvr < 2 && sessions > 10) return `⚠️ CVR is ${cvr}% — below the 2% threshold. Checkout leakage is the primary cause.`;
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
export default function ZenoChat({ context = {}, storeName }: ZenoChatProps) {
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

  // Cycle status phrase
  useEffect(() => {
    const t = setInterval(() => setStatusIdx(i => (i + 1) % STATUS_PHRASES.length), 3800);
    return () => clearInterval(t);
  }, []);

  // Show proactive insight bubble after 6s if there's data
  useEffect(() => {
    const insight = getProactiveInsight(context);
    if (!insight) return;
    const t1 = setTimeout(() => { setProactiveInsight(insight); setInsightVisible(true); }, 6000);
    const t2 = setTimeout(() => setInsightVisible(false), 14000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // Greet on open
  useEffect(() => {
    if (!open || hasGreeted.current) return;
    hasGreeted.current = true;
    const sessions = (context.total_sessions as number) ?? 0;
    const cvr = (context.cvr_pct as number) ?? 0;
    const today = context.today as { analyzed: number; conversions: number } | undefined;

    let greeting: string;
    if (sessions === 0) {
      greeting = `Zeno active. No sessions recorded yet — the engine is watching. Send traffic to start seeing behavioral data.`;
    } else {
      greeting = `${sessions} sessions analyzed. CVR is ${cvr}%${today?.analyzed ? `, ${today.analyzed} visitors scanned today` : ""}. What do you want to know?`;
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
        body: JSON.stringify({ message: text.trim(), context }),
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
              {QUICK_CHIPS.map(q => (
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
