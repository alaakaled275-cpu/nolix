"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("nolix_admin_token");
    const savedEmail = localStorage.getItem("nolix_admin_email");
    
    if (token && savedEmail) {
      try {
        const adminEmailFromToken = atob(token).split(":")[0];
        if (adminEmailFromToken === savedEmail) {
          setIsLoggedIn(true);
          fetchAdminStats(token);
        }
      } catch {
        handleLogout();
      }
    } else {
      setLoading(false);
    }
  }, []);

  const fetchAdminStats = async (token: string) => {
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const json = await res.json();
      if (res.ok) {
        setStats(json.data);
      } else {
        // If 500 error (like DB disconnected), API still sends fallback data in json.data if handled
        if (json.data) setStats(json.data);
        setErrorMsg(json.error || "Failed to fetch stats");
      }
    } catch (err: any) {
      setErrorMsg("Network error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("nolix_admin_token");
    localStorage.removeItem("nolix_admin_email");
    router.push("/admin_login_jw904l20fk2_8_____2mdcy_cq");
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#07080f", color: "#dde3f8" }}>
        Loading Ops System...
      </div>
    );
  }

  if (!isLoggedIn) {
    router.push("/admin_login_jw904l20fk2_8_____2mdcy_cq");
    return null;
  }

  const adminEmail = localStorage.getItem("nolix_admin_email") || "";

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "system-ui, sans-serif", padding: 20 }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30, paddingBottom: 20, borderBottom: "1px solid #333" }}>
          <div>
            <h1 style={{ fontSize: 28, margin: 0 }}>Nolix Internal Ops</h1>
            <p style={{ color: "#888", fontSize: 14, margin: "5px 0 0 0" }}>Enterprise Command Center — Logged in as {adminEmail}</p>
          </div>
          <button onClick={handleLogout} style={{ padding: "8px 16px", background: "#d32f2f", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>
            Logout
          </button>
        </div>

        {errorMsg && (
          <div style={{ background: "#330000", border: "1px solid #f00", color: "#f88", padding: 15, borderRadius: 6, marginBottom: 20 }}>
            <strong>System Alert:</strong> {errorMsg}
          </div>
        )}

        {/* High Level Metrics */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, marginBottom: 40 }}>
            <div style={{ background: "#111", border: "1px solid #333", padding: 20, borderRadius: 8 }}>
              <div style={{ color: "#aaa", fontSize: 13, textTransform: "uppercase" }}>Total Stores</div>
              <div style={{ fontSize: 32, fontWeight: "bold", color: "#fff", marginTop: 10 }}>{stats.metrics?.totalStores || 0}</div>
            </div>
            <div style={{ background: "#111", border: "1px solid #333", padding: 20, borderRadius: 8 }}>
              <div style={{ color: "#aaa", fontSize: 13, textTransform: "uppercase" }}>Active Subs</div>
              <div style={{ fontSize: 32, fontWeight: "bold", color: "#0f0", marginTop: 10 }}>{stats.metrics?.activeSubscriptions || 0}</div>
            </div>
            <div style={{ background: "#111", border: "1px solid #333", padding: 20, borderRadius: 8 }}>
              <div style={{ color: "#aaa", fontSize: 13, textTransform: "uppercase" }}>Total Revenue</div>
              <div style={{ fontSize: 32, fontWeight: "bold", color: "#00aaff", marginTop: 10 }}>${stats.metrics?.totalRevenue?.toFixed(2) || "0.00"}</div>
            </div>
            <div style={{ background: "#111", border: "1px solid #333", padding: 20, borderRadius: 8 }}>
              <div style={{ color: "#aaa", fontSize: 13, textTransform: "uppercase" }}>Events (24h)</div>
              <div style={{ fontSize: 32, fontWeight: "bold", color: "#f0f", marginTop: 10 }}>{stats.metrics?.eventsLast24h || 0}</div>
            </div>
          </div>
        )}

        {/* Financial Intelligence Block */}
        {stats?.metrics?.financial && (
          <div style={{ background: "#051105", border: "1px solid #004400", borderRadius: 8, padding: 20, marginBottom: 40, display: "flex", gap: 30 }}>
            <div>
              <div style={{ color: "#0f0", fontSize: 12, textTransform: "uppercase", fontWeight: "bold" }}>Financial Intelligence</div>
              <div style={{ color: "#888", fontSize: 13, marginTop: 5 }}>AI Costs vs Revenue Margins</div>
            </div>
            <div style={{ borderLeft: "1px solid #003300", paddingLeft: 20 }}>
              <div style={{ color: "#aaa", fontSize: 11 }}>Est. AI Cost (Groq)</div>
              <div style={{ color: "#f55", fontSize: 20, fontWeight: "bold" }}>${stats.metrics.financial.aiCost.toFixed(4)}</div>
            </div>
            <div style={{ borderLeft: "1px solid #003300", paddingLeft: 20 }}>
              <div style={{ color: "#aaa", fontSize: 11 }}>AI Decisions Made</div>
              <div style={{ color: "#fff", fontSize: 20, fontWeight: "bold" }}>{stats.metrics.financial.aiCalls.toLocaleString()}</div>
            </div>
            <div style={{ borderLeft: "1px solid #003300", paddingLeft: 20 }}>
              <div style={{ color: "#aaa", fontSize: 11 }}>Net Profit Margin</div>
              <div style={{ color: "#0f0", fontSize: 20, fontWeight: "bold" }}>{stats.metrics.financial.profitMargin}%</div>
            </div>
          </div>
        )}

        {/* Live Table */}
        <div style={{ background: "#111", border: "1px solid #333", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: 20, borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>Registered Stores (Live DB)</h2>
            <button style={{ background: "#333", color: "#fff", border: "none", padding: "5px 10px", borderRadius: 4, cursor: "pointer" }} onClick={() => fetchAdminStats(localStorage.getItem("nolix_admin_token") || "")}>
              Refresh Data
            </button>
          </div>
          
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#1a1a1a", borderBottom: "1px solid #333" }}>
                <th style={{ padding: 15, color: "#888", fontWeight: "normal" }}>Domain</th>
                <th style={{ padding: 15, color: "#888", fontWeight: "normal" }}>Status</th>
                <th style={{ padding: 15, color: "#888", fontWeight: "normal" }}>Created At</th>
                <th style={{ padding: 15, color: "#888", fontWeight: "normal" }}>Revenue</th>
                <th style={{ padding: 15, color: "#888", fontWeight: "normal", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {(!stats || !stats.stores || stats.stores.length === 0) ? (
                <tr>
                  <td colSpan={5} style={{ padding: 30, textAlign: "center", color: "#666" }}>
                    {stats?.note || "No stores found or DB disconnected."}
                  </td>
                </tr>
              ) : (
                stats.stores.map((store: any) => (
                  <tr key={store.id} style={{ borderBottom: "1px solid #222" }}>
                    <td style={{ padding: 15 }}>{store.domain}</td>
                    <td style={{ padding: 15 }}>
                      <span style={{ 
                        background: store.subscription_status === 'active' ? '#033' : '#333', 
                        color: store.subscription_status === 'active' ? '#0f0' : '#aaa', 
                        padding: "4px 8px", 
                        borderRadius: 12, 
                        fontSize: 12 
                      }}>
                        {store.subscription_status || 'free'}
                      </span>
                    </td>
                    <td style={{ padding: 15, color: "#aaa" }}>{new Date(store.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: 15, color: "#00aaff" }}>${store.last_invoice_amount || "0.00"}</td>
                    <td style={{ padding: 15, textAlign: "right" }}>
                      <button style={{ background: "#222", color: "#fff", border: "1px solid #444", padding: "5px 10px", borderRadius: 4, cursor: "pointer", marginRight: 5 }}>Inspect</button>
                      <button style={{ background: "#300", color: "#f44", border: "1px solid #500", padding: "5px 10px", borderRadius: 4, cursor: "pointer" }}>Suspend</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}