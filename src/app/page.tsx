"use client";

import { HeroSection } from "@/components/landing/hero-section";
import { AgentVisualization } from "@/components/landing/agent-visualization";
import { IntegrationStrip } from "@/components/landing/integration-strip";
import { AiProviders } from "@/components/landing/ai-providers";
import { FeaturesSection } from "@/components/landing/features-section";
import { LandingFooter } from "@/components/landing/landing-footer";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LandingPage() {
  return (
    <div className="landing-dot-grid" style={{ minHeight: "100vh" }}>
      {/* Fixed nav bar */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 1.5rem",
          background: "var(--topbar-bg)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--glass-border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" stroke="var(--accent)" strokeWidth="1.8" />
            <circle cx="12" cy="4" r="1.5" fill="var(--accent)" opacity="0.6" />
            <circle cx="20" cy="12" r="1.5" fill="var(--accent)" opacity="0.6" />
            <circle cx="12" cy="20" r="1.5" fill="var(--accent)" opacity="0.6" />
            <circle cx="4" cy="12" r="1.5" fill="var(--accent)" opacity="0.6" />
          </svg>
          <span
            style={{
              fontSize: "0.9rem",
              fontWeight: 700,
              fontFamily: "var(--font-display)",
              color: "var(--text)",
            }}
          >
            AI Team
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <ThemeToggle />
          <a
            href="/app"
            style={{
              padding: "0.4rem 1rem",
              borderRadius: 8,
              background: "#22c55e",
              color: "#fff",
              fontSize: "0.78rem",
              fontWeight: 600,
              textDecoration: "none",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#16a34a"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#22c55e"; }}
          >
            Launch App
          </a>
        </div>
      </nav>

      <HeroSection />
      <AgentVisualization />
      <IntegrationStrip />
      <AiProviders />
      <FeaturesSection />
      <LandingFooter />
    </div>
  );
}
