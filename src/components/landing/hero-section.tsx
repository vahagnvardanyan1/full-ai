"use client";

import { PixelWorkers } from "./pixel-workers";

export function HeroSection() {
  return (
    <section className="landing-hero relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-8 overflow-hidden">
      {/* Ambient glow */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none z-0"
        style={{
          top: "-20%",
          width: "clamp(400px, 60vw, 800px)",
          height: "clamp(400px, 60vw, 800px)",
          background: "radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)",
        }}
      />

      {/* Robots at z-[1] — always behind text and buttons */}
      <PixelWorkers />

      {/* Hero text + buttons at z-[5] — always in front of robots */}
      <div className="relative z-[5] flex flex-col items-center w-full">
        <div
          className="inline-flex items-center gap-[0.4rem] px-3.5 py-[0.35rem] rounded-full border border-[var(--glass-border)] bg-[var(--surface-raised)] text-[0.72rem] font-medium text-[var(--text-muted)] mb-6"
          style={{ animation: "landing-fade-up 0.6s ease-out both" }}
        >
          <span className="inline-block size-1.5 rounded-full bg-[#22c55e]" />
          Multi-Agent Orchestration Platform
        </div>

        <h1
          className="font-bold font-[var(--font-display)] text-[var(--text)] tracking-[-0.035em] leading-[1.05] text-center max-w-[800px]"
          style={{ fontSize: "clamp(2.8rem, 7vw, 5rem)", animation: "landing-fade-up 0.7s ease-out 0.08s both" }}
        >
          Spin up agents.<br />
          Watch them work.<br />
          Ship faster.
        </h1>

        <p
          className="text-[var(--text-muted)] max-w-[520px] text-center leading-[1.65] mt-6"
          style={{ fontSize: "clamp(1rem, 2vw, 1.2rem)", animation: "landing-fade-up 0.7s ease-out 0.16s both" }}
        >
          Your AI-powered dev team that plans, builds, tests, and deploys — all orchestrated from a single command.
        </p>

        <div
          className="landing-cta-row flex items-center gap-3 mt-10"
          style={{ animation: "landing-fade-up 0.7s ease-out 0.24s both" }}
        >
          <a
            href="/app"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-[10px] border-none bg-gradient-to-br from-[#22c55e] to-[#16a34a] text-white text-[0.9rem] font-semibold font-[var(--font-body)] cursor-pointer transition-all duration-200 no-underline shadow-[0_2px_16px_rgba(34,197,94,0.3)] hover:from-[#16a34a] hover:to-[#15803d] hover:shadow-[0_0_32px_rgba(34,197,94,0.4)]"
          >
            Launch Orchestrator
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </a>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-[0.4rem] px-6 py-3 rounded-[10px] border border-[var(--glass-border)] bg-transparent text-[var(--text-muted)] text-[0.9rem] font-medium font-[var(--font-body)] cursor-pointer transition-all duration-200 no-underline hover:border-[var(--text-muted)] hover:text-[var(--text)]"
          >
            How it works
          </a>
        </div>
      </div>

      <div
        className="landing-scroll-cue absolute bottom-8 flex flex-col items-center gap-[0.4rem] text-[var(--text-muted)] text-[0.68rem] font-medium opacity-50 z-[5]"
        style={{ animation: "landing-fade-up 0.7s ease-out 0.5s both" }}
      >
        <span>Scroll to explore</span>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <polyline points="19 12 12 19 5 12" />
        </svg>
      </div>
    </section>
  );
}
