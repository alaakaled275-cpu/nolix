"use client";

import { useState } from "react";

const JOBS = [
  { id: 1, title: "Senior Backend Engineer (PostgreSQL/Node)", type: "Full-Time", location: "Remote" },
  { id: 2, title: "Growth Hacker (Acquisition Systems)", type: "Full-Time", location: "Remote" },
  { id: 3, title: "Customer Success Manager", type: "Full-Time", location: "Remote" },
];

export default function CareersPage() {
  const [selectedJob, setSelectedJob] = useState<number | null>(null);
  const [applied, setApplied] = useState(false);

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API call to Hiring System ATS (e.g. Workable / Greenhouse)
    setApplied(true);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "system-ui", padding: 40 }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <h1 style={{ fontSize: 36, marginBottom: 10 }}>Nolix Careers (Hiring System)</h1>
        <p style={{ color: "#aaa", fontSize: 18, marginBottom: 40 }}>
          We don't just write code. We build 12 distinct systems that form a massive Enterprise SaaS. 
          Join us in building the brain of e-commerce.
        </p>

        {applied ? (
          <div style={{ background: "#030", border: "1px solid #0f0", padding: 30, borderRadius: 12, textAlign: "center" }}>
            <h2 style={{ color: "#0f0" }}>Application Received!</h2>
            <p>Our ATS (Applicant Tracking System) has processed your profile. We will be in touch.</p>
            <button onClick={() => setApplied(false)} style={{ background: "#222", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 6, marginTop: 15, cursor: "pointer" }}>
              Back to jobs
            </button>
          </div>
        ) : selectedJob === null ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            {JOBS.map(job => (
              <div key={job.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#111", border: "1px solid #333", padding: 20, borderRadius: 8 }}>
                <div>
                  <h3 style={{ margin: "0 0 5px 0", fontSize: 18 }}>{job.title}</h3>
                  <div style={{ color: "#888", fontSize: 14 }}>{job.type} • {job.location}</div>
                </div>
                <button onClick={() => setSelectedJob(job.id)} style={{ background: "#fff", color: "#000", border: "none", padding: "10px 20px", borderRadius: 6, fontWeight: "bold", cursor: "pointer" }}>
                  Apply Now
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: "#111", border: "1px solid #333", padding: 30, borderRadius: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>Apply for {JOBS.find(j => j.id === selectedJob)?.title}</h2>
              <button onClick={() => setSelectedJob(null)} style={{ background: "transparent", color: "#888", border: "none", cursor: "pointer" }}>✕ Cancel</button>
            </div>
            
            <form onSubmit={handleApply} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              <div>
                <label style={{ display: "block", marginBottom: 5, color: "#888" }}>Full Name</label>
                <input type="text" required style={{ width: "100%", padding: 12, background: "#000", border: "1px solid #444", color: "#fff", borderRadius: 6, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 5, color: "#888" }}>LinkedIn URL / Portfolio</label>
                <input type="url" required style={{ width: "100%", padding: 12, background: "#000", border: "1px solid #444", color: "#fff", borderRadius: 6, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 5, color: "#888" }}>Why Nolix?</label>
                <textarea required rows={4} style={{ width: "100%", padding: 12, background: "#000", border: "1px solid #444", color: "#fff", borderRadius: 6, boxSizing: "border-box" }}></textarea>
              </div>
              <button type="submit" style={{ padding: 15, background: "#0f0", color: "#000", border: "none", borderRadius: 6, fontSize: 16, fontWeight: "bold", cursor: "pointer", marginTop: 10 }}>
                Submit Application
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
