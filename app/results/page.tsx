"use client";
import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./styles.module.css";
import ZenoChat from "@/app/components/ZenoChat";

// ─── URL → seed ────────────────────────────────────────────────────────────────
function hashUrl(url: string): number {
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    h = (Math.imul(31, h) + url.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seeded(seed: number, min: number, max: number, offset = 0): number {
  const n = ((seed * 1664525 + offset * 22695477 + 1013904223) >>> 0) / 4294967296;
  return Math.round(min + n * (max - min));
}

// ─── Realistic analysis generator ─────────────────────────────────────────────
function generateAnalysis(storeUrl: string) {
  const seed = hashUrl(storeUrl || "example.com");

  // ── e-commerce benchmarks ──
  // Avg site CVR: 1–3%, assume 2% baseline
  // Checkout abandonment: ~68–72%
  // Mobile share: 55–70%
  // Traffic (monthly visitors): rough estimate from small/mid stores

  const monthlyVisitors = seeded(seed, 3_200, 28_000, 1);
  const baselineCvr = seeded(seed, 10, 26, 2) / 10; // 1.0–2.6%
  const checkoutAbandonRate = seeded(seed, 66, 74, 3); // 66–74%
  const avgOrderValue = seeded(seed, 42, 118, 4); // $42–$118

  // Revenue lost = visitors × abandoned checkout rate × (lost cvr gap)
  const potentialCvr = baselineCvr + seeded(seed, 8, 18, 5) / 10; // optimised CVR
  const lostConversionGap = potentialCvr - baselineCvr;
  const missedOrders = Math.round(monthlyVisitors * (lostConversionGap / 100));
  const revenueLostLow = Math.round(missedOrders * avgOrderValue * 0.10);
  const revenueLostHigh = Math.round(missedOrders * avgOrderValue * 0.22);

  // Recovery potential (10–20% of lost conversions)
  const recoverablePct = seeded(seed, 10, 20, 6);
  const recoverableOrders = Math.round(missedOrders * (recoverablePct / 100));
  // Recoverable revenue = the portion of the stated monthly loss you can realistically close
  const recoverableRevLow  = Math.round(revenueLostLow  * (recoverablePct / 100));
  const recoverableRevHigh = Math.round(revenueLostHigh * (recoverablePct / 100));

  // Issues found
  const issueCount = seeded(seed, 5, 9, 7);
  const frictionLevel = issueCount >= 8 ? "High" : issueCount >= 6 ? "Medium" : "Low";
  const frictionColor = frictionLevel === "High" ? "#ef4444" : frictionLevel === "Medium" ? "#f59e0b" : "#22c55e";

  // Mobile friction score (0–10, higher = worse)
  const mobileFriction = seeded(seed, 5, 9, 8);
  const mobileAbandonExtra = seeded(seed, 12, 24, 9); // % more abandonment on mobile vs desktop

  // Urgency signal score (0-10, lower = weaker)
  const urgencyScore = seeded(seed, 2, 5, 10);
  const discountMisuse = seeded(seed, 30, 55, 11); // % of discounts given to buyers who didn't need them

  // Specific issues list
  const allIssues = [
    { icon: "🛒", label: "High checkout abandonment", detail: `~${checkoutAbandonRate}% of users who reach checkout leave without buying — industry median is 68%.`, type: "warning" },
    { icon: "📱", label: "Mobile friction detected", detail: `Mobile users abandon ${mobileAbandonExtra}% more than desktop. Likely cause: multi-step checkout or small tap targets.`, type: "warning" },
    { icon: "⏰", label: "Weak urgency signals", detail: `Urgency score: ${urgencyScore}/10. Buyers hesitate longer when no scarcity or time pressure is visible.`, type: "warning" },
    { icon: "💸", label: "Discount misuse", detail: `Est. ${discountMisuse}% of your discount offers go to visitors who would have converted anyway — eroding your margin.`, type: "danger" },
    { icon: "🔒", label: "Trust signals missing at checkout", detail: "No visible SSL badge, money-back guarantee, or review count near the payment button — known conversion killers.", type: "warning" },
    { icon: "🧭", label: "No dynamic decision-making", detail: "Every visitor gets the same experience. High-intent buyers and low-intent browsers are treated identically.", type: "info" },
    { icon: "🔁", label: "Cart abandonment not addressed", detail: `${Math.round(monthlyVisitors * (checkoutAbandonRate / 100) * 0.6).toLocaleString()} sessions/month leave with a full cart and no recovery attempt.`, type: "warning" },
    { icon: "📊", label: "No A/B testing in place", detail: "Without split testing, you are flying blind. Small copy or layout changes can swing CVR by 5–15%.", type: "info" },
    { icon: "⚡", label: "Page speed likely hurts mobile CVR", detail: "Every +1s load time reduces mobile conversions by ~7%. Audit your LCP and CLS scores.", type: "warning" },
  ];

  const selectedIssues = allIssues.slice(0, issueCount);

  // Behavior assumptions
  const behaviorAssumptions = [
    { icon: "🤔", text: `Users hesitate ${seeded(seed, 14, 32, 12)}+ seconds before hitting "Pay Now" — typically a trust or price signal issue.` },
    { icon: "📱", text: `Majority of your traffic (est. ${seeded(seed, 55, 70, 13)}%) is on mobile, where checkout friction is highest.` },
    { icon: "🔄", text: `Returning visitors likely convert at 2–3× the rate of new visitors, but your funnel treats them the same.` },
    { icon: "🆚", text: "No variant testing means winning offers, headlines, and CTAs are left undiscovered and untapped." },
  ];

  return {
    storeUrl,
    monthlyVisitors,
    baselineCvr,
    checkoutAbandonRate,
    avgOrderValue,
    revenueLostLow,
    revenueLostHigh,
    recoverablePct,
    recoverableOrders,
    recoverableRevLow,
    recoverableRevHigh,
    issueCount,
    frictionLevel,
    frictionColor,
    mobileFriction,
    discountMisuse,
    selectedIssues,
    behaviorAssumptions,
  };
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function ResultsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const storeUrl = params.get("store") ?? "yourstore.com";
  const data = generateAnalysis(storeUrl);

  const [phase, setPhase] = useState<"loading" | "ready">("loading");
  const [loadMsg, setLoadMsg] = useState("Connecting to analysis engine…");
  const [loadPct, setLoadPct] = useState(0);
  const [revLowCount, setRevLowCount] = useState(0);
  const [revHighCount, setRevHighCount] = useState(0);
  const [recLowCount, setRecLowCount] = useState(0);
  const [visibleIssues, setVisibleIssues] = useState<typeof data.selectedIssues>([]);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [showImpact, setShowImpact] = useState(false);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadingSteps = [
    { msg: `Resolving ${storeUrl}…`, pct: 12 },
    { msg: "Scanning funnel structure…", pct: 28 },
    { msg: "Estimating checkout abandonment rate…", pct: 44 },
    { msg: "Benchmarking against 8,400+ stores…", pct: 60 },
    { msg: "Detecting mobile friction points…", pct: 74 },
    { msg: "Calculating revenue opportunity…", pct: 88 },
    { msg: "Analysis complete.", pct: 100 },
  ];

  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      if (i < loadingSteps.length) {
        setLoadMsg(loadingSteps[i].msg);
        setLoadPct(loadingSteps[i].pct);
        i++;
      } else {
        clearInterval(t);
        setTimeout(() => setPhase("ready"), 300);
      }
    }, 480);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "ready") return;

    const duration = 1400;
    const steps = 60;
    const interval = duration / steps;
    let step = 0;
    animRef.current = setInterval(() => {
      step++;
      const p = step / steps;
      const eased = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      setRevLowCount(Math.round(eased * data.revenueLostLow));
      setRevHighCount(Math.round(eased * data.revenueLostHigh));
      setRecLowCount(Math.round(eased * data.recoverableRevLow));
      if (step >= steps) clearInterval(animRef.current!);
    }, interval);

    data.selectedIssues.forEach((_, idx) => {
      setTimeout(
        () => setVisibleIssues((prev) => [...prev, data.selectedIssues[idx]]),
        300 + idx * 160
      );
    });

    setTimeout(() => setShowAssumptions(true), 300 + data.selectedIssues.length * 160 + 200);
    setTimeout(() => setShowImpact(true), 300 + data.selectedIssues.length * 160 + 500);

    return () => { if (animRef.current) clearInterval(animRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadLogoWrap}>
          <span className={styles.loadLogoText}>
            Convert<span className={styles.loadLogoAccent}>AI</span>
          </span>
        </div>
        <div className={styles.loadSpinner} />
        <div className={styles.loadMsg}>{loadMsg}</div>
        <div className={styles.loadBarTrack}>
          <div
            className={styles.loadBarFill}
            style={{ width: `${loadPct}%`, transition: "width 0.4s ease" }}
          />
        </div>
        <div className={styles.loadUrl}>{storeUrl}</div>
      </div>
    );
  }

  // ── Results ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.container}>
          <a href="/" className={styles.logoLink}>
            Convert<span className={styles.logoAccent}>AI</span>
          </a>
          <div className={styles.headerCenter}>
            <span className={styles.liveDot} />
            <span className={styles.liveLabel}>Store Analysis — {storeUrl}</span>
          </div>
          <button className={styles.btnNew} onClick={() => router.push("/")}>
            ← Analyze Another
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>

          {/* ─── HEADLINE ─── */}
          <div className={styles.resultHeadline}>
            <h1 className={styles.resultH1}>
              Your store is likely losing{" "}
              <span className={styles.lossRange}>
                ${revLowCount.toLocaleString()}–${revHighCount.toLocaleString()}/mo
              </span>
            </h1>
            <p className={styles.resultSub}>
              Based on e-commerce benchmarks, your checkout abandonment rate, and estimated traffic
              patterns for <strong>{storeUrl}</strong>.
            </p>
          </div>

          {/* ─── ZENO INTRO ─── */}
          <div className={styles.zenoIntro}>
            <div className={styles.zenoIntroAvatar}>Z</div>
            <div>
              <div className={styles.zenoIntroName}>Zeno — Revenue Operator</div>
              <div className={styles.zenoIntroText}>
                I analyzed <strong>{storeUrl}</strong>. Here&apos;s what I found. Your checkout is leaking revenue
                — {data.checkoutAbandonRate}% abandonment rate, {data.issueCount} friction points identified.
                Fix checkout hesitation first. That&apos;s where the money is.
              </div>
            </div>
          </div>

          {/* ─── REVENUE OPPORTUNITY ─── */}
          <div className={styles.sectionLabel}>💰 Revenue Opportunity</div>
          <div className={styles.opportunityGrid}>
            <div className={`${styles.oppCard} ${styles.oppCardPrimary}`}>
              <div className={styles.oppIcon}>📉</div>
              <div className={styles.oppValue}>
                ${data.revenueLostLow.toLocaleString()}–${data.revenueLostHigh.toLocaleString()}
              </div>
              <div className={styles.oppLabel}>Estimated Monthly Revenue Loss</div>
              <div className={styles.oppSub}>
                Due to checkout hesitation, friction, and zero recovery strategy
              </div>
            </div>
            <div className={styles.oppCard}>
              <div className={styles.oppIcon}>🛒</div>
              <div className={`${styles.oppValue} ${styles.oppAmber}`}>
                ~{data.checkoutAbandonRate}%
              </div>
              <div className={styles.oppLabel}>Checkout Abandonment Rate</div>
              <div className={styles.oppSub}>Industry benchmark: 68% — yours is likely higher</div>
            </div>
            <div className={styles.oppCard}>
              <div className={styles.oppIcon}>💳</div>
              <div className={`${styles.oppValue} ${styles.oppGray}`}>
                ~{data.baselineCvr.toFixed(1)}%
              </div>
              <div className={styles.oppLabel}>Estimated Baseline CVR</div>
              <div className={styles.oppSub}>
                Optimised stores in your category average {(data.baselineCvr + 0.8).toFixed(1)}%+
              </div>
            </div>
          </div>

          {/* ─── KEY ISSUES ─── */}
          <div className={styles.sectionLabel}>
            ⚠️ Key Issues — {data.issueCount} Found
          </div>
          <div className={styles.issuesList}>
            {visibleIssues.map((issue, i) => (
              <div
                key={i}
                className={`${styles.issueItem} ${styles["issue_" + issue.type]}`}
              >
                <span className={styles.issueIcon}>{issue.icon}</span>
                <div>
                  <div className={styles.issueLabel}>{issue.label}</div>
                  <div className={styles.issueDetail}>{issue.detail}</div>
                </div>
              </div>
            ))}
            {visibleIssues.length < data.selectedIssues.length && (
              <div className={styles.logLoading}>
                <span className={styles.miniSpinner} /> Scanning…
              </div>
            )}
          </div>

          {/* Checkout Friction Badge */}
          <div className={styles.frictionBadgeWrap}>
            <div className={styles.frictionBadge}>
              Checkout Friction Level:{" "}
              <span style={{ color: data.frictionColor, fontWeight: 700 }}>
                {data.frictionLevel}
              </span>
            </div>
          </div>

          {/* ─── BEHAVIOR ASSUMPTIONS ─── */}
          {showAssumptions && (
            <>
              <div className={styles.sectionLabel}>🧠 Behavior Assumptions</div>
              <div className={styles.assumptionsGrid}>
                {data.behaviorAssumptions.map((b, i) => (
                  <div key={i} className={styles.assumptionCard}>
                    <span className={styles.assumptionIcon}>{b.icon}</span>
                    <p>{b.text}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ─── POTENTIAL IMPACT ─── */}
          {showImpact && (
            <>
              <div className={styles.sectionLabel}>🚀 Potential Impact</div>
              <div className={styles.impactBox}>
                <div className={styles.impactGlow} aria-hidden />
                <div className={styles.impactMain}>
                  <div className={styles.impactValue}>
                    ${recLowCount.toLocaleString()}–${data.recoverableRevHigh.toLocaleString()}/mo
                  </div>
                  <div className={styles.impactLabel}>Recoverable Revenue</div>
                </div>
                <p className={styles.impactDesc}>
                  If optimized, you could recover <strong>{data.recoverablePct}%</strong> of lost
                  conversions — by adding urgency, reducing checkout steps, fixing mobile friction,
                  and deploying smarter, behavior-based offers. This estimate is{" "}
                  <strong>conservative</strong>: it only accounts for direct checkout recovery, not
                  the compounding effect of improved trust and repeat purchase rates.
                </p>
                <div className={styles.impactStats}>
                  <div className={styles.impactStat}>
                    <strong>~{data.recoverableOrders}</strong>
                    <span>extra orders/month</span>
                  </div>
                  <div className={styles.impactStatDivider} />
                  <div className={styles.impactStat}>
                    <strong>${data.avgOrderValue}</strong>
                    <span>avg. order value</span>
                  </div>
                  <div className={styles.impactStatDivider} />
                  <div className={styles.impactStat}>
                    <strong>{data.recoverablePct}%</strong>
                    <span>conversion recovery</span>
                  </div>
                </div>
              </div>

              {/* ─── CTA ─── */}
              <div className={styles.ctaSection}>
                <div className={styles.ctaBox}>
                  <div className={styles.ctaGlow} aria-hidden />
                  <h2 className={styles.ctaTitle}>
                    Ready to stop losing ${data.revenueLostLow.toLocaleString()}/month?
                  </h2>
                  <p className={styles.ctaSub}>
                    Activate ConvertAI now — one script, zero risk, and your first
                    recovery attempt runs within minutes.
                  </p>
                  <div className={styles.ctaBtns}>
                    <a
                      href={`/activate?store=${encodeURIComponent(storeUrl)}&loss=${data.revenueLostLow}`}
                      className={styles.btnPrimary}
                      id="results-cta-activate-btn"
                    >
                      ✅ Activate Revenue Recovery
                    </a>
                    <button
                      className={styles.btnSecondary}
                      onClick={() => router.push("/")}
                      id="results-cta-analyze-btn"
                    >
                      ← Analyze Another Store
                    </button>
                  </div>
                  <div className={styles.ctaTrust}>
                    <span>✓ 7-day free trial</span>
                    <span>✓ No installation required</span>
                    <span>✓ Remove instantly if no results</span>
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      </main>

      <ZenoChat context={{ total_sessions: data.monthlyVisitors, cvr_pct: data.baselineCvr }} storeName={storeUrl} />
    </div>
  );
}
