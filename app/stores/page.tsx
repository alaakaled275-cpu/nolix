"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Code2, CheckCircle2, XCircle, RefreshCw, ExternalLink, 
  Shield, Copy, Zap, Globe, Terminal, ChevronRight, Activity,
  Eye, AlertCircle, Loader2, RefreshCcw
} from "lucide-react";
import "../dashboard/dashboard.css";
import "./stores.css";

interface Store {
  id: string;
  domain: string;
  public_key: string;
  plan: string;
  active: boolean;
}

interface CheckResult {
  domain: string;
  checked_at: string;
  installed: boolean;
  script_found: boolean;
  http_status?: number;
  has_https?: boolean;
  error?: string;
  recommendation: string;
}

interface TestResult {
  test_id: string;
  store_domain: string;
  store_status: string;
  plan: string;
  triggered_at: string;
  synthetic_visitor: any;
  decision: any;
  success: boolean;
  note: string;
}

type Tab = "install" | "test" | "secure";

export default function StoresPage() {
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>("install");
  const [store, setStore] = useState<Store | null>(null);
  const [loadingStore, setLoadingStore] = useState(true);

  const [checkStatus, setCheckStatus] = useState<"idle" | "checking" | "done">("idle");
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [checkError, setCheckError] = useState("");

  const [testStatus, setTestStatus] = useState<"idle" | "running" | "done">("idle");
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

  // Fetch store data
  const fetchStore = useCallback(async () => {
    setLoadingStore(true);
    try {
      const res = await fetch("/api/stores/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStore(data.store);
      }
    } catch { /* silent */ }
    finally { setLoadingStore(false); }
  }, []);

  useEffect(() => { fetchStore(); }, [fetchStore]);

  // Script snippet
  const scriptSnippet = store
    ? `<script
  src="${typeof window !== "undefined" ? window.location.origin : "https://your-app.com"}/master.js"
  data-key="${store.public_key}"
  defer
></script>`
    : "";

  const copySnippet = () => {
    navigator.clipboard.writeText(scriptSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Check script installation
  const handleCheck = async () => {
    if (!store) return;
    setCheckStatus("checking");
    setCheckError("");
    setCheckResult(null);

    try {
      const res = await fetch(`/api/stores/check?domain=https://${store.domain}`, {
        credentials: "include",
      });
      const data = await res.json();
      setCheckResult(data);
      setCheckStatus("done");
    } catch (err: any) {
      setCheckError(err.message || "Failed to check store");
      setCheckStatus("done");
    }
  };

  // Test script
  const handleTest = async () => {
    if (!store) return;
    setTestStatus("running");
    setTestResult(null);

    try {
      const res = await fetch("/api/stores/test", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      setTestResult(data);
      setTestStatus("done");
    } catch (err: any) {
      setTestStatus("done");
    }
  };

  // Rotate key
  const handleRotate = async () => {
    setRotating(true);
    try {
      const res = await fetch("/api/stores/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rotate_key" }),
        credentials: "include",
      });
      const data = await res.json();
      if (data.new_public_key) {
        setStore(prev => prev ? { ...prev, public_key: data.new_public_key } : prev);
      }
    } catch { /* silent */ }
    finally { setRotating(false); }
  };

  const navLinks = [
    { name: "Home", href: "/", icon: Globe },
    { name: "Stores", href: "/stores", icon: Code2 },
    { name: "Settings", href: "/register", icon: Shield },
    { name: "Billing", href: "/waitlist", icon: Activity },
  ];

  return (
    <div className="stores-root">
      <div className="stores-frame">

        {/* ── TOP NAV ── */}
        <div className="stores-hero">
          <div className="stores-topbar">
            <div className="stores-logo">
              <div className="stores-logo-icon">
                <Activity size={16} color="white" />
              </div>
              <span className="stores-logo-name">ZenoAI</span>
              <span className="stores-logo-badge">AR-OS</span>
            </div>

            <nav className="stores-nav">
              {navLinks.map(({ name, href, icon: Icon }) => (
                <Link
                  key={name}
                  href={href}
                  className={`stores-nav-link${pathname === href ? " active" : ""}`}
                >
                  <Icon size={14} />
                  {name}
                </Link>
              ))}
            </nav>

            <div className="stores-topbar-right">
              <div className="stores-store-badge">
                <div style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: store?.active ? "var(--accent-green)" : "var(--accent-red)",
                  boxShadow: store?.active ? "0 0 8px var(--accent-green)" : "none",
                  animation: store?.active ? "livePulse 2s infinite" : "none",
                }} />
                {store?.domain || "Loading..."}
              </div>
              <div className="stores-plan-badge pro">
                ✦ {store?.plan || "..."}
              </div>
            </div>
          </div>
        </div>

        {/* ── HERO BANNER ── */}
        <div className="stores-hero-banner" style={{ marginBottom: 20 }}>
          <div className="stores-hero-label">Script Management</div>
          <div className="stores-hero-value" style={{ fontSize: 36, letterSpacing: -1 }}>
            <Code2 size={36} style={{ display: "inline", verticalAlign: "middle", marginRight: 12 }} />
            NOLIX Script
          </div>
          <div className="stores-hero-meta">
            Copy, install, verify, and test your store's AI script
          </div>
        </div>

        {/* ── STORE INFO CARD ── */}
        <div className="stores-card" style={{ marginBottom: 16 }}>
          <div className="stores-card-header">
            <div className="stores-card-title">Store Information</div>
            {store && (
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>
                ID: {store.id.slice(0, 8)}…
              </span>
            )}
          </div>
          <div style={{ padding: 20 }}>
            {loadingStore ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text-muted)" }}>
                <Loader2 size={16} className="spin" />
                <span style={{ fontSize: 12, fontFamily: "var(--mono)" }}>Loading store data...</span>
              </div>
            ) : store ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>
                    Store Domain
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--mono)" }}>
                    {store.domain}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>
                    Public Key
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "var(--mono)", wordBreak: "break-all" }}>
                    {store.public_key.slice(0, 20)}...{store.public_key.slice(-8)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>
                    Status
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: store.active ? "var(--accent-green)" : "var(--accent-red)",
                    }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: store.active ? "var(--accent-green)" : "var(--accent-red)" }}>
                      {store.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>
                    Plan
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase" }}>
                    {store.plan}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                No store found. Add your store URL in{" "}
                <Link href="/dashboard/settings" style={{ color: "var(--accent-blue)" }}>Settings</Link>.
              </div>
            )}
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "var(--surface-hover)", padding: "4px 4px", borderRadius: "var(--radius-md)", border: "0.5px solid var(--border-md)" }}>
          {(["install", "test", "secure"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: "10px 16px", borderRadius: "var(--radius-sm)",
                border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                textTransform: "capitalize", transition: "all 0.15s",
                background: tab === t ? "var(--surface-solid)" : "transparent",
                color: tab === t ? "var(--text-primary)" : "var(--text-muted)",
                boxShadow: tab === t ? "var(--shadow-card)" : "none",
                fontFamily: "var(--font)",
              }}
            >
              {t === "install" && <Copy size={14} />}
              {t === "test" && <Terminal size={14} />}
              {t === "secure" && <Shield size={14} />}
              {t === "install" ? "Install Script" : t === "test" ? "Test Script" : "Security"}
            </button>
          ))}
        </div>

        {/* ── INSTALL TAB ── */}
        {tab === "install" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Script Code Block */}
            <div className="stores-card">
              <div className="stores-card-header">
                <div className="stores-card-title">
                  <Code2 size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
                  Your NOLIX Script
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handleRotate}
                    disabled={rotating}
                    style={{
                      display: "flex", alignItems: "center", gap: 5, padding: "5px 12px",
                      borderRadius: "var(--radius-sm)", border: "0.5px solid var(--border-md)",
                      background: "var(--surface-solid)", color: "var(--text-secondary)",
                      fontSize: 11, fontWeight: 700, cursor: rotating ? "wait" : "pointer",
                      fontFamily: "var(--font)",
                    }}
                  >
                    <RefreshCcw size={12} className={rotating ? "spin" : ""} />
                    Rotate Key
                  </button>
                  <button
                    onClick={copySnippet}
                    style={{
                      display: "flex", alignItems: "center", gap: 5, padding: "5px 12px",
                      borderRadius: "var(--radius-sm)", border: "0.5px solid var(--border-md)",
                      background: "var(--surface-solid)", color: copied ? "var(--accent-green)" : "var(--text-secondary)",
                      fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font)",
                    }}
                  >
                    <Copy size={12} />
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
              <div style={{ padding: "16px 20px" }}>
                <pre style={{
                  background: "var(--bg)", border: "0.5px solid var(--border-md)",
                  borderRadius: "var(--radius-sm)", padding: 16, fontSize: 12,
                  fontFamily: "var(--mono)", color: "var(--text-primary)",
                  overflow: "auto", lineHeight: 1.8, margin: 0,
                }}>
                  <code>{scriptSnippet}</code>
                </pre>
              </div>
            </div>

            {/* Installation Steps */}
            <div className="stores-card">
              <div className="stores-card-header">
                <div className="stores-card-title">
                  <ChevronRight size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
                  Installation Steps
                </div>
              </div>
              <div style={{ padding: 20 }}>
                {[
                  { step: 1, title: "Copy the Script", desc: "Copy the code above using the Copy button.", icon: Copy },
                  { step: 2, title: "Open Your Store's Admin", desc: "Go to your Shopify admin, WordPress settings, or any CMS theme editor.", icon: Globe },
                  { step: 3, title: "Paste in <head>", desc: "Paste the script before the closing </head> tag of your theme.", icon: Code2 },
                  { step: 4, title: "Save and Publish", desc: "Save your changes and publish the theme.", icon: CheckCircle2 },
                  { step: 5, title: "Verify Installation", desc: "Use the Test Script tab to confirm it's working.", icon: Eye },
                ].map(({ step, title, desc, icon: Icon }) => (
                  <div key={step} style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "flex-start" }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      background: "var(--accent-green-bg)", border: "1px solid rgba(61,168,95,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Icon size={16} color="var(--accent-green)" />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>
                        {step}. {title}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Platform Guides */}
            <div className="stores-card">
              <div className="stores-card-header">
                <div className="stores-card-title">Platform Guides</div>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                  {[
                    { name: "Shopify", desc: "Online Store → Themes → Edit Code → theme.liquid", color: "#95bf47" },
                    { name: "WooCommerce", desc: "Appearance → Theme Editor → footer.php", color: "#9b5c8f" },
                    { name: "BigCommerce", desc: "Storefront → My Themes → Edit HTML", color: "#4f46e5" },
                    { name: "Custom HTML", desc: "Add before </body> in your HTML template", color: "#64748b" },
                  ].map(({ name, desc, color }) => (
                    <div key={name} style={{
                      padding: "12px 14px", border: "0.5px solid var(--border-md)",
                      borderRadius: "var(--radius-sm)", background: "var(--surface-hover)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{name}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TEST TAB ── */}
        {tab === "test" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Check Installation */}
            <div className="stores-card">
              <div className="stores-card-header">
                <div className="stores-card-title">
                  <Eye size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
                  Check Script Installation
                </div>
              </div>
              <div style={{ padding: 20 }}>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
                  Verify that the NOLIX script is correctly installed on your store by scanning your store's HTML.
                </p>
                <button
                  onClick={handleCheck}
                  disabled={checkStatus === "checking" || !store}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
                    background: checkStatus === "checking" ? "var(--surface-hover)" : "var(--surface-solid)",
                    color: "var(--text-primary)", border: "0.5px solid var(--border-md)",
                    borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 700,
                    cursor: checkStatus === "checking" ? "wait" : "pointer", fontFamily: "var(--font)",
                  }}
                >
                  {checkStatus === "checking" ? (
                    <><Loader2 size={14} className="spin" /> Scanning...</>
                  ) : (
                    <><RefreshCw size={14} /> Check Now</>
                  )}
                </button>

                {checkError && (
                  <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--accent-red-bg)", border: "0.5px solid rgba(224,69,69,0.3)", borderRadius: "var(--radius-sm)", fontSize: 12, color: "var(--accent-red)", display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertCircle size={14} /> {checkError}
                  </div>
                )}

                {checkResult && (
                  <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Status Badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {checkResult.installed ? (
                        <CheckCircle2 size={22} color="var(--accent-green)" />
                      ) : checkResult.error ? (
                        <XCircle size={22} color="var(--accent-red)" />
                      ) : (
                        <XCircle size={22} color="var(--accent-yellow)" />
                      )}
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                          {checkResult.installed ? "Script Found!" : checkResult.error ? "Error" : "Script Not Detected"}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>
                          Checked: {checkResult.checked_at}
                        </div>
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                      {[
                        { label: "Domain", value: checkResult.domain },
                        { label: "HTTP Status", value: checkResult.http_status?.toString() || "—" },
                        { label: "HTTPS", value: checkResult.has_https ? "✓ Yes" : "✗ No" },
                        { label: "Script Found", value: checkResult.script_found ? "✓ Yes" : "✗ No" },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ padding: "10px 12px", background: "var(--surface-hover)", borderRadius: "var(--radius-sm)", border: "0.5px solid var(--border-md)" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--mono)" }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Recommendation */}
                    <div style={{ padding: "12px 16px", background: checkResult.installed ? "var(--accent-green-bg)" : "var(--accent-blue-bg)", border: `0.5px solid ${checkResult.installed ? "rgba(61,168,95,0.25)" : "rgba(37,99,235,0.2)"}`, borderRadius: "var(--radius-sm)" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: checkResult.installed ? "var(--accent-green)" : "var(--accent-blue)", marginBottom: 2 }}>
                        {checkResult.installed ? "✓ Protection Active" : checkResult.error ? "⚠ Issue Detected" : "⚠ Action Needed"}
                      </div>
                      <div style={{ fontSize: 12, color: checkResult.installed ? "var(--accent-green-dark)" : "var(--text-secondary)" }}>
                        {checkResult.recommendation}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Test Decision Engine */}
            <div className="stores-card">
              <div className="stores-card-header">
                <div className="stores-card-title">
                  <Zap size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
                  Test Decision Engine
                </div>
              </div>
              <div style={{ padding: 20 }}>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
                  Send a synthetic visitor event to your store's AI engine and see the real-time decision it makes.
                  This verifies that your script can communicate with ZenoAI's backend.
                </p>
                <button
                  onClick={handleTest}
                  disabled={testStatus === "running" || !store}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
                    background: testStatus === "running" ? "var(--surface-hover)" : "var(--surface-solid)",
                    color: "var(--text-primary)", border: "0.5px solid var(--border-md)",
                    borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 700,
                    cursor: testStatus === "running" ? "wait" : "pointer", fontFamily: "var(--font)",
                  }}
                >
                  {testStatus === "running" ? (
                    <><Loader2 size={14} className="spin" /> Running Test...</>
                  ) : (
                    <><Zap size={14} /> Run Test</>
                  )}
                </button>

                {testResult && (
                  <div style={{ marginTop: 16 }}>
                    {/* Test Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      {testResult.success ? (
                        <CheckCircle2 size={20} color="var(--accent-green)" />
                      ) : (
                        <XCircle size={20} color="var(--accent-red)" />
                      )}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                          {testResult.success ? "Test Successful" : "Test Failed"}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>
                          Test ID: {testResult.test_id}
                        </div>
                      </div>
                    </div>

                    {/* Test Info */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
                      {[
                        { label: "Store", value: testResult.store_domain },
                        { label: "Store Status", value: testResult.store_status },
                        { label: "Plan", value: testResult.plan },
                        { label: "Triggered At", value: new Date(testResult.triggered_at).toLocaleTimeString() },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ padding: "8px 10px", background: "var(--surface-hover)", borderRadius: "var(--radius-sm)", border: "0.5px solid var(--border-md)" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--mono)" }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Synthetic Visitor */}
                    {testResult.synthetic_visitor && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                          Synthetic Visitor Data
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {Object.entries(testResult.synthetic_visitor).map(([key, val]) => (
                            <div key={key} style={{ padding: "4px 10px", background: "var(--surface-hover)", border: "0.5px solid var(--border-md)", borderRadius: "var(--radius-sm)", fontSize: 11 }}>
                              <span style={{ color: "var(--text-muted)" }}>{key}:</span>{" "}
                              <span style={{ fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--mono)" }}>{String(val)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI Decision */}
                    {testResult.decision && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                          AI Decision
                        </div>
                        <div style={{ padding: "12px 16px", background: "var(--bg)", border: "0.5px solid var(--border-md)", borderRadius: "var(--radius-sm)", fontFamily: "var(--mono)", fontSize: 11, overflow: "auto", maxHeight: 200 }}>
                          <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: "var(--text-primary)" }}>
                            {JSON.stringify(testResult.decision, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Note */}
                    <div style={{ padding: "10px 14px", background: testResult.success ? "var(--accent-green-bg)" : "var(--accent-red-bg)", border: `0.5px solid ${testResult.success ? "rgba(61,168,95,0.25)" : "rgba(224,69,69,0.2)"}`, borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 700, color: testResult.success ? "var(--accent-green)" : "var(--accent-red)" }}>
                      {testResult.note}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── SECURITY TAB ── */}
        {tab === "secure" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Key Security */}
            <div className="stores-card">
              <div className="stores-card-header">
                <div className="stores-card-title">
                  <Shield size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
                  API Key Security
                </div>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { icon: "✓", label: "Public Key (Embed)", desc: "Safe to embed in your store's frontend. Used to identify your store in browser-side script.", color: "var(--accent-green)" },
                    { icon: "✗", label: "Secret Key", desc: "Never exposed to the browser. Used only for server-to-server communication with NOLIX backend.", color: "var(--accent-red)" },
                    { icon: "✓", label: "HTTPS Only", desc: "All script connections are encrypted. Your store and visitor data are fully protected.", color: "var(--accent-green)" },
                    { icon: "✓", label: "Key Rotation", desc: "You can rotate your public key anytime from this page. Old keys are immediately invalidated.", color: "var(--accent-green)" },
                    { icon: "✓", label: "Tenant Isolation", desc: "Each store has its own API key. No data leakage between stores.", color: "var(--accent-green)" },
                  ].map(({ icon, label, desc, color }) => (
                    <div key={label} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                        background: color + "20", border: `1px solid ${color}40`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700, color,
                      }}>
                        {icon}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Script Security */}
            <div className="stores-card">
              <div className="stores-card-header">
                <div className="stores-card-title">
                  <Shield size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
                  Script Security Features
                </div>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                  {[
                    { title: "Privacy-First", desc: "No cookies. Only sessionStorage. No PII collected." },
                    { title: "12KB Async", desc: "Loads asynchronously — zero impact on page speed." },
                    { title: "GDPR Compliant", desc: "All data processing follows GDPR guidelines." },
                    { title: "SOC2 Ready", desc: "Enterprise-grade security compliance." },
                  ].map(({ title, desc }) => (
                    <div key={title} style={{ padding: "12px 14px", background: "var(--surface-hover)", border: "0.5px solid var(--border-md)", borderRadius: "var(--radius-sm)" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}