import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-secondary": "var(--bg-secondary)",
        "bg-tertiary": "var(--bg-tertiary)",
        border: "var(--border)",
        "border-focus": "var(--border-focus)",
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-glow": "var(--accent-glow)",
        success: "var(--success)",
        warning: "var(--warning)",
        error: "var(--error)",
        "agent-pm": "var(--agent-pm)",
        "agent-dev": "var(--agent-dev)",
        "agent-qa": "var(--agent-qa)",
        "agent-devops": "var(--agent-devops)",
        "agent-orchestrator": "var(--agent-orchestrator)",
        glass: {
          bg: "var(--glass-bg)",
          border: "var(--glass-border)",
        },
        panel: {
          bg: "var(--panel-bg)",
          border: "var(--panel-border)",
        },
        surface: {
          hover: "var(--surface-hover)",
          raised: "var(--surface-raised)",
          border: "var(--surface-border)",
        },
        "code-bg": "var(--code-bg)",
        "topbar-bg": "var(--topbar-bg)",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
      },
      boxShadow: {
        theme: "var(--shadow)",
        node: "var(--node-shadow)",
      },
      backdropBlur: {
        glass: "var(--glass-blur)",
      },
      keyframes: {
        pulse: {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "1" },
        },
        spin: {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 8px 2px var(--glow-color, var(--accent-glow))" },
          "50%": { boxShadow: "0 0 20px 6px var(--glow-color, var(--accent-glow))" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down-in": {
          from: { opacity: "0", transform: "translateY(-100%)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "dot-bounce": {
          "0%, 80%, 100%": { transform: "translateY(0)" },
          "40%": { transform: "translateY(-6px)" },
        },
        "panel-slide-in": {
          from: { transform: "translateX(100%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "panel-slide-down": {
          from: { transform: "translateX(-50%) translateY(-100%)", opacity: "0" },
          to: { transform: "translateX(-50%) translateY(0)", opacity: "1" },
        },
        "hero-fade-in": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "orbit-spin": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "toast-in": {
          from: { opacity: "0", transform: "translateX(-20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "theme-pop": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)" },
        },
        "push-celebrate": {
          "0%": { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(34, 197, 94, 0)" },
          "40%": { transform: "scale(1.08)", boxShadow: "0 0 24px 8px rgba(34, 197, 94, 0.3)" },
          "100%": { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(34, 197, 94, 0)" },
        },
        "github-push-overlay": {
          "0%": { opacity: "0" },
          "8%": { opacity: "1" },
          "75%": { opacity: "1" },
          "100%": { opacity: "0", pointerEvents: "none" },
        },
        "github-push-icon": {
          "0%": { opacity: "0", transform: "scale(0.5) translateY(6px)" },
          "50%": { opacity: "1", transform: "scale(1.15) translateY(0)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "landing-fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "landing-scroll-left": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-33.333%)" },
        },
        "landing-scroll-right": {
          "0%": { transform: "translateX(-33.333%)" },
          "100%": { transform: "translateX(0)" },
        },
        "landing-progress": {
          "0%": { width: "30%" },
          "50%": { width: "75%" },
          "100%": { width: "30%" },
        },
        "avatar-ring-pulse": {
          "0%, 100%": { opacity: "0.5", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
        },
        "avatar-badge-pop": {
          "0%": { transform: "scale(0)", opacity: "0" },
          "60%": { transform: "scale(1.2)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "react-flow-dash": {
          to: { strokeDashoffset: "-16" },
        },
      },
      animation: {
        spin: "spin 0.8s linear infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "slide-in": "slide-in 0.3s ease-out",
        "slide-down-in": "slide-down-in 0.35s ease-out",
        "dot-bounce": "dot-bounce 1.2s ease-in-out infinite",
        "panel-slide-in": "panel-slide-in 0.25s ease-out",
        "panel-slide-down": "panel-slide-down 0.25s ease-out",
        "hero-fade-in": "hero-fade-in 0.5s ease-out both",
        "orbit-spin": "orbit-spin 3s linear infinite",
        "toast-in": "toast-in 0.3s ease-out",
        "theme-pop": "theme-pop 0.3s ease",
        "push-celebrate": "push-celebrate 0.5s ease-out forwards",
        "github-push-overlay": "github-push-overlay 2.8s ease-out forwards",
        "github-push-icon": "github-push-icon 0.6s ease-out forwards",
        "landing-fade-up": "landing-fade-up 0.6s ease-out both",
        "landing-scroll-left": "landing-scroll-left 40s linear infinite",
        "landing-scroll-right": "landing-scroll-right 40s linear infinite",
        "landing-progress": "landing-progress 3s ease-in-out infinite",
        "avatar-ring-pulse": "avatar-ring-pulse 1.5s ease-in-out infinite",
        "avatar-badge-pop": "avatar-badge-pop 0.3s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
