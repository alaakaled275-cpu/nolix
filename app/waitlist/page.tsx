"use client";

import { useState, useEffect } from "react";
import "./waitlist.css";
import { useRouter } from "next/navigation";

const QUESTIONS = [
  {
    id: "type",
    title: "Store/Website Type",
    desc: "To understand the niche to tailor strategies.",
    options: [
      "Fashion/Clothing/Accessories",
      "Electronics/Appliances",
      "Home/Furniture",
      "Beauty/Health",
      "Books/Education/Digital Content",
      "Services/Subscriptions",
      "Another"
    ]
  },
  {
    id: "revenue",
    title: "Monthly Sales Volume (Revenue)",
    desc: "To determine size and tailor offers.",
    options: [
      "Under $5,000",
      "$5,000 - $20,000",
      "$20,000 - $50,000",
      "$50,000 - $100,000",
      "Over $100,000",
      "Another"
    ]
  },
  {
    id: "traffic",
    title: "Monthly Website Visitors",
    desc: "To estimate data volume and determine analytics.",
    options: [
      "Less than 1,000 visitors/month",
      "1,000 - 5,000 visitors/month",
      "5,000 - 20,000 visitors/month",
      "20,000 - 50,000 visitors/month",
      "More than 50,000 visitors/month",
      "Another"
    ]
  },
  {
    id: "challenge",
    title: "Biggest Challenge You Face",
    desc: "To understand critical points for direct AI solutions.",
    options: [
      "Low conversion rate (Conversion)",
      "Marketing/Customer Acquisition",
      "Inventory/Product Management",
      "Customer Support/Retention",
      "Pricing and Profit Margin",
      "Another"
    ]
  },
  {
    id: "goal",
    title: "Main Objective for NOLIX",
    desc: "To guide AI to make the most impactful decisions.",
    options: [
      "Increase conversion rate and sales",
      "Reduce churn and increase retention",
      "Manage smart offers and discounts",
      "Analyze customers and make accurate decisions",
      "Comprehensive integration and data transformation",
      "Another"
    ]
  }
];

export default function WaitlistPage() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customTexts, setCustomTexts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmitStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match. Please try again.");
      return;
    }
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Failed to join waitlist.");
      } else {
        setStatus("idle");
        setMessage("");
        localStorage.setItem('nolix_user_email', email);
        setStep(2);
      }
    } catch {
      setStatus("error");
      setMessage("Connection error. Please try again.");
    }
  };

  const handleSubmitStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Failed to save details.");
      } else {
        setStatus("idle");
        setMessage("");
        localStorage.setItem('nolix_user_name', name);
        setStep(3);
      }
    } catch {
      setStatus("error");
      setMessage("Connection error. Please try again.");
    }
  };

  const handleOptionSelect = (opt: string) => {
    const q = QUESTIONS[qIndex];
    setAnswers(prev => ({ ...prev, [q.id]: opt }));
  };

  const handleNextQuestion = () => {
    const q = QUESTIONS[qIndex];
    const selected = answers[q.id];
    if (!selected) {
      setMessage("Please select an option.");
      return;
    }
    if (selected === "Another" && !customTexts[q.id]) {
      setMessage("Please specify your answer.");
      return;
    }
    setMessage("");
    if (qIndex < QUESTIONS.length - 1) {
      setQIndex(qIndex + 1);
    } else {
      submitAnswers();
    }
  };

  const submitAnswers = async () => {
    setStatus("loading");
    const finalAnswers: Record<string, string> = {};
    for (const q of QUESTIONS) {
      const val = answers[q.id];
      finalAnswers[q.title] = val === "Another" ? "Another: " + (customTexts[q.id] || "") : val;
    }
    localStorage.setItem("zeno_quiz_answers", JSON.stringify(finalAnswers));
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, quizAnswers: finalAnswers }),
      });
      if (!res.ok) {
        setStatus("error");
        setMessage("Failed to save answers.");
      } else {
        localStorage.setItem("nolix_logged_in", "true");
        router.push("/dashboard");
      }
    } catch {
      setStatus("error");
      setMessage("Connection error. Please try again.");
    }
  };

  if (!mounted) return null;

  return (
    <div className="page">
      <video autoPlay loop muted playsInline className="videoBg">
        <source src="/TensorPix - zm3291x49nrmr0cwbp7vb4nx38_result_.mp4" type="video/mp4" />
      </video>
      <div className="overlay" aria-hidden />
      <header className="topHeader">
        <div className="brandWrap">
          <a href="/" className="logoText">
            Nolix<span className="logoTextAccent">.ai</span>
          </a>
        </div>
      </header>
      <div className="contentContainer">
        <div className="leftCol">
          <div className="leftEyebrow">Zeno Intelligence Engine</div>
          <h1 className="headerTitle">
            Stop losing 80% of your{" "}
            <em>visitors</em>
          </h1>
          <p className="headerDesc">
            Increase your revenue by 10–50% monthly. <strong>Nolix</strong> analyzes every customer in real time and makes the right decisions to increase conversions, maximize profits, and minimize wasted discounts.
          </p>
          <p className="headerDesc">
            This is not just a tool — it is the brain of your store.<br />
            An intelligent system that analyzes, decides, and executes, turning every interaction into a real financial result.
          </p>
          <div className="trustRow">
            {[
              { icon: "⚡", text: "Real-time AI decisions" },
              { icon: "🔒", text: "No code needed" },
              { icon: "🎯", text: "Revenue-attributed results" },
            ].map(t => (
              <div key={t.text} className="trustBadge">
                <span>{t.icon}</span>
                <span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rightCol">
          {step === 1 && (
            <form onSubmit={handleSubmitStep1} className="formBox slideUp">
              <div className="stepIndicator">Step 1 of 3</div>
              <h2 className="formTitle">Let&apos;s get started</h2>
              <div className="inputWrap">
                <input
                  type="email"
                  className="inputField"
                  placeholder="Enter your Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === "loading"}
                  required
                />
              </div>
              <div className="inputWrap" style={{ marginTop: "1rem" }}>
                <input
                  type="password"
                  className="inputField"
                  placeholder="Enter a Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={status === "loading"}
                  required
                  minLength={8}
                />
              </div>
              <div className="inputWrap" style={{ marginTop: "1rem" }}>
                <input
                  type="password"
                  className="inputField"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={status === "loading"}
                  required
                  minLength={8}
                />
              </div>
              <button type="submit" className="submitBtn" disabled={status === "loading"} style={{ marginTop: "2rem" }}>
                <span>{status === "loading" ? "Processing..." : "Continue"}</span>
                <span>-&gt;</span>
              </button>
            </form>
          )}
          {step === 2 && (
            <form onSubmit={handleSubmitStep2} className="formBox slideUp">
              <div className="stepIndicator">Step 2 of 3</div>
              <h2 className="formTitle">Welcome aboard</h2>
              <div className="inputWrap">
                <input
                  type="text"
                  className="inputField"
                  placeholder="What is your name?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={status === "loading"}
                  required
                />
              </div>
              <button type="submit" className="submitBtn" disabled={status === "loading"}>
                <span>{status === "loading" ? "Saving..." : "Continue"}</span>
                <span>-&gt;</span>
              </button>
            </form>
          )}
          {step === 3 && (
            <div className="formBox slideUp wideBox">
              <div className="stepIndicator">Question {qIndex + 1} of {QUESTIONS.length}</div>
              <h2 className="formTitle">{QUESTIONS[qIndex].title}</h2>
              <p className="formSubtitle">{QUESTIONS[qIndex].desc}</p>
              <div className="optionsGrid">
                {QUESTIONS[qIndex].options.map(opt => {
                  const isSelected = answers[QUESTIONS[qIndex].id] === opt;
                  return (
                    <div key={opt} className={"optionCard" + (isSelected ? " selected" : "")} onClick={() => handleOptionSelect(opt)}>
                      <div className="optionRadio"><div className="radioInner" /></div>
                      {opt}
                    </div>
                  );
                })}
              </div>
              {answers[QUESTIONS[qIndex].id] === "Another" && (
                <div className="inputWrap fade-in" style={{ marginTop: "1rem" }}>
                  <input
                    type="text"
                    className="inputField"
                    placeholder="Please specify..."
                    value={customTexts[QUESTIONS[qIndex].id] || ""}
                    onChange={(e) => setCustomTexts(prev => ({ ...prev, [QUESTIONS[qIndex].id]: e.target.value }))}
                    autoFocus
                  />
                </div>
              )}
              <button
                onClick={handleNextQuestion}
                className="submitBtn"
                disabled={status === "loading"}
                style={{ marginTop: "2rem" }}
              >
                <span>{status === "loading" ? "Saving..." : qIndex === QUESTIONS.length - 1 ? "Finish Configuration" : "Next Question"}</span>
                {status !== "loading" && <span>-&gt;</span>}
              </button>
            </div>
          )}
          {message && <div className="message messageError">{message}</div>}
          <div className="socialIcons">
            <a href="#" className="socialIcon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
            </a>
            <a href="#" className="socialIcon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
              </svg>
            </a>
            <a href="mailto:contact@nolix.app" className="socialIcon">
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