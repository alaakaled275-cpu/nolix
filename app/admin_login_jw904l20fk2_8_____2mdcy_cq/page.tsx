"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    
    if (!email || !password) {
      setError("Please enter email and password");
      setLoading(false);
      return;
    }
    
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json();

      if (data.success) {
        localStorage.setItem("nolix_admin_token", data.token);
        localStorage.setItem("nolix_admin_email", data.admin.email);
        router.push("/admin_jw904l20fk2_8_____2mdcy_cq");
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Connection error");
    }
    
    setLoading(false);
  };

  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      height: "100vh", 
      background: "#07080f", 
      color: "#dde3f8", 
      fontFamily: "system-ui, sans-serif", 
      flexDirection: "column", 
      gap: 16 
    }}>
      <div style={{ fontSize: 24, fontWeight: 700 }}>NEXOUARA ADMIN</div>
      <div style={{ fontSize: 13, color: "#8b95c0" }}>Login to access admin</div>
      
      <input 
        type="text" 
        placeholder="Email"
        value={email} 
        onChange={e => setEmail(e.target.value)} 
        style={{ 
          padding: "12px 16px", 
          borderRadius: 6, 
          border: "1px solid #282d48", 
          background: "#0e1020", 
          color: "#dde3f8", 
          width: 260, 
          fontSize: 14 
        }} 
      />
      <input 
        type="password" 
        placeholder="Password"
        value={password} 
        onChange={e => setPassword(e.target.value)} 
        style={{ 
          padding: "12px 16px", 
          borderRadius: 6, 
          border: "1px solid #282d48", 
          background: "#0e1020", 
          color: "#dde3f8", 
          width: 260, 
          marginTop: 8, 
          fontSize: 14 
        }} 
      />
      <button 
        onClick={handleLogin}
        disabled={loading}
        style={{ 
          padding: "12px 24px", 
          background: loading ? "#555" : "#6c5ce7", 
          color: "#fff", 
          border: "none", 
          borderRadius: 6, 
          marginTop: 16, 
          cursor: loading ? "not-allowed" : "pointer", 
          fontWeight: 600, 
          fontSize: 14,
          width: 260
        }}
      >
        {loading ? "Loading..." : "Login"}
      </button>
      
      {error && <p style={{ color: "#ff5070", marginTop: 12, fontSize: 13 }}>{error}</p>}
    </div>
  );
}