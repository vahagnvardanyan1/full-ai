"use client";

import { useState, useEffect, CSSProperties } from "react";

const btn: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid var(--surface-border)",
  background: "var(--surface-hover)",
  color: "var(--text-muted)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 0.15s, border-color 0.15s, color 0.15s",
  flexShrink: 0,
};

function SunIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <circle cx="8" cy="8" r="3" />
      <line x1="8" y1="1" x2="8" y2="3" />
      <line x1="8" y1="13" x2="8" y2="15" />
      <line x1="1" y1="8" x2="3" y2="8" />
      <line x1="13" y1="8" x2="15" y2="8" />
      <line x1="3.05" y1="3.05" x2="4.46" y2="4.46" />
      <line x1="11.54" y1="11.54" x2="12.95" y2="12.95" />
      <line x1="3.05" y1="12.95" x2="4.46" y2="11.54" />
      <line x1="11.54" y1="4.46" x2="12.95" y2="3.05" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 8.5a5.5 5.5 0 1 1-6-6 4.5 4.5 0 0 0 6 6z" />
    </svg>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = document.documentElement.getAttribute("data-theme") as "dark" | "light" | null;
    setTheme(stored ?? "dark");
    setMounted(true);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("ai-team-theme", next);
    setTheme(next);
  }

  if (!mounted) return <div style={{ ...btn, opacity: 0 }} />;

  return (
    <button
      style={btn}
      onClick={toggle}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
