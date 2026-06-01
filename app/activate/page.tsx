"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function ActivateContent() {
  const params = useSearchParams();
  const router = useRouter();
  const domain = params.get("store") ?? "";
  const score = params.get("score") ?? "—";

  const [step, setStep] = useState<"verify" | "verifying" | "verified" | "failed" | "activating" | "done">("verify");
  const [platform, setPlatform] = useState<string | null>(null);
  const [verifyDetails, setVerifyDetails] = useState("");
  const [scriptCopied, setScriptCopied] = useState(false);

  const nolixScript = `<!-- Nolix Intelligence Engine -->
<script>
  (function(n,o,l,i,x){
    n._nolix=n._nolix||[];
    var s=o.createElement('script');
    s.async=true;
    s.src='https://nolix.ai/widget.js';
    s.dataset.domain='${domain}';
    o.head.appendChild(s);
  })(window,document);
</script>`;

  // Redirect if no domain
  useEffect(() => {
    if (!domain) router.push("/");
  }, [domain, router]);

  async function handleVerify() {
    setStep("verifying");
    try {
      const res = await fetch("/api/verify-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json();

      setPlatform(data.platform);
      setVerifyDetails(data.details);

      if (data.connected) {
        setStep("verified");
      } else if (data.platform) {
        // Store found but script not installed yet
        setStep("failed");
      } else {
        setStep("failed");
      }
    } catch {
      setVerifyDetails("Verification failed. Check your connection and try again.");
      setStep("failed");
    }
  }

  function handleCopyScript() {
    navigator.clipboard.writeText(nolixScript).then(() => {
      setScriptCopied(true);
      setTimeout(() => setScriptCopied(false), 2500);
    });
  }

  function handleActivate() {
    setStep("activating");
    // Simulate activation handshake
    setTimeout(() => setStep("done"), 2000);
  }

  const S: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      background: "#050508",
      color: "#f1f5f9",
      fontFamily: "'Inter', -apple-system, sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
    },
    logo: {
      fontFamily: "'Syne', sans-serif",
      fontSize: "22px",
      fontWeight: 800,
      color: "#f1f5f9",
      marginBottom: "48px",
      letterSpacing: "-0.5px",
    },
    logoAccent: { color: "#7c3aed" },
    card: {
      width: "100%",
      maxWidth: "580px",
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "20px",
      padding: "36px 40px",
    },
    header: {
      marginBottom: "28px",
    },
    tag: {
      display: "inline-block",
      background: "rgba(124,58,237,0.12)",
      border: "1px solid rgba(124,58,237,0.25)",
      color: "#a78bfa",
      fontSize: "11px",
      fontWeight: 700,
      letterSpacing: "0.5px",
      padding: "4px 12px",
      borderRadius: "100px",
      marginBottom: "12px",
      textTransform: "uppercase" as const,
    },
    title: {
      fontFamily: "'Syne', sans-serif",
      fontSize: "26px",
      fontWeight: 800,
      color: "#f8fafc",
      letterSpacing: "-0.5px",
      marginBottom: "8px",
    },
    sub: {
      fontSize: "14px",
      color: "#64748b",
      lineHeight: 1.6,
    },
    storeBadge: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "10px",
      padding: "12px 16px",
      marginTop: "20px",
      marginBottom: "28px",
    },
    storeDomain: { fontSize: "14px", fontWeight: 600, color: "#e2e8f0", flex: 1 },
    storeScore: {
      fontSize: "12px",
      fontWeight: 700,
      color: "#f59e0b",
      background: "rgba(245,158,11,0.1)",
      padding: "3px 10px",
      borderRadius: "100px",
    },
    btn: {
      width: "100%",
      background: "linear-gradient(135deg, #7c3aed, #9333ea)",
      color: "#fff",
      fontSize: "15px",
      fontWeight: 700,
      padding: "14px 24px",
      borderRadius: "12px",
      border: "none",
      cursor: "pointer",
      transition: "all 0.2s",
      marginBottom: "12px",
    },
    btnOutline: {
      width: "100%",
      background: "transparent",
      color: "#94a3b8",
      fontSize: "14px",
      fontWeight: 600,
      padding: "12px 24px",
      borderRadius: "12px",
      border: "1px solid rgba(255,255,255,0.1)",
      cursor: "pointer",
      transition: "all 0.2s",
    },
    infoBoxSuccess: {
      display: "flex",
      gap: "10px",
      alignItems: "flex-start" as const,
      padding: "14px 16px",
      borderRadius: "10px",
      marginBottom: "20px",
      background: "rgba(34,197,94,0.07)",
      border: "1px solid rgba(34,197,94,0.2)",
      color: "#86efac",
      fontSize: "13px",
      lineHeight: 1.6,
    } as React.CSSProperties,
    infoBoxError: {
      display: "flex",
      gap: "10px",
      alignItems: "flex-start" as const,
      padding: "14px 16px",
      borderRadius: "10px",
      marginBottom: "20px",
      background: "rgba(239,68,68,0.07)",
      border: "1px solid rgba(239,68,68,0.2)",
      color: "#fca5a5",
      fontSize: "13px",
      lineHeight: 1.6,
    } as React.CSSProperties,
    infoBoxWarning: {
      display: "flex",
      gap: "10px",
      alignItems: "flex-start" as const,
      padding: "14px 16px",
      borderRadius: "10px",
      marginBottom: "20px",
      background: "rgba(245,158,11,0.07)",
      border: "1px solid rgba(245,158,11,0.2)",
      color: "#fcd34d",
      fontSize: "13px",
      lineHeight: 1.6,
    } as React.CSSProperties,
    codeBox: {
      background: "rgba(0,0,0,0.4)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "10px",
      padding: "16px",
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#94a3b8",
      whiteSpace: "pre-wrap" as const,
      wordBreak: "break-all" as const,
      marginBottom: "12px",
      userSelect: "text" as const,
    },
    copyBtn: {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      background: "rgba(124,58,237,0.12)",
      border: "1px solid rgba(124,58,237,0.25)",
      color: "#a78bfa",
      fontSize: "12px",
      fontWeight: 600,
      padding: "7px 14px",
      borderRadius: "8px",
      cursor: "pointer",
      marginBottom: "20px",
    },
    spinner: {
      display: "inline-block",
      width: "16px",
      height: "16px",
      border: "2px solid rgba(255,255,255,0.3)",
      borderTopColor: "#fff",
      borderRadius: "50%",
      animation: "spin 0.7s linear infinite",
      marginRight: "8px",
      verticalAlign: "middle",
    },
    successCheck: {
      fontSize: "48px",
      marginBottom: "16px",
      display: "block",
      textAlign: "center" as const,
    },
    stepList: {
      display: "flex",
      flexDirection: "column" as const,
      gap: "10px",
      marginBottom: "24px",
    },
    stepRow: {
      display: "flex",
      gap: "12px",
      alignItems: "flex-start",
      fontSize: "13.5px",
      color: "#94a3b8",
      lineHeight: 1.6,
    },
    stepBullet: {
      width: "22px",
      height: "22px",
      borderRadius: "50%",
      background: "rgba(124,58,237,0.15)",
      border: "1px solid rgba(124,58,237,0.3)",
      color: "#a78bfa",
      fontSize: "11px",
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      marginTop: "1px",
    },
  };

  return (
    <div style={S.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>

      <div style={S.logo}>
        Nolix<span style={S.logoAccent}>.ai</span>
      </div>

      <div style={S.card}>

        {/* ── VERIFY STEP ── */}
        {(step === "verify" || step === "verifying") && (
          <>
            <div style={S.header}>
              <div style={S.tag}>Step 1 of 2 — Verify Connection</div>
              <div style={S.title}>Connect Your Store</div>
              <div style={S.sub}>
                Before activation, Zeno will verify your store is reachable and
                check for an existing Nolix connection.
              </div>
            </div>

            <div style={S.storeBadge}>
              <span>🌐</span>
              <span style={S.storeDomain}>{domain}</span>
              {score !== "—" && (
                <span style={S.storeScore}>Health Score: {score}/100</span>
              )}
            </div>

            <div style={S.stepList}>
              {[
                { n: "1", text: "Zeno checks your store is live and reachable" },
                { n: "2", text: "Detects platform (Shopify, WooCommerce, etc.)" },
                { n: "3", text: "Checks if Nolix script is already installed" },
              ].map((s) => (
                <div key={s.n} style={S.stepRow}>
                  <span style={S.stepBullet}>{s.n}</span>
                  <span>{s.text}</span>
                </div>
              ))}
            </div>

            <button
              style={S.btn}
              onClick={handleVerify}
              disabled={step === "verifying"}
            >
              {step === "verifying" ? (
                <>
                  <span style={S.spinner} />
                  Verifying…
                </>
              ) : (
                "Verify My Store →"
              )}
            </button>
            <button style={S.btnOutline} onClick={() => router.push("/")}>
              ← Back
            </button>
          </>
        )}

        {/* ── VERIFIED (script already installed) ── */}
        {step === "verified" && (
          <>
            <div style={S.infoBoxSuccess}>
              <span>✅</span>
              <span>
                <strong>Nolix detected on {domain}!</strong> — {verifyDetails}
              </span>
            </div>
            <div style={S.header}>
              <div style={S.tag}>Step 2 of 2 — Activate</div>
              <div style={S.title}>Script Verified</div>
              <div style={S.sub}>
                Nolix is already connected to your store. Click activate to start
                the revenue recovery engine.
              </div>
            </div>
            <button
              style={S.btn}
              onClick={handleActivate}
            >
              ✅ Activate Nolix Now
            </button>
          </>
        )}

        {/* ── FAILED (store found but script not installed) ── */}
        {step === "failed" && (
          <>
            <div style={{ ...S.header, marginBottom: "20px" }}>
              <div style={S.tag}>Step 2 of 2 — Install Script</div>
              <div style={S.title}>
                {platform ? `${platform} Store Found` : "Store Found"}
              </div>
              <div style={S.sub}>
                {platform
                  ? `We detected your ${platform} store. To activate Nolix, paste this script into your theme's <head> tag.`
                  : "Paste this script into your store's <head> tag to connect Nolix."}
              </div>
            </div>

            {verifyDetails && (
              <div style={S.infoBoxWarning}>
                <span>ℹ️</span>
                <span>{verifyDetails}</span>
              </div>
            )}

            <div style={{ fontSize: "12px", color: "#475569", marginBottom: "8px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>
              Your Nolix Script
            </div>

            <div style={S.codeBox}>{nolixScript}</div>

            <button style={S.copyBtn} onClick={handleCopyScript}>
              {scriptCopied ? "✅ Copied!" : "📋 Copy Script"}
            </button>

            {platform === "Shopify" && (
              <div style={{ ...S.infoBoxWarning, marginBottom: "20px" }}>
                <span>💡</span>
                <div>
                  <strong>Shopify:</strong> Go to{" "}
                  <em>Online Store → Themes → Edit Code → theme.liquid</em> and paste
                  just before <code style={{ color: "#fcd34d" }}>&lt;/head&gt;</code>.
                </div>
              </div>
            )}

            <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "20px", lineHeight: 1.6 }}>
              After pasting the script, come back and click &quot;Verify Again&quot; to confirm the connection.
            </div>

            <button style={S.btn} onClick={handleVerify}>
              🔄 Verify Again
            </button>
            <button style={S.btnOutline} onClick={() => router.push("/")}>
              ← Back to Analysis
            </button>
          </>
        )}

        {/* ── ACTIVATING ── */}
        {step === "activating" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <span style={S.successCheck}>⚡</span>
            <div style={{ ...S.title, textAlign: "center" }}>Activating Nolix…</div>
            <div style={{ ...S.sub, textAlign: "center", marginTop: "8px" }}>
              Starting the revenue recovery engine for {domain}
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {step === "done" && (
          <div style={{ textAlign: "center" }}>
            <span style={S.successCheck}>🎉</span>
            <div style={{ ...S.title, textAlign: "center" }}>Nolix is Live!</div>
            <div style={{ ...S.sub, textAlign: "center", margin: "8px auto 28px", maxWidth: "380px" }}>
              Zeno is now monitoring <strong>{domain}</strong> in real-time.
              Your dashboard will show live data as visitors come in.
            </div>
            <button
              style={S.btn}
              onClick={() => router.push("/dashboard")}
            >
              Go to Dashboard →
            </button>
            <button
              style={{ ...S.btnOutline, marginTop: "8px" }}
              onClick={() => router.push("/")}
            >
              Analyze Another Store
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            background: "#050508",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#94a3b8",
            fontFamily: "Inter, sans-serif",
          }}
        >
          Loading…
        </div>
      }
    >
      <ActivateContent />
    </Suspense>
  );
}
