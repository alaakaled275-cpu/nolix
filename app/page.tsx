"use client";

import { useState } from "react";
import styles from "./landing.module.css";

export default function WaitlistPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmitStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Failed to join waitlist.");
      } else {
        setStatus("idle");
        setMessage("");
        setStep(2); // Move to step 2 automatically
      }
    } catch (err) {
      setStatus("error");
      setMessage("Connection error. Please try again.");
    }
  };

  const handleSubmitStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !storeUrl) {
      setStatus("error");
      setMessage("Please fill out all fields.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, storeUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Failed to save details.");
      } else {
        setStatus("success");
        setMessage("Perfect! Moving to Zeno setup...");
        // After completing step 2, wait to move to second phase in backend/frontend.
        setTimeout(() => {
          // The user mentions Phase 2 questions here, for now we just show success
        }, 1500);
      }
    } catch (err) {
      setStatus("error");
      setMessage("Connection error. Please try again.");
    }
  };

  return (
    <div className={styles.page}>
      {/* Background Interactive Video (muted, autoplay, loop) */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className={styles.videoBg}
      >
        <source src="/TensorPix - zm3291x49nrmr0cwbp7vb4nx38_result_.mp4" type="video/mp4" />
      </video>

      {/* Reduced Darkness Overlay */}
      <div className={styles.overlay} aria-hidden />

      {/* Top Left Header (Logo and Brand Name) */}
      <header className={styles.topHeader}>
        <div className={styles.brandWrap}>
          <div className={styles.logoIcon}>
            {/* The Isometric Red Cube SVG matches the 2nd image */}
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M50 15 L85 35 L85 75 L50 95 L50 63 L65 54 L65 43 L50 34 L35 43 L35 54 L50 63 L50 95 L15 75 L15 35 Z" fill="#EF4444" />
            </svg>
          </div>
          <div className={styles.logoText}>
            <span className={styles.logoTextWhite}>NOLI</span>
            <span className={styles.logoTextX}>X</span>
          </div>
        </div>
      </header>

      {/* Center Layout (Split Left/Right) */}
      <div className={styles.contentContainer}>
        
        {/* Left Column (Copy in professional format) */}
        <div className={styles.leftCol}>
          <div className={styles.leftEyebrow}>NOLIX</div>
          <h1 className={styles.headerTitle}>Stop losing 80% of your visitors.</h1>
          
          <p className={styles.headerDesc}>
            Increase your revenue by 10-50% monthly. <strong>NOLIX</strong> company It analyzes every customer in real time and makes the right decisions to increase conversions, maximize profits, and minimize wasted discounts.
          </p>
          <p className={styles.headerDesc}>
            This isn&apos;t just a tool… it&apos;s the brain of your company.<br/>
            An intelligent system that analyzes, decides, and executes—turning every interaction into a real financial result.
          </p>
        </div>

        {/* Right Column (Multi-Step Form) */}
        <div className={styles.rightCol}>
          
          {step === 1 ? (
            <form onSubmit={handleSubmitStep1} className={styles.formBox}>
              <div className={styles.inputWrap}>
                <input
                  type="email"
                  className={styles.inputField}
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === "loading"}
                  required
                />
              </div>
              
              <button 
                type="submit" 
                className={styles.submitBtn}
                disabled={status === "loading"}
              >
                <span>{status === "loading" ? "Processing..." : "Get Notified"}</span>
                <span>→</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmitStep2} className={styles.formBox}>
              <div className={styles.inputWrap}>
                <input
                  type="text"
                  className={styles.inputField}
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={status === "loading" || status === "success"}
                  required
                />
              </div>
              <div className={styles.inputWrap}>
                <input
                  type="text"
                  className={styles.inputField}
                  placeholder="Store / Website URL"
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                  disabled={status === "loading" || status === "success"}
                  required
                />
              </div>
              
              <button 
                type="submit" 
                className={styles.submitBtn}
                disabled={status === "loading" || status === "success"}
              >
                <span>{status === "loading" ? "Saving..." : status === "success" ? "Done!" : "Complete"}</span>
                {status !== "success" && <span>→</span>}
              </button>
            </form>
          )}

          {message && (
            <div className={`${styles.message} ${status === "success" ? styles.messageSuccess : styles.messageError}`}>
              {message}
            </div>
          )}

          {/* Social Icons row exactly below button like image */}
          <div className={styles.socialIcons}>
            {/* Instagram */}
            <a href="#" className={styles.socialIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
            </a>
            
            {/* Facebook */}
            <a href="#" className={styles.socialIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
              </svg>
            </a>
            
            {/* X / Twitter */}
            <a href="#" className={styles.socialIcon}>
              <svg width="16" height="16" viewBox="0 0 1200 1227" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z" fill="currentColor"/>
              </svg>
            </a>

            {/* TikTok */}
            <a href="#" className={styles.socialIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.01.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.95v7.4c-.01 2.98-1.73 5.82-4.5 6.94-2.82 1.15-6.22.42-8.32-1.57-2.06-1.92-2.73-4.9-1.76-7.55C3.01 10.61 5.6 8.78 8.44 8.52c.31-.03.62-.03.93-.01v4.06c-1.39.08-2.78.89-3.4 2.15-.6 1.22-.44 2.72.39 3.79s2.1 1.65 3.51 1.51c1.37-.14 2.58-1.14 2.89-2.48.11-.47.16-1.19.16-1.74V.02h-.4z" />
              </svg>
            </a>
            
            {/* Mail */}
            <a href="mailto:contact@nolix.app" className={styles.socialIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
              </svg>
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}
