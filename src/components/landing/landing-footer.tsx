"use client";

export function LandingFooter() {
  return (
    <footer className="landing-footer flex justify-between items-center flex-wrap gap-4 max-w-[960px] mx-auto px-6 pt-16 pb-40 border-t border-[var(--glass-border)]">
      <div className="flex items-center gap-2">
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke="var(--accent)" strokeWidth="1.8" />
          <circle cx="12" cy="4" r="1.5" fill="var(--accent)" opacity="0.6" />
          <circle cx="20" cy="12" r="1.5" fill="var(--accent)" opacity="0.6" />
          <circle cx="12" cy="20" r="1.5" fill="var(--accent)" opacity="0.6" />
          <circle cx="4" cy="12" r="1.5" fill="var(--accent)" opacity="0.6" />
        </svg>
        <span className="text-[0.9rem] font-bold font-[var(--font-display)] text-[var(--text)]">AI Team</span>
        <span className="text-[0.68rem] text-[var(--text-muted)] opacity-50">
          &copy; {new Date().getFullYear()}
        </span>
      </div>
      <div className="landing-footer-links flex gap-6 items-center">
        <a href="/app" className="text-[0.75rem] text-[var(--text-muted)] no-underline transition-colors duration-150 hover:text-[var(--text)]">
          App
        </a>
        <a href="#how-it-works" className="text-[0.75rem] text-[var(--text-muted)] no-underline transition-colors duration-150 hover:text-[var(--text)]">
          Features
        </a>
        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-[0.75rem] text-[var(--text-muted)] no-underline transition-colors duration-150 hover:text-[var(--text)]">
          GitHub
        </a>
      </div>
    </footer>
  );
}
