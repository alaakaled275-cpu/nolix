"use client";

import { useState } from "react";
import styles from "./landing.module.css";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
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
        setMessage(data.error || "Failed to join waitlist. Please try again.");
      } else {
        setStatus("success");
        setMessage(data.message || "You're on the list!");
        setEmail("");
      }
    } catch (err) {
      setStatus("error");
      setMessage("Something went wrong. Please check your connection.");
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

      {/* Dark Overlay for readability */}
      <div className={styles.overlay} aria-hidden />

      {/* Main Content Container over video */}
      <div className={styles.contentContainer}>
        
        {/* The Mockup Layout */}
        <div className={styles.splitLayout}>
          
          {/* Left Column (Top in mobile) */}
          <div className={styles.leftCol}>
            {/* Logo replacement for "Untitled" */}
            <div className={styles.eyebrow}>
              <div className={styles.logoText}>NOLI<span className={styles.eyebrowX}>X</span></div>
            </div>
            
            <h1 className={styles.title}>
              Dignissim ac col sociis<br />commodo sagittis
            </h1>
            
            <p className={styles.description}>
              Neque, euismod mauris etiam aptent aliquam, Rusum urna dolor 
              etiam mattis felis enim nec præsent. ullamcorper sagitis tempus 
              ipsum sedugufas venedlies.
            </p>
          </div>

          {/* Right Column (Form & Socials) */}
          <div className={styles.rightCol}>
            <form onSubmit={handleSubmit} className={styles.formBox}>
              <div className={styles.inputWrap}>
                <input
                  type="email"
                  className={styles.inputField}
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === "loading" || status === "success"}
                  required
                />
              </div>
              
              <button 
                type="submit" 
                className={styles.submitBtn}
                disabled={status === "loading" || status === "success"}
              >
                <span>{status === "loading" ? "Joining..." : status === "success" ? "Subscribed" : "Get Notified"}</span>
                <span>→</span>
              </button>
              
              {message && (
                <div className={`${styles.message} ${status === "success" ? styles.messageSuccess : styles.messageError}`}>
                  {message}
                </div>
              )}
            </form>

            {/* Social Icons row */}
            <div className={styles.socialIcons}>
              {/* Instagram */}
              <a href="#" className={styles.socialIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </a>
              
              {/* Facebook */}
              <a href="#" className={styles.socialIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                </svg>
              </a>
              
              {/* X / Twitter icon SVG */}
              <a href="#" className={styles.socialIcon}>
                <svg width="18" height="18" viewBox="0 0 1200 1227" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z" fill="currentColor"/>
                </svg>
              </a>

              {/* TikTok icon SVG */}
              <a href="#" className={styles.socialIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.01.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.95v7.4c-.01 2.98-1.73 5.82-4.5 6.94-2.82 1.15-6.22.42-8.32-1.57-2.06-1.92-2.73-4.9-1.76-7.55C3.01 10.61 5.6 8.78 8.44 8.52c.31-.03.62-.03.93-.01v4.06c-1.39.08-2.78.89-3.4 2.15-.6 1.22-.44 2.72.39 3.79s2.1 1.65 3.51 1.51c1.37-.14 2.58-1.14 2.89-2.48.11-.47.16-1.19.16-1.74V.02h-.4z" />
                </svg>
              </a>
              
              {/* Mail */}
              <a href="mailto:contact@nolix.app" className={styles.socialIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                </svg>
              </a>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
