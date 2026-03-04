"use client";

import type { CSSProperties } from "react";

import { PixelWorkers } from "./pixel-workers";

const section: CSSProperties = {
  position: "relative",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "6rem 1.5rem 2rem",
  overflow: "hidden",
};

const badge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
  padding: "0.35rem 0.85rem",
  borderRadius: 9999,
  border: "1px solid var(--glass-border)",
  background: "var(--surface-raised)",
  fontSize: "0.72rem",
  fontWeight: 500,
  color: "var(--text-muted)",
  marginBottom: "1.5rem",
  animation: "landing-fade-up 0.6s ease-out both",
};

const headline: CSSProperties = {
  fontSize: "clamp(2.8rem, 7vw, 5rem)",
  fontWeight: 700,
  fontFamily: "var(--font-display)",
  color: "var(--text)",
  letterSpacing: "-0.035em",
  lineHeight: 1.05,
  textAlign: "center",
  maxWidth: 800,
  animation: "landing-fade-up 0.7s ease-out 0.08s both",
};

const subtitle: CSSProperties = {
  fontSize: "clamp(1rem, 2vw, 1.2rem)",
  color: "var(--text-muted)",
  maxWidth: 520,
  textAlign: "center",
  lineHeight: 1.65,
  marginTop: "1.5rem",
  animation: "landing-fade-up 0.7s ease-out 0.16s both",
};

const ctaRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  marginTop: "2.5rem",
  animation: "landing-fade-up 0.7s ease-out 0.24s both",
};

const primaryBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.75rem 1.75rem",
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(135deg, #22c55e, #16a34a)",
  color: "#fff",
  fontSize: "0.9rem",
  fontWeight: 600,
  fontFamily: "var(--font-body)",
  cursor: "pointer",
  transition: "all 0.2s ease",
  textDecoration: "none",
  boxShadow: "0 2px 16px rgba(34,197,94,0.3)",
};

const secondaryBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
  padding: "0.75rem 1.5rem",
  borderRadius: 10,
  border: "1px solid var(--glass-border)",
  background: "transparent",
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  fontWeight: 500,
  fontFamily: "var(--font-body)",
  cursor: "pointer",
  transition: "all 0.2s ease",
  textDecoration: "none",
};

const scrollCue: CSSProperties = {
  position: "absolute",
  bottom: "2rem",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.4rem",
  color: "var(--text-muted)",
  fontSize: "0.68rem",
  fontWeight: 500,
  opacity: 0.5,
  animation: "landing-fade-up 0.7s ease-out 0.5s both",
};

export function HeroSection() {
  return (
    <section className="landing-hero" style={section}>
      {/* Ambient glow */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "clamp(400px, 60vw, 800px)",
          height: "clamp(400px, 60vw, 800px)",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* All robots are z-index 1 — always behind text and buttons */}
      <PixelWorkers />

      {/* All hero text + buttons live at z-index 5 — always on top of robots */}
      <div
        style={{
          position: "relative",
          zIndex: 5,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
        }}
      >
        <div style={badge}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
          Multi-Agent Orchestration Platform
        </div>

        <h1 style={headline}>
          Spin up agents.<br />
          Watch them work.<br />
          Ship faster.
        </h1>

        <p style={subtitle}>
          Your AI-powered dev team that plans, builds, tests, and deploys — all orchestrated from a single command.
        </p>

        <div className="landing-cta-row" style={ctaRow}>
          <a
            href="/app"
            style={primaryBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, #16a34a, #15803d)";
              e.currentTarget.style.boxShadow = "0 0 32px rgba(34,197,94,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, #22c55e, #16a34a)";
              e.currentTarget.style.boxShadow = "0 2px 16px rgba(34,197,94,0.3)";
            }}
          >
            Launch Orchestrator
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </a>
          <a
            href="#how-it-works"
            style={secondaryBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--text-muted)";
              e.currentTarget.style.color = "var(--text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--glass-border)";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            How it works
          </a>
        </div>
      </div>

      <div className="landing-scroll-cue" style={{ ...scrollCue, zIndex: 5 }}>
        <span>Scroll to explore</span>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <polyline points="19 12 12 19 5 12" />
        </svg>
      </div>
    </section>
  );
}
