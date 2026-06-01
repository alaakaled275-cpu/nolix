"use client";

import { useState } from "react";

export default function AffiliatePortal() {
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [refCode, setRefCode] = useState("");

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    // Mocking an API call to register an affiliate
    setRefCode("NOLIX_" + Math.random().toString(36).substring(2, 8).toUpperCase());
    setJoined(true);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "system-ui", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 600, width: "100%", padding: 40, background: "#111", border: "1px solid #333", borderRadius: 16 }}>
        <h1 style={{ fontSize: 32, marginBottom: 10, textAlign: "center" }}>Nolix Partner Program</h1>
        <p style={{ color: "#aaa", textAlign: "center", marginBottom: 30 }}>
          Acquisition System: Earn 30% recurring commission for every Shopify store you bring to Nolix.
        </p>

        {!joined ? (
          <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            <label style={{ fontSize: 14, color: "#888" }}>Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ padding: 15, background: "#000", border: "1px solid #444", color: "#fff", borderRadius: 8, fontSize: 16 }}
              placeholder="you@agency.com"
            />
            <button type="submit" style={{ padding: 15, background: "#0f0", color: "#000", border: "none", borderRadius: 8, fontSize: 16, fontWeight: "bold", cursor: "pointer" }}>
              Join Partner Program
            </button>
          </form>
        ) : (
          <div style={{ textAlign: "center", padding: 20, background: "#022", border: "1px solid #044", borderRadius: 8 }}>
            <h2 style={{ color: "#0f0", margin: "0 0 10px 0" }}>Welcome, Partner!</h2>
            <p style={{ color: "#aaa", marginBottom: 20 }}>Your unique tracking link is ready. Share this to start earning.</p>
            <div style={{ background: "#000", padding: 15, border: "1px dashed #555", borderRadius: 4, fontFamily: "monospace", fontSize: 18, color: "#fff" }}>
              https://nolix.ai/?ref={refCode}
            </div>
            <div style={{ marginTop: 20, fontSize: 12, color: "#666" }}>
              You will see your earnings in the dashboard once a user installs the script and pays their first invoice.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
