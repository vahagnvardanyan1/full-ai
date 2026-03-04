"use client";

import { Component, type ReactNode, type ErrorInfo, CSSProperties } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--bg)",
  zIndex: 9999,
};

const card: CSSProperties = {
  maxWidth: 480,
  width: "90%",
  padding: "2rem",
  borderRadius: 16,
  background: "var(--panel-bg)",
  border: "1px solid rgba(239, 68, 68, 0.2)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "1rem",
};

const iconWrap: CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: "50%",
  background: "rgba(239, 68, 68, 0.1)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const title: CSSProperties = {
  fontSize: "1.15rem",
  fontWeight: 700,
  color: "var(--text)",
  fontFamily: "var(--font-display)",
};

const message: CSSProperties = {
  fontSize: "0.82rem",
  color: "var(--text-muted)",
  lineHeight: 1.5,
  maxHeight: 120,
  overflow: "auto",
  width: "100%",
  padding: "0.75rem",
  borderRadius: 8,
  background: "var(--code-bg)",
  fontFamily: "var(--font-mono)",
  textAlign: "left",
  wordBreak: "break-word",
};

const reloadBtn: CSSProperties = {
  padding: "0.55rem 1.5rem",
  borderRadius: 10,
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontSize: "0.82rem",
  fontWeight: 600,
  cursor: "pointer",
  transition: "opacity 0.15s",
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={overlay}>
          <div style={card}>
            <div style={iconWrap}>
              <svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.8" />
                <line x1="12" y1="8" x2="12" y2="13" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="16.5" r="1.2" fill="#ef4444" />
              </svg>
            </div>
            <span style={title}>Something went wrong</span>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
              The application encountered an unexpected error. You can reload to try again.
            </p>
            {this.state.error && (
              <div style={message}>{this.state.error.message}</div>
            )}
            <button
              style={reloadBtn}
              onClick={() => window.location.reload()}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
