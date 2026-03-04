"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

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
        <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg)] z-[9999]">
          <div className="max-w-[480px] w-[90%] p-8 rounded-2xl bg-[var(--panel-bg)] border border-red-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.2)] text-center flex flex-col items-center gap-4">
            <div className="size-14 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.8" />
                <line x1="12" y1="8" x2="12" y2="13" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="16.5" r="1.2" fill="#ef4444" />
              </svg>
            </div>
            <span className="text-[1.15rem] font-bold text-[var(--text)] font-[var(--font-display)]">Something went wrong</span>
            <p className="text-[0.82rem] text-[var(--text-muted)] leading-relaxed">
              The application encountered an unexpected error. You can reload to try again.
            </p>
            {this.state.error && (
              <div className="text-[0.82rem] text-[var(--text-muted)] leading-relaxed max-h-[120px] overflow-auto w-full px-3 py-3 rounded-lg bg-[var(--code-bg)] font-mono text-left break-words">
                {this.state.error.message}
              </div>
            )}
            <button
              className="px-6 py-2 rounded-[10px] border-none bg-[var(--accent)] text-white text-[0.82rem] font-semibold cursor-pointer transition-opacity hover:opacity-85"
              onClick={() => window.location.reload()}
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
