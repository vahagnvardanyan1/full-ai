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
      className="landing-nav landing-bottom-cta fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 pl-5 pr-[0.6rem] py-2 bg-[rgba(10,10,10,0.8)] backdrop-blur-[20px] [-webkit-backdrop-filter:blur(20px)_saturate(1.4)] border border-[rgba(255,255,255,0.1)] rounded-full shadow-[0_4px_30px_rgba(0,0,0,0.3),0_0_0_0.5px_rgba(255,255,255,0.05)_inset] whitespace-nowrap"
      style={{
        bottom: visible ? 16 : -80,
        transition: "bottom 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        backdropFilter: "blur(20px) saturate(1.4)",
      }}
    >
      <span className="landing-bottom-cta-text text-[0.8rem] font-medium text-[var(--text-muted)]">
        Ready to ship faster?
      </span>
      <a
        href="/app"
        className="inline-flex items-center gap-[0.4rem] py-[0.45rem] px-[1.15rem] rounded-full bg-gradient-to-br from-[#22c55e] to-[#16a34a] text-white text-[0.78rem] font-semibold no-underline transition-all duration-200 shadow-[0_2px_12px_rgba(34,197,94,0.3)] hover:from-[#16a34a] hover:to-[#15803d] hover:shadow-[0_2px_20px_rgba(34,197,94,0.5)]"
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
    <div className="landing-dot-grid min-h-screen">
      {/* Fixed nav bar */}
      <nav
        className="landing-nav fixed top-3.5 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between py-[0.55rem] pl-5 pr-[0.6rem] border border-[rgba(255,255,255,0.1)] rounded-full shadow-[0_4px_30px_rgba(0,0,0,0.25),0_0_0_0.5px_rgba(255,255,255,0.05)_inset]"
        style={{
          width: "min(720px, calc(100% - 32px))",
          background: "rgba(10, 10, 10, 0.75)",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        }}
      >
        <div className="flex items-center gap-[0.6rem]">
          <div className="size-7 rounded-full bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.25)] flex items-center justify-center">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="#22c55e" strokeWidth="2" />
              <circle cx="12" cy="4" r="1.5" fill="#22c55e" opacity="0.7" />
              <circle cx="20" cy="12" r="1.5" fill="#22c55e" opacity="0.7" />
              <circle cx="12" cy="20" r="1.5" fill="#22c55e" opacity="0.7" />
              <circle cx="4" cy="12" r="1.5" fill="#22c55e" opacity="0.7" />
            </svg>
          </div>
          <span className="text-[0.88rem] font-bold font-[var(--font-display)] text-[var(--text)] tracking-[-0.01em]">
            AI Team
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            href="/app"
            className="py-[0.45rem] px-[1.15rem] rounded-full bg-gradient-to-br from-[#22c55e] to-[#16a34a] text-white text-[0.78rem] font-semibold no-underline transition-all duration-200 shadow-[0_2px_12px_rgba(34,197,94,0.3)] hover:from-[#16a34a] hover:to-[#15803d] hover:shadow-[0_2px_20px_rgba(34,197,94,0.5)]"
          >
            Launch App
          </a>
        </div>
      </nav>

      <HeroSection />
      <AgentVisualization />
      <IntegrationStrip />
      <AiProviders />
      <div className="h-12" />
      <FeaturesSection />
      <div className="h-12" />
      <LandingFooter />
      <BottomCTA visible={showBottom} />
    </div>
  );
}
