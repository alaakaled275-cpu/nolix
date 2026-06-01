"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function FirstResultActivation() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, this fetches the specific store's stats
    // We simulate the API call here to demonstrate the First Result framework
    setTimeout(() => {
      setStats({
        scriptInstalled: true,
        firstVisitor: true,
        firstIntervention: false,
        firstDollarSaved: false,
      });
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) return <div style={{ padding: 40, color: "#fff" }}>جلب حالة التفعيل...</div>;

  const progress = [
    stats.scriptInstalled,
    stats.firstVisitor,
    stats.firstIntervention,
    stats.firstDollarSaved
  ].filter(Boolean).length;

  const percentage = (progress / 4) * 100;

  return (
    <div style={{ background: "#111", border: "1px solid #333", borderRadius: 12, padding: 30, marginBottom: 30 }}>
      <h2 style={{ margin: "0 0 10px 0", color: "#fff" }}>🔥 طريقك إلى "النتيجة الأولى" (First Result)</h2>
      <p style={{ color: "#aaa", marginBottom: 20 }}>
        نحن لا نهتم بالداشبورد المليئة بالأرقام المعقدة. نحن نهتم بشيء واحد فقط: أن ترى أول دولار يتم إنقاذه لك بواسطة ذكائنا الاصطناعي بأسرع وقت ممكن.
      </p>

      {/* Progress Bar */}
      <div style={{ background: "#222", height: 10, borderRadius: 5, marginBottom: 30, overflow: "hidden" }}>
        <div style={{ background: "#0f0", width: `${percentage}%`, height: "100%", transition: "width 0.5s ease" }}></div>
      </div>

      {/* Steps */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
        
        <div style={{ borderLeft: `4px solid ${stats.scriptInstalled ? "#0f0" : "#444"}`, paddingLeft: 15, opacity: stats.scriptInstalled ? 1 : 0.5 }}>
          <h3 style={{ color: stats.scriptInstalled ? "#0f0" : "#fff", margin: "0 0 5px 0", fontSize: 16 }}>1. تركيب السكربت</h3>
          <p style={{ color: "#888", fontSize: 13, margin: 0 }}>تم تركيب السكربت بنجاح في متجرك.</p>
        </div>

        <div style={{ borderLeft: `4px solid ${stats.firstVisitor ? "#0f0" : "#444"}`, paddingLeft: 15, opacity: stats.firstVisitor ? 1 : 0.5 }}>
          <h3 style={{ color: stats.firstVisitor ? "#0f0" : "#fff", margin: "0 0 5px 0", fontSize: 16 }}>2. أول زائر</h3>
          <p style={{ color: "#888", fontSize: 13, margin: 0 }}>تم رصد أول زائر حقيقي لمتجرك.</p>
        </div>

        <div style={{ borderLeft: `4px solid ${stats.firstIntervention ? "#0f0" : "#444"}`, paddingLeft: 15, opacity: stats.firstIntervention ? 1 : 0.5 }}>
          <h3 style={{ color: stats.firstIntervention ? "#0f0" : "#fff", margin: "0 0 5px 0", fontSize: 16 }}>3. أول تدخل ذكي</h3>
          <p style={{ color: "#888", fontSize: 13, margin: 0 }}>ننتظر عميلاً يتردد ليتدخل الذكاء الاصطناعي.</p>
        </div>

        <div style={{ borderLeft: `4px solid ${stats.firstDollarSaved ? "#0f0" : "#444"}`, paddingLeft: 15, opacity: stats.firstDollarSaved ? 1 : 0.5 }}>
          <h3 style={{ color: stats.firstDollarSaved ? "#0f0" : "#fff", margin: "0 0 5px 0", fontSize: 16 }}>4. أول دولار مُنقذ!</h3>
          <p style={{ color: "#888", fontSize: 13, margin: 0 }}>الهدف النهائي. إتمام أول عملية بيع بفضل Nolix.</p>
        </div>

      </div>
    </div>
  );
}
