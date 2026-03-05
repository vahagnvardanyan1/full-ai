"use client";

import type { IAgentRunDocument } from "@/lib/db/models/agent-run";
import type { FashionContext } from "@/lib/agents/types";

// ── Helpers ───────────────────────────────────────────────

const timeAgo = (date: Date | string): string => {
  const ms = typeof date === "string" ? Date.parse(date) : date.getTime();
  if (isNaN(ms)) return "";
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const getContext = (run: IAgentRunDocument): Partial<FashionContext> =>
  (run.input as Partial<FashionContext>) ?? {};

// ── Sub-components ────────────────────────────────────────

interface RunCardProps {
  run: IAgentRunDocument;
  onRerun: () => void;
}

const RunCard = ({ run, onRerun }: RunCardProps) => {
  const ctx = getContext(run);
  const isFailed = run.status === "failed";

  return (
    <div
      className="flex gap-2.5 p-2.5 rounded-xl border transition-colors"
      style={{
        background: "var(--surface-hover, rgba(255,255,255,0.03))",
        borderColor: isFailed
          ? "rgba(239,68,68,0.15)"
          : "rgba(255,255,255,0.07)",
      }}
    >
      {/* Status dot */}
      <div className="flex items-start pt-1 shrink-0">
        <div
          className="w-2 h-2 rounded-full mt-0.5"
          style={{
            background: isFailed ? "#ef4444" : "#22c55e",
            boxShadow: isFailed
              ? "0 0 6px rgba(239,68,68,0.4)"
              : "0 0 6px rgba(34,197,94,0.4)",
          }}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {ctx.style && (
            <span
              className="text-[0.6rem] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(236,72,153,0.12)", color: "#ec4899" }}
            >
              {ctx.style}
            </span>
          )}
          {ctx.occasion && (
            <span className="text-[0.65rem] text-[var(--text-muted)] truncate">
              {ctx.occasion}
            </span>
          )}
        </div>

        {ctx.budget && (
          <div className="text-[0.68rem] text-[var(--text-muted)]">
            {ctx.budget.min}–{ctx.budget.max}{" "}
            <span className="uppercase">{ctx.budget.currency}</span>
          </div>
        )}

        {isFailed && run.errorCode && (
          <div className="text-[0.62rem] text-[#ef4444]">
            Error {run.errorCode}
          </div>
        )}

        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[0.6rem] text-[var(--text-muted)] opacity-70">
            {timeAgo(run.createdAt)}
          </span>
          {!isFailed && (
            <button
              onClick={onRerun}
              className="text-[0.65rem] font-semibold px-2 py-0.5 rounded-lg cursor-pointer transition-all"
              style={{
                background: "rgba(236,72,153,0.08)",
                border: "1px solid rgba(236,72,153,0.2)",
                color: "#ec4899",
              }}
            >
              Re-run
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────

interface FashionHistoryPanelProps {
  runs: IAgentRunDocument[];
  isLoading: boolean;
  onSelectRun: (run: IAgentRunDocument) => void;
  onClose: () => void;
}

export const FashionHistoryPanel = ({
  runs,
  isLoading,
  onSelectRun,
  onClose,
}: FashionHistoryPanelProps) => (
  <div
    className="absolute inset-0 z-30 flex flex-col rounded-[var(--radius-lg)] overflow-hidden"
    style={{
      background: "var(--panel-bg, rgba(10,10,14,0.97))",
      border: "1px solid var(--glass-border, rgba(255,255,255,0.08))",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
    }}
  >
    {/* Header */}
    <div
      className="flex items-center justify-between px-4 py-3 shrink-0"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-center gap-2">
        <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.2" stroke="#ec4899" strokeWidth="1.3" />
          <polyline points="8,4.5 8,8 10.2,9.4" stroke="#ec4899" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[0.78rem] font-semibold text-[var(--text)]">Style History</span>
        {runs.length > 0 && (
          <span
            className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: "rgba(236,72,153,0.12)", color: "#ec4899" }}
          >
            {runs.length}
          </span>
        )}
      </div>
      <button
        onClick={onClose}
        className="flex items-center justify-center w-6 h-6 rounded-lg cursor-pointer transition-colors text-[var(--text-muted)] hover:text-[var(--text)]"
        style={{ background: "rgba(255,255,255,0.04)" }}
        aria-label="Close history"
      >
        <svg width={10} height={10} viewBox="0 0 12 12" fill="none">
          <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>

    {/* Body */}
    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
      {isLoading && (
        <div className="flex items-center justify-center py-8 gap-2 text-[var(--text-muted)]">
          <div className="w-4 h-4 border-2 border-[#ec4899] border-t-transparent rounded-full animate-spin" />
          <span className="text-[0.78rem]">Loading history…</span>
        </div>
      )}

      {!isLoading && runs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <span className="text-2xl opacity-30">✦</span>
          <p className="text-[0.78rem] text-[var(--text-muted)]">No past runs yet.</p>
          <p className="text-[0.68rem] text-[var(--text-muted)] opacity-60">
            Complete a styling session to see it here.
          </p>
        </div>
      )}

      {!isLoading &&
        runs.map((run) => (
          <RunCard
            key={String(run.runId)}
            run={run}
            onRerun={() => onSelectRun(run)}
          />
        ))}
    </div>
  </div>
);
