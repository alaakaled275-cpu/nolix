"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");

  useEffect(() => {
    fetch("/api/audit/logs")
      .then(r => r.json())
      .then(data => {
        setLogs(data.logs || []);
        if (data.note) setNote(data.note);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#ededed", fontFamily: "system-ui" }}>
      {/* Sidebar Simulation for Dashboard */}
      <div style={{ display: "flex", height: "100vh" }}>
        <div style={{ width: 250, background: "#111", borderRight: "1px solid #333", padding: 20 }}>
          <h2 style={{ fontSize: 20, color: "#fff", marginBottom: 30 }}>Nolix Dashboard</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            <Link href="/dashboard" style={{ color: "#888", textDecoration: "none" }}>Overview</Link>
            <Link href="/dashboard/analytics" style={{ color: "#888", textDecoration: "none" }}>Analytics</Link>
            <Link href="/dashboard/audit" style={{ color: "#fff", textDecoration: "none", fontWeight: "bold" }}>Trust & Audit Log</Link>
            <Link href="/dashboard/billing" style={{ color: "#888", textDecoration: "none" }}>Billing</Link>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, padding: 40, overflowY: "auto" }}>
          <h1 style={{ fontSize: 28, marginBottom: 10 }}>Attribution Audit Log</h1>
          <p style={{ color: "#aaa", marginBottom: 30, maxWidth: 600 }}>
            Absolute Transparency. We only charge you for conversions we explicitly influenced. 
            Here is the exact cryptographic trace proving how our AI popup led directly to a completed order.
          </p>

          {note && (
            <div style={{ background: "#332200", border: "1px solid #aa8800", color: "#ffcc00", padding: 15, borderRadius: 6, marginBottom: 20 }}>
              <strong>Notice:</strong> {note}
            </div>
          )}

          <div style={{ background: "#111", border: "1px solid #333", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#1a1a1a", borderBottom: "1px solid #333" }}>
                  <th style={{ padding: 15, color: "#888", fontWeight: "normal" }}>Trace ID</th>
                  <th style={{ padding: 15, color: "#888", fontWeight: "normal" }}>AI Detection</th>
                  <th style={{ padding: 15, color: "#888", fontWeight: "normal" }}>Popup Shown</th>
                  <th style={{ padding: 15, color: "#888", fontWeight: "normal" }}>Order ID</th>
                  <th style={{ padding: 15, color: "#888", fontWeight: "normal", textAlign: "right" }}>Attributed Revenue</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ padding: 30, textAlign: "center" }}>Loading audit trails...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 30, textAlign: "center" }}>No attributed conversions yet.</td></tr>
                ) : (
                  logs.map((log, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                      <td style={{ padding: 15, fontFamily: "monospace", color: "#666" }}>{log.trace_id}</td>
                      <td style={{ padding: 15 }}>
                        <span style={{ background: "#222", padding: "4px 8px", borderRadius: 4, fontSize: 12 }}>{log.intent}</span>
                      </td>
                      <td style={{ padding: 15, color: "#aaa" }}>
                        {log.action} <br/>
                        <small style={{ color: "#555" }}>{new Date(log.popup_time).toLocaleString()}</small>
                      </td>
                      <td style={{ padding: 15, color: "#00aaff" }}>
                        {log.order_id} <br/>
                        <small style={{ color: "#555" }}>{new Date(log.conversion_time).toLocaleString()}</small>
                      </td>
                      <td style={{ padding: 15, textAlign: "right", fontWeight: "bold", color: "#0f0" }}>
                        +${typeof log.revenue_attributed === 'number' ? log.revenue_attributed.toFixed(2) : parseFloat(log.revenue_attributed).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
