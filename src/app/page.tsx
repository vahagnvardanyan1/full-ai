"use client";

import { useEffect, useState } from "react";
import { HeroSection } from "@/components/landing/hero-section";
import { AgentVisualization } from "@/components/landing/agent-visualization";
import { IntegrationStrip } from "@/components/landing/integration-strip";
import { AiProviders } from "@/components/landing/ai-providers";
import { FeaturesSection } from "@/components/landing/features-section";
import { LandingFooter } from "@/components/landing/landing-footer";
import { ThemeToggle } from "@/components/theme-toggle";

function BottomCTA({ visible }: { visible: boolean }) {
  return (
    <div
      className="landing-nav landing-bottom-cta"
      style={{
        position: "fixed",
        bottom: visible ? 16 : -80,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        padding: "0.5rem 0.6rem 0.5rem 1.25rem",
        background: "rgba(10, 10, 10, 0.8)",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 50,
        boxShadow: "0 4px 30px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(255,255,255,0.05) inset",
        transition: "bottom 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        whiteSpace: "nowrap" as const,
      }}
    >
      <span className="landing-bottom-cta-text" style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--text-muted)" }}>
        Ready to ship faster?
      </span>
      <a
        href="/app"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.45rem 1.15rem",
          borderRadius: 50,
          background: "linear-gradient(135deg, #22c55e, #16a34a)",
          color: "#fff",
          fontSize: "0.78rem",
          fontWeight: 600,
          textDecoration: "none",
          transition: "all 0.2s",
          boxShadow: "0 2px 12px rgba(34,197,94,0.3)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "linear-gradient(135deg, #16a34a, #15803d)";
          e.currentTarget.style.boxShadow = "0 2px 20px rgba(34,197,94,0.5)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "linear-gradient(135deg, #22c55e, #16a34a)";
          e.currentTarget.style.boxShadow = "0 2px 12px rgba(34,197,94,0.3)";
        }}
      >
        Launch App
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </a>
    </div>
  );
}

export default function LandingPage() {
  const [showBottom, setShowBottom] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowBottom(window.scrollY > window.innerHeight * 0.6);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="landing-dot-grid" style={{ minHeight: "100vh" }}>
      {/* Fixed nav bar */}
      <nav
        style={{
          position: "fixed",
          top: 14,
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(720px, calc(100% - 32px))",
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.55rem 0.6rem 0.55rem 1.25rem",
          background: "rgba(10, 10, 10, 0.75)",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 50,
          boxShadow: "0 4px 30px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(255,255,255,0.05) inset",
        }}
        className="landing-nav"
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "rgba(34,197,94,0.12)",
            border: "1px solid rgba(34,197,94,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="#22c55e" strokeWidth="2" />
              <circle cx="12" cy="4" r="1.5" fill="#22c55e" opacity="0.7" />
              <circle cx="20" cy="12" r="1.5" fill="#22c55e" opacity="0.7" />
              <circle cx="12" cy="20" r="1.5" fill="#22c55e" opacity="0.7" />
              <circle cx="4" cy="12" r="1.5" fill="#22c55e" opacity="0.7" />
            </svg>
          </div>
          <span
            style={{
              fontSize: "0.88rem",
              fontWeight: 700,
              fontFamily: "var(--font-display)",
              color: "var(--text)",
              letterSpacing: "-0.01em",
            }}
          >
            AI Team
          </span>
          {/* className applied via parent nav.landing-nav */}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <ThemeToggle />
          <a
            href="/app"
            style={{
              padding: "0.45rem 1.15rem",
              borderRadius: 50,
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
              color: "#fff",
              fontSize: "0.78rem",
              fontWeight: 600,
              textDecoration: "none",
              transition: "all 0.2s",
              boxShadow: "0 2px 12px rgba(34,197,94,0.3)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, #16a34a, #15803d)";
              e.currentTarget.style.boxShadow = "0 2px 20px rgba(34,197,94,0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, #22c55e, #16a34a)";
              e.currentTarget.style.boxShadow = "0 2px 12px rgba(34,197,94,0.3)";
            }}
          >
            Launch App
          </a>
        </div>
      </nav>

      <HeroSection />
      <AgentVisualization />
      <IntegrationStrip />
      <AiProviders />
      <div style={{ height: "3rem" }} />
      <FeaturesSection />
      <div style={{ height: "3rem" }} />
      <LandingFooter />
      <BottomCTA visible={showBottom} />
    </div>
  );
}
