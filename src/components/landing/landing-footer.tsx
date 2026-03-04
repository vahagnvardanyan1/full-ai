"use client";

import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="landing-footer flex justify-between items-center flex-wrap gap-4 max-w-[960px] mx-auto px-6 pt-16 pb-40 border-t border-[var(--glass-border)]">
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
        <span className="text-[0.88rem] font-bold font-[var(--font-display)] text-[var(--text)] tracking-[-0.01em]">AI Team</span>
        <span className="text-[0.68rem] text-[var(--text-muted)] opacity-50">
          &copy; {new Date().getFullYear()}
        </span>
      </div>
      <div className="landing-footer-links flex gap-6 items-center">
        <Link href="/dashboard" className="text-[0.75rem] text-[var(--text-muted)] no-underline transition-colors duration-150 hover:text-[var(--text)]">
          Dashboard
        </Link>
        <Link href="/dashboard/agents" className="text-[0.75rem] text-[var(--text-muted)] no-underline transition-colors duration-150 hover:text-[var(--text)]">
          Agents
        </Link>
        <Link href="/dashboard/teams" className="text-[0.75rem] text-[var(--text-muted)] no-underline transition-colors duration-150 hover:text-[var(--text)]">
          Teams
        </Link>
        <Link href="/dashboard/workspace" className="text-[0.75rem] text-[var(--text-muted)] no-underline transition-colors duration-150 hover:text-[var(--text)]">
          Workspace
        </Link>
      </div>
    </footer>
  );
}
