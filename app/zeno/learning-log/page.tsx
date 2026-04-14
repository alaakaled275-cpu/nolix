"use client";
import { useEffect, useState } from "react";
import styles from "./styles.module.css";
import ZenoChat from "@/app/components/ZenoChat";

// ── Types ─────────────────────────────────────────────────────────────────────
interface LearningEntry {
  id: string;
  url: string;
  business_model: string;
  error_type: string;
  error_description: string;
  correction_rule: string;
  confidence_before: number;
  confidence_after: number;
  phase: string;
  created_at: string;
}

interface LogStats {
  entries: LearningEntry[];
  total: number;
  total_confidence_gain: number;
  by_phase: Record<string, number>;
  by_error_type: Record<string, number>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const PHASE_COLORS: Record<string, string> = {
  foundation: "#6366f1",
  market: "#f59e0b",
  strategic: "#10b981",
  general: "#64748b",
};

const TYPE_ICONS: Record<string, string> = {
  wrong_model_logic: "🔀",
  unrealistic_number: "📉",
  missing_data: "❓",
  contradiction: "⚡",
  weak_assumption: "🧪",
  incorrect_classification: "🏷️",
  logical_error: "🔴",
};

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const PHASE_LABELS: Record<string, string> = {
  foundation: "Phase 1 · Foundation",
  market: "Phase 2 · Market",
  strategic: "Phase 3 · Strategy",
  general: "General",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function LearningLogPage() {
  const [data, setData] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/zeno/self-improve?limit=100")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const entries = data?.entries ?? [];
  const filtered =
    filter === "all" ? entries : entries.filter((e) => e.phase === filter);

  const avgGain =
    entries.length > 0
      ? Math.round((data?.total_confidence_gain ?? 0) / entries.length)
      : 0;

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.container}>
          <a href="/" className={styles.logo}>
            Convert<span className={styles.logoAccent}>AI</span>
          </a>
          <nav className={styles.nav}>
            <a href="/zeno" className={styles.navLink}>Zeno Dashboard</a>
            <a href="/zeno/learning-log" className={`${styles.navLink} ${styles.navActive}`}>
              Learning Log
            </a>
          </nav>
          <a href="/zeno" className={styles.btnBack}>← Back to Zeno</a>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>

          {/* ── Hero ── */}
          <div className={styles.heroSection}>
            <div className={styles.heroGlow} aria-hidden />
            <div className={styles.heroIdentity}>
              <div className={styles.zenoAvatar}>Z</div>
              <div>
                <div className={styles.heroTitle}>Zeno Learning Log</div>
                <div className={styles.heroSub}>
                  Every error detected. Every rule created. Every improvement stored.
                </div>
              </div>
            </div>

            {/* ── Stat strip ── */}
            {data && (
              <div className={styles.statsStrip}>
                <div className={styles.stat}>
                  <div className={styles.statVal}>{data.total}</div>
                  <div className={styles.statLbl}>Rules Learned</div>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.stat}>
                  <div className={styles.statVal} style={{ color: "#10b981" }}>
                    +{data.total_confidence_gain}%
                  </div>
                  <div className={styles.statLbl}>Total Confidence Gained</div>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.stat}>
                  <div className={styles.statVal} style={{ color: "#6366f1" }}>
                    +{avgGain}%
                  </div>
                  <div className={styles.statLbl}>Avg. Gain / Rule</div>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.stat}>
                  <div className={styles.statVal}>
                    {Object.keys(data.by_phase).length}
                  </div>
                  <div className={styles.statLbl}>Phases Covered</div>
                </div>
              </div>
            )}
          </div>

          {/* ── Phase Breakdown ── */}
          {data && Object.keys(data.by_phase).length > 0 && (
            <div className={styles.breakdownSection}>
              <div className={styles.sectionLabel}>📊 Error Distribution by Phase</div>
              <div className={styles.breakdownGrid}>
                {Object.entries(data.by_phase).map(([phase, count]) => (
                  <button
                    key={phase}
                    className={`${styles.breakdownCard} ${filter === phase ? styles.breakdownCardActive : ""}`}
                    onClick={() => setFilter(filter === phase ? "all" : phase)}
                    style={{ "--phase-color": PHASE_COLORS[phase] ?? "#64748b" } as React.CSSProperties}
                  >
                    <div className={styles.breakdownCount}>{count}</div>
                    <div className={styles.breakdownPhase}>{PHASE_LABELS[phase] ?? phase}</div>
                    <div className={styles.breakdownBar}>
                      <div
                        className={styles.breakdownBarFill}
                        style={{ width: `${Math.min(100, (count / data.total) * 100)}%` }}
                      />
                    </div>
                  </button>
                ))}
                {filter !== "all" && (
                  <button className={styles.clearFilter} onClick={() => setFilter("all")}>
                    ✕ Clear filter
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Error Type Legend ── */}
          {data && Object.keys(data.by_error_type).length > 0 && (
            <div className={styles.typeSection}>
              <div className={styles.sectionLabel}>🏷️ Error Types Detected</div>
              <div className={styles.typeGrid}>
                {Object.entries(data.by_error_type)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <div key={type} className={styles.typeChip}>
                      <span>{TYPE_ICONS[type] ?? "•"}</span>
                      <span>{type.replace(/_/g, " ")}</span>
                      <span className={styles.typeCount}>{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ── Learning entries ── */}
          {loading && (
            <div className={styles.loadingBlock}>
              <div className={styles.spinner} />
              <span>Zeno is loading the memory archive…</span>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🧠</div>
              <div className={styles.emptyTitle}>No learnings recorded yet</div>
              <div className={styles.emptySub}>
                Run an analysis on a store URL and Zeno will automatically detect errors, 
                create correction rules, and store them here.
              </div>
              <a href="/" className={styles.emptyBtn}>Analyze a Store →</a>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className={styles.logsSection}>
              <div className={styles.sectionLabel}>
                🧠 Learned Rules
                {filter !== "all" && (
                  <span className={styles.filterBadge}>
                    {PHASE_LABELS[filter] ?? filter}
                  </span>
                )}
                <span className={styles.countBadge}>{filtered.length}</span>
              </div>

              <div className={styles.entriesList}>
                {filtered.map((entry) => {
                  const gain = entry.confidence_after - entry.confidence_before;
                  const expanded = expandedId === entry.id;
                  return (
                    <div
                      key={entry.id}
                      className={`${styles.entryCard} ${expanded ? styles.entryCardExpanded : ""}`}
                    >
                      {/* Entry header */}
                      <div
                        className={styles.entryHeader}
                        onClick={() => setExpandedId(expanded ? null : entry.id)}
                      >
                        <div className={styles.entryLeft}>
                          <span className={styles.entryTypeIcon}>
                            {TYPE_ICONS[entry.error_type] ?? "•"}
                          </span>
                          <div>
                            <div className={styles.entryType}>
                              {entry.error_type.replace(/_/g, " ")}
                            </div>
                            <div className={styles.entryUrl}>{entry.url}</div>
                          </div>
                        </div>
                        <div className={styles.entryRight}>
                          <div
                            className={styles.entryPhase}
                            style={{
                              background: `${PHASE_COLORS[entry.phase] ?? "#64748b"}22`,
                              color: PHASE_COLORS[entry.phase] ?? "#64748b",
                            }}
                          >
                            {PHASE_LABELS[entry.phase] ?? entry.phase}
                          </div>
                          <div
                            className={styles.entryGain}
                            style={{ color: gain >= 0 ? "#10b981" : "#ef4444" }}
                          >
                            {gain >= 0 ? "+" : ""}
                            {gain}%
                          </div>
                          <div className={styles.entryTime}>
                            {formatRelative(entry.created_at)}
                          </div>
                          <span className={styles.entryChevron}>
                            {expanded ? "▲" : "▼"}
                          </span>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {expanded && (
                        <div className={styles.entryDetail}>
                          <div className={styles.detailRow}>
                            <div className={styles.detailLabel}>❌ Error Detected</div>
                            <div className={styles.detailValue}>
                              {entry.error_description}
                            </div>
                          </div>
                          <div className={styles.detailRow}>
                            <div className={styles.detailLabel}>✅ Correction Rule</div>
                            <div
                              className={`${styles.detailValue} ${styles.detailRule}`}
                            >
                              {entry.correction_rule}
                            </div>
                          </div>
                          <div className={styles.detailMeta}>
                            <div className={styles.detailMetaItem}>
                              <span>Business Model</span>
                              <strong>{entry.business_model}</strong>
                            </div>
                            <div className={styles.detailMetaItem}>
                              <span>Confidence Before</span>
                              <strong>{entry.confidence_before}%</strong>
                            </div>
                            <div className={styles.detailMetaItem}>
                              <span>Confidence After</span>
                              <strong style={{ color: "#10b981" }}>
                                {entry.confidence_after}%
                              </strong>
                            </div>
                          </div>
                          {/* Confidence bar */}
                          <div className={styles.confBar}>
                            <div className={styles.confBarLabel}>
                              <span>Before: {entry.confidence_before}%</span>
                              <span style={{ color: "#10b981" }}>
                                After: {entry.confidence_after}%
                              </span>
                            </div>
                            <div className={styles.confBarTrack}>
                              <div
                                className={styles.confBarBefore}
                                style={{ width: `${entry.confidence_before}%` }}
                              />
                              <div
                                className={styles.confBarAfter}
                                style={{ width: `${entry.confidence_after}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── How Zeno Learns ── */}
          <div className={styles.howSection}>
            <div className={styles.sectionLabel}>⚙️ How Zeno Learns</div>
            <div className={styles.howGrid}>
              {[
                {
                  num: "01",
                  icon: "🔍",
                  title: "Error Detection",
                  desc: "After every analysis, Zeno reviews its own output looking for unrealistic numbers, wrong model logic, or contradictions.",
                },
                {
                  num: "02",
                  icon: "📐",
                  title: "Rule Creation",
                  desc: "For each error found, Zeno creates a precise correction rule that captures what went wrong and how to prevent it.",
                },
                {
                  num: "03",
                  icon: "🧠",
                  title: "Memory Storage",
                  desc: "Rules are saved to this persistent database. The top 15–20 most recent rules are injected into every future analysis.",
                },
                {
                  num: "04",
                  icon: "📈",
                  title: "Confidence Growth",
                  desc: "Each rule increases Zeno's accuracy. The more stores analyzed, the smarter Zeno becomes at detecting real revenue signals.",
                },
              ].map((s) => (
                <div key={s.num} className={styles.howCard}>
                  <div className={styles.howNum}>{s.num}</div>
                  <div className={styles.howIcon}>{s.icon}</div>
                  <div className={styles.howTitle}>{s.title}</div>
                  <div className={styles.howDesc}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      <ZenoChat
        context={{}}
        storeAnalysis={undefined}
      />
    </div>
  );
}
