"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "./landing.css";

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
      "$5,000 – $20,000",
      "$20,000 – $50,000",
      "$50,000 – $100,000",
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
      "1,000 – 5,000 visitors/month",
      "5,000 – 20,000 visitors/month",
      "20,000 – 50,000 visitors/month",
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
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1=Email, 2=Name, 3=Questions, 4=URL
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  
  // Wizard state
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customTexts, setCustomTexts] = useState<Record<string, string>>({});

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
        setStep(2);
      }
    } catch (err) {
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
        setStep(3); // Go to questions
      }
    } catch (err) {
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
    
    // Validation
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
      // Questions finished! Submit answers
      submitAnswers();
    }
  };

  const submitAnswers = async () => {
    setStatus("loading");
    
    // Compile final answers combining selections and custom inputs
    const finalAnswers: Record<string, string> = {};
    for (const q of QUESTIONS) {
      const val = answers[q.id];
      finalAnswers[q.title] = val === "Another" ? `Another: ${customTexts[q.id]}` : val;
    }

    // Save to localStorage for Zeno
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
        setStatus("idle");
        setStep(4); // Move to final URL input
      }
    } catch (err) {
      setStatus("error");
      setMessage("Connection error. Please try again.");
    }
  };

  const handleSubmitFinalUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeUrl) return;

    setStatus("loading");
    setMessage("");

    try {
      // Update DB with the storeURL
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, storeUrl }),
      });
      
      if (!res.ok) {
        setStatus("error");
        setMessage("Failed to save URL.");
      } else {
        setStatus("success");
        // Navigate to Zeno Results!
        router.push(`/results?store=${encodeURIComponent(storeUrl)}`);
      }
    } catch (err) {
      setStatus("error");
      setMessage("Connection error. Please try again.");
    }
  };

  return (
    <div className={`page ${step === 4 ? "centerLayout" : ""}`}>
      {/* Background Interactive Video */}
      <video autoPlay loop muted playsInline className="videoBg">
        <source src="/TensorPix - zm3291x49nrmr0cwbp7vb4nx38_result_.mp4" type="video/mp4" />
      </video>

      <div className="overlay" aria-hidden />

      {/* Top Left Header (Logo and Brand Name) */}
      <header className="topHeader">
        <div className="brandWrap">
          <div className="logoIcon">
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M50 15 L85 35 L85 75 L50 95 L50 63 L65 54 L65 43 L50 34 L35 43 L35 54 L50 63 L50 95 L15 75 L15 35 Z" fill="#EF4444" />
            </svg>
          </div>
          <div className="logoText">
            <span className="logoTextWhite">NOLI</span>
            <span className="logoTextX">X</span>
          </div>
        </div>
      </header>

      {step < 4 ? (
        <div className="contentContainer">
          {/* Left Column (Copy in professional format) */}
          <div className="leftCol">
            <div className="leftEyebrow">NOLIX</div>
            <h1 className="headerTitle">Stop losing 80% of your visitors.</h1>
            <p className="headerDesc">
              Increase your revenue by 10-50% monthly. <strong>NOLIX</strong> analyzes every customer in real time and makes the right decisions to increase conversions, maximize profits, and minimize wasted discounts.
            </p>
            <p className="headerDesc">
              This isn&apos;t just a tool… it&apos;s the brain of your company.<br />
              An intelligent system that analyzes, decides, and executes—turning every interaction into a real financial result.
            </p>
          </div>

          {/* Right Column */}
          <div className="rightCol">
            {step === 1 && (
              <form onSubmit={handleSubmitStep1} className="formBox slideUp">
                <div className="stepIndicator">Step 1 of 3</div>
                <h2 className="formTitle">Let's get started</h2>
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
                <button type="submit" className="submitBtn" disabled={status === "loading"}>
                  <span>{status === "loading" ? "Processing..." : "Continue"}</span>
                  <span>→</span>
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
                  <span>→</span>
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
                      <div key={opt} className={`optionCard ${isSelected ? "selected" : ""}`} onClick={() => handleOptionSelect(opt)}>
                        <div className="optionRadio"><div className="radioInner" /></div>
                        {opt}
                      </div>
                    );
                  })}
                </div>

                {answers[QUESTIONS[qIndex].id] === "Another" && (
                  <div className="inputWrap fade-in" style={{ marginTop: '1rem' }}>
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
                  style={{ marginTop: '2rem' }}
                >
                  <span>{status === "loading" ? "Saving..." : qIndex === QUESTIONS.length - 1 ? "Finish Configuration" : "Next Question"}</span>
                  {status !== "loading" && <span>→</span>}
                </button>
              </div>
            )}

            {message && <div className="message messageError">{message}</div>}

            {/* Social Icons row exactly below button like image */}
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
              <a href="#" className="socialIcon">
                <svg width="16" height="16" viewBox="0 0 1200 1227" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z" fill="currentColor" />
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
      ) : (
        /* STEP 4: URL Input - Centered Layout (Like original UI) */
        <div className="urlContainer fade-in">
          <div className="urlContent">
            <div className="urlIconWrap">
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="urlIcon">
                 <path d="M50 15 L85 35 L85 75 L50 95 L50 63 L65 54 L65 43 L50 34 L35 43 L35 54 L50 63 L50 95 L15 75 L15 35 Z" fill="#EF4444" />
              </svg>
            </div>
            <h1 className="urlTitle">Enter your store URL to begin AI Analysis</h1>
            <p className="urlDesc">Zeno will securely connect, fetch data, and build a localized revenue intelligence report.</p>
            
            <form onSubmit={handleSubmitFinalUrl} className="urlForm">
              <div className="urlInputWrap">
                <span className="urlProtocol">https://</span>
                <input
                  type="text"
                  className="urlInputField"
                  placeholder="yourstore.com"
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value.replace(/^https?:\/\//, ''))}
                  disabled={status === "loading" || status === "success"}
                  required
                />
              </div>
              
              <button 
                type="submit" 
                className="submitBtn urlSubmitBtn"
                disabled={status === "loading" || status === "success"}
              >
                {status === "loading" ? "Connecting Zeno Data..." : "Start Analysis"}
              </button>
            </form>
            {message && <div className="message messageError" style={{ marginTop: '1rem' }}>{message}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
