"use client";

import { CSSProperties } from "react";

const footer: CSSProperties = {
  padding: "3rem 1.5rem 2rem",
  borderTop: "1px solid var(--glass-border)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  maxWidth: 960,
  margin: "0 auto",
  flexWrap: "wrap",
  gap: "1rem",
};

const logoRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

const logoText: CSSProperties = {
  fontSize: "0.9rem",
  fontWeight: 700,
  fontFamily: "var(--font-display)",
  color: "var(--text)",
};

const links: CSSProperties = {
  display: "flex",
  gap: "1.5rem",
  alignItems: "center",
};

const linkStyle: CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--text-muted)",
  textDecoration: "none",
  transition: "color 0.15s",
};

export function LandingFooter() {
  return (
    <footer style={footer}>
      <div style={logoRow}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke="var(--accent)" strokeWidth="1.8" />
          <circle cx="12" cy="4" r="1.5" fill="var(--accent)" opacity="0.6" />
          <circle cx="20" cy="12" r="1.5" fill="var(--accent)" opacity="0.6" />
          <circle cx="12" cy="20" r="1.5" fill="var(--accent)" opacity="0.6" />
          <circle cx="4" cy="12" r="1.5" fill="var(--accent)" opacity="0.6" />
        </svg>
        <span style={logoText}>AI Team</span>
        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", opacity: 0.5 }}>
          &copy; {new Date().getFullYear()}
        </span>
      </div>
      <div style={links}>
        <a
          href="/app"
          style={linkStyle}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          App
        </a>
        <a
          href="#how-it-works"
          style={linkStyle}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          Features
        </a>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
