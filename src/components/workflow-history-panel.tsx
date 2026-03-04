"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import type { HistoryEntry } from "@/lib/workflow-replay";

// ── Time helper ───────────────────────────────────────────

const timeAgo = (isoOrTs: string | number): string => {
  const ms = typeof isoOrTs === "number" ? isoOrTs : Date.parse(isoOrTs);
  if (isNaN(ms)) return "";
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// ── Status helpers ────────────────────────────────────────

type RunStatus = "running" | "completed" | "failed" | "interrupted";

const getStatus = (entry: HistoryEntry): RunStatus => {
  if (!entry.done && !entry.error) return "running";
  if (entry.error) return entry.outputs.length > 0 ? "interrupted" : "failed";
  return "completed";
};

const STATUS_CONFIG: Record<RunStatus, { label: string; color: string; dot: string }> = {
  running:     { label: "Running",     color: "#60a5fa", dot: "animate-pulse bg-[#60a5fa]" },
  completed:   { label: "Completed",   color: "#34d399", dot: "bg-[#34d399]" },
  interrupted: { label: "Interrupted", color: "#facc15", dot: "bg-[#facc15]" },
  failed:      { label: "Failed",      color: "#ef4444", dot: "bg-[#ef4444]" },
};

const AGENT_COLORS: Record<string, string> = {
  product_manager:    "#a78bfa",
  frontend_developer: "#34d399",
  qa:                 "#facc15",
  devops:             "#f97316",
};

const agentInitial = (role: string) =>
  role.split("_").map((w) => w[0].toUpperCase()).join("");

// ── Sub-components ────────────────────────────────────────

const AgentPips = ({ entry }: { entry: HistoryEntry }) => {
  if (!entry.phases) return null;
  const allAgents = entry.phases.flat();
  const completedSet = new Set(entry.outputs.map((o) => o.response.agent));
  const workingSet = new Set(entry.workingAgents);

  return (
    <div className="flex items-center gap-[3px]">
      {allAgents.map((role) => {
        const color = AGENT_COLORS[role] ?? "#888";
        const isDone = completedSet.has(role as never);
        const isWorking = workingSet.has(role);
        return (
          <div
            key={role}
            title={role.replace(/_/g, " ")}
            className={cn(
              "size-[18px] rounded-full flex items-center justify-center text-[0.48rem] font-bold transition-all",
              isDone    ? "opacity-100" : isWorking ? "opacity-80 animate-pulse" : "opacity-25",
            )}
            style={{
              background: isDone || isWorking ? `${color}22` : "rgba(255,255,255,0.04)",
              border: `1px solid ${isDone || isWorking ? color : "rgba(255,255,255,0.08)"}`,
              color: isDone || isWorking ? color : "rgba(255,255,255,0.3)",
            }}
          >
            {agentInitial(role)}
          </div>
        );
      })}
    </div>
  );
};

const RunCard = ({
  entry,
  isSelected,
  onSelect,
}: {
  entry: HistoryEntry;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const status = getStatus(entry);
  const cfg = STATUS_CONFIG[status];
  const taskCount = entry.outputs.reduce((n, o) => n + o.tasks.length, 0);

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-[10px] border transition-all duration-150 flex flex-col gap-1.5 cursor-pointer",
        isSelected
          ? "bg-[rgba(255,255,255,0.07)] border-[rgba(255,255,255,0.15)]"
          : "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)]",
      )}
    >
      {/* Row 1: status dot + message + time */}
      <div className="flex items-start gap-2">
        <div className="mt-[4px] shrink-0">
          <span className={cn("block size-[7px] rounded-full", cfg.dot)} />
        </div>
        <span className="flex-1 text-[0.72rem] text-[var(--text)] leading-[1.35] line-clamp-2 min-w-0">
          {entry.userMessage}
        </span>
      </div>

      {/* Row 2: agent pips + task count + time */}
      <div className="flex items-center justify-between gap-2 pl-[15px]">
        <AgentPips entry={entry} />
        <div className="flex items-center gap-2 shrink-0">
          {taskCount > 0 && (
            <span className="text-[0.6rem] text-[var(--text-muted)]">
              {taskCount} task{taskCount !== 1 ? "s" : ""}
            </span>
          )}
          <span
            className="text-[0.6rem] font-medium px-[0.4rem] py-[0.1rem] rounded-full"
            style={{
              color: cfg.color,
              background: `${cfg.color}18`,
            }}
          >
            {cfg.label}
          </span>
        </div>
      </div>
    </button>
  );
};

// ── Panel ─────────────────────────────────────────────────

interface WorkflowHistoryPanelProps {
  history: HistoryEntry[];
  viewingId: string | null;
  onSelectRun: (id: string) => void;
  onClose: () => void;
}

export const WorkflowHistoryPanel = ({
  history,
  viewingId,
  onSelectRun,
  onClose,
}: WorkflowHistoryPanelProps) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Newest first for display
  const sorted = [...history].reverse();

  return (
    <div
      ref={panelRef}
      className="absolute top-14 right-2 sm:right-4 z-[110] w-[280px] sm:w-[320px] flex flex-col rounded-[14px] border border-[rgba(255,255,255,0.1)] shadow-[0_8px_40px_rgba(0,0,0,0.4),0_0_0_0.5px_rgba(255,255,255,0.05)_inset] overflow-hidden"
      style={{
        background: "rgba(10,10,10,0.88)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2 border-b border-[rgba(255,255,255,0.07)]">
        <div className="flex items-center gap-2">
          <svg width={13} height={13} viewBox="0 0 16 16" fill="none" className="text-[var(--text-muted)]">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
            <polyline points="8,4.5 8,8 10.5,9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[0.75rem] font-semibold text-[var(--text)]">Run History</span>
          <span className="text-[0.65rem] text-[var(--text-muted)] bg-[rgba(255,255,255,0.06)] px-[0.4rem] py-[0.1rem] rounded-full">
            {history.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
        >
          <svg width={13} height={13} viewBox="0 0 16 16" fill="none">
            <line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Run list */}
      <div className="overflow-y-auto max-h-[420px] p-2 flex flex-col gap-[5px]">
        {sorted.length === 0 ? (
          <div className="px-3 py-6 text-center text-[0.72rem] text-[var(--text-muted)]">
            No runs yet
          </div>
        ) : (
          sorted.map((entry) => (
            <RunCard
              key={entry.id}
              entry={entry}
              isSelected={viewingId === entry.id}
              onSelect={() => {
                onSelectRun(entry.id);
                onClose();
              }}
            />
          ))
        )}
      </div>

      {/* Footer hint */}
      {sorted.length > 0 && (
        <div className="px-3.5 py-2 border-t border-[rgba(255,255,255,0.05)] text-[0.62rem] text-[var(--text-muted)]">
          Click a run to view its pipeline
        </div>
      )}
    </div>
  );
};
