"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Activity, Zap, Users, FlaskConical, Hexagon, Bell, BarChart3, SlidersHorizontal, Plug, CreditCard, DollarSign, Key, Wifi, WifiOff, RefreshCw } from "lucide-react";
import "./dashboard.css";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Activity, href: "/dashboard" },
  { id: "engine", label: "AI Engine", icon: Zap, href: "/dashboard/engine" },
  { id: "visitors", label: "Visitors", icon: Users, href: "/dashboard/visitors" },
  { id: "experiments", label: "Experiments", icon: FlaskConical, href: "/dashboard/experiments" },
  { id: "pricing", label: "Pricing", icon: Hexagon, href: "/dashboard/pricing" },
  { id: "alerts", label: "Alerts", icon: Bell, href: "/dashboard/alerts" },
  { id: "reports", label: "Reports", icon: BarChart3, href: "/dashboard/reports" },
  { id: "calibration", label: "Calibration", icon: SlidersHorizontal, href: "/dashboard/calibration" },
  { id: "integrations", label: "Integrations", icon: Plug, href: "/dashboard/integrations" },
  { id: "payouts", label: "Payouts", icon: CreditCard, href: "/dashboard/payouts" },
  { id: "revshare", label: "Revenue Share", icon: DollarSign, href: "/dashboard/revshare" },
];

function checkScriptInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return !!((window as any).NOLIX_CONFIG || document.querySelector('script[data-nolix]'));
}

function getStoredAuth(): { loggedIn: boolean; verified: boolean; storeId: string; domain: string; onboardingComplete: boolean } {
  if (typeof window === 'undefined') return { loggedIn: false, verified: false, storeId: '', domain: '', onboardingComplete: false };
  return {
    loggedIn: localStorage.getItem('nolix_logged_in') === 'true',
    verified: localStorage.getItem('nolix_verified') === 'true',
    storeId: localStorage.getItem('nolix_store_id') || '',
    domain: localStorage.getItem('nolix_store_domain') || '',
    onboardingComplete: localStorage.getItem('nolix_onboarding_complete') === 'true'
  };
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [darkMode, setDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [scriptInstalled, setScriptInstalled] = useState(true);
  const [lastCheck, setLastCheck] = useState(0);

  const checkSecurity = useCallback(() => {
    const auth = getStoredAuth();
    
    if (!auth.loggedIn) {
      router.push('/waitlist');
      return;
    }
    
    setIsLoggedIn(true);
    
    // Onboarding is integrated into /dashboard page — no redirect needed
    
    setIsLoading(false);
  }, [router]);

  useEffect(() => {
    checkSecurity();
  }, [checkSecurity]);

  useEffect(() => {
    if (!isLoggedIn || showOnboarding) return;
    
    const interval = setInterval(() => {
      const installed = checkScriptInstalled();
      setScriptInstalled(installed);
      setLastCheck(Date.now());
      
      if (!installed) {
        setShowOnboarding(true);
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isLoggedIn, showOnboarding]);

  const regenerateKeys = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const newStoreId = result;
    const newToken = 'nxt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 15);
    
    localStorage.setItem('nolix_store_id', newStoreId);
    localStorage.setItem('nolix_installation_token', newToken);
    localStorage.setItem('nolix_onboarding_complete', 'false');
    localStorage.setItem('nolix_verified', 'false');
    
    router.push('/dashboard');
  };

  if (isLoading) {
    return (
      <div className="ops-loading-screen">
        <div className="ops-loading-spinner"></div>
        <p>Verifying Security...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  if (showOnboarding || !scriptInstalled) {
    return (
      <div className="ar-root">
        <div className="ar-frame">
          <div className="ar-topnav">
            <div className="ar-logo">
              <div className="ar-logo-icon">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="#1a1a1a" strokeWidth="1.5"/>
                  <line x1="8" y1="2" x2="8" y2="14" stroke="#1a1a1a" strokeWidth="1.2"/>
                  <line x1="2" y1="8" x2="14" y2="8" stroke="#1a1a1a" strokeWidth="1.2"/>
                </svg>
              </div>
              <span>AR-OS</span>
            </div>
            <div className="ar-nav-right">
              <div className="ops-connection-indicator disconnected">
                <WifiOff size={14} />
              </div>
              <button className="ar-avatar" onClick={() => {
                localStorage.clear();
                window.location.href = '/waitlist';
              }}>A</button>
            </div>
          </div>
        </div>
        
        <div className="ops-verification-error">
          <div className="ops-error-container">
            <div className="ops-error-icon">
              <WifiOff size={48} />
            </div>
            <h1>Script Connection Lost</h1>
            <p>Your NOLIX script is not responding. Dashboard access is blocked until you reinstall.</p>
            <div className="ops-error-actions">
              <button className="ops-btn-primary" onClick={() => router.push('/dashboard')}>
                <RefreshCw size={18} /> Reinstall Script
              </button>
            </div>
            <div className="ops-last-check">
              Last check: {new Date(lastCheck).toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activePage = navItems.find(item => pathname === item.href || pathname.startsWith(item.href + "/"))?.id || "dashboard";

  return (
    <div className={`ar-root${darkMode ? " dark-mode" : ""}`}>
      <div className="ar-frame">
        <div className="ar-topnav">
          <div className="ar-logo">
            <div className="ar-logo-icon">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="#1a1a1a" strokeWidth="1.5"/>
                <line x1="8" y1="2" x2="8" y2="14" stroke="#1a1a1a" strokeWidth="1.2"/>
                <line x1="2" y1="8" x2="14" y2="8" stroke="#1a1a1a" strokeWidth="1.2"/>
              </svg>
            </div>
            <span>AR-OS</span>
          </div>

          <div className="ar-nav-pill">
            <svg viewBox="0 0 14 14" fill="none" width="14" height="14">
              <rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" opacity="0.7"/>
              <rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor" opacity="0.7"/>
              <rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor" opacity="0.7"/>
              <rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" opacity="0.7"/>
            </svg>
            <span id="active-page-label">
              {navItems.find(i => i.id === activePage)?.label || "Dashboard"}
            </span>
          </div>

          <div className="ar-nav-right">
            <div className={`ops-connection-indicator ${scriptInstalled ? "connected" : "disconnected"}`}>
              {scriptInstalled ? <Wifi size={14} /> : <WifiOff size={14} />}
            </div>
            <button className="ar-nav-btn" onClick={regenerateKeys} title="Regenerate Keys">
              <Key size={14} />
            </button>
            <button
              className="ar-theme-btn"
              onClick={() => setDarkMode(d => !d)}
              title="Toggle dark mode"
            >
              {darkMode ? (
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" width="14" height="14">
                  <circle cx="7" cy="7" r="2.5"/>
                  <line x1="7" y1="1" x2="7" y2="2.5"/>
                  <line x1="7" y1="11.5" x2="7" y2="13"/>
                  <line x1="1" y1="7" x2="2.5" y2="7"/>
                  <line x1="11.5" y1="7" x2="13" y2="7"/>
                </svg>
              ) : (
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" width="14" height="14">
                  <path d="M11.5 8.5A5 5 0 015.5 2.5a5 5 0 100 9 5 5 0 006-3z"/>
                </svg>
              )}
            </button>
            <button className="ar-avatar" onClick={() => {
              localStorage.clear();
              window.location.href = '/waitlist';
            }}>A</button>
          </div>
        </div>

        <div className="ar-content">{children}</div>
      </div>
    </div>
  );
}