"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import { glassCard } from "@/lib/styles";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { IAgentRunDocument } from "@/lib/db/models/agent-run";

interface FashionInput {
  style?: string;
  occasion?: string;
  budget?: { min: number; max: number; currency: string };
  gender?: string;
}

interface OrchestratorInput {
  userMessage?: string;
  requestId?: string;
  sessionId?: string;
}

const AGENT_META: Record<string, { label: string; color: string; href: string }> = {
  fashion_stylist: {
    label: "Fashion Stylist",
    color: "#ec4899",
    href: "/dashboard/agents/agent-fashion",
  },
  orchestrator: {
    label: "Workflow",
    color: "#60a5fa",
    href: "/dashboard/workspace/team-default",
  },
};

const FashionIcon = ({ color }: { color: string }) => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const WorkflowIcon = ({ color }: { color: string }) => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5" cy="12" r="2" />
    <circle cx="19" cy="5" r="2" />
    <circle cx="19" cy="19" r="2" />
    <path d="M7 12h5l5-5M7 12h5l5 5" />
  </svg>
);

const FailedIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const AgentRunIcon = ({ color, isFailed, agentType }: { color: string; isFailed: boolean; agentType: string }) => (
  <div
    className="size-9 rounded-lg flex items-center justify-center shrink-0 border"
    style={{
      background: isFailed ? "rgba(239,68,68,0.08)" : `${color}12`,
      borderColor: isFailed ? "rgba(239,68,68,0.2)" : `${color}25`,
    }}
  >
    {isFailed ? <FailedIcon /> : agentType === "orchestrator" ? <WorkflowIcon color={color} /> : <FashionIcon color={color} />}
  </div>
);

interface AgentRunRowProps {
  run: IAgentRunDocument;
}

const buildHref = ({ run, baseMeta }: { run: IAgentRunDocument; baseMeta: { href: string } }): string => {
  if (run.agentType === "orchestrator") {
    const input = run.input as OrchestratorInput;
    if (input.requestId) {
      return `${baseMeta.href}?viewRun=${input.requestId}`;
    }
  }
  return baseMeta.href;
};

const buildLabel = ({ run, metaLabel }: { run: IAgentRunDocument; metaLabel: string }): string => {
  if (run.agentType === "orchestrator") {
    const input = run.input as OrchestratorInput;
    const msg = input.userMessage ?? "";
    return msg.length > 60 ? `${msg.slice(0, 60)}…` : msg || metaLabel;
  }
  const input = run.input as FashionInput;
  return [input.style, input.occasion].filter(Boolean).join(" · ") || metaLabel;
};

export const AgentRunRow = ({ run }: AgentRunRowProps) => {
  const meta = AGENT_META[run.agentType] ?? {
    label: run.agentType.replace(/_/g, " "),
    color: "#6b7280",
    href: "/dashboard/agents",
  };
  const isFailed = run.status === "failed";
  const fashionInput = run.input as FashionInput;

  const href = buildHref({ run, baseMeta: meta });
  const label = buildLabel({ run, metaLabel: meta.label });
  const budget = fashionInput.budget
    ? `${fashionInput.budget.min}–${fashionInput.budget.max} ${fashionInput.budget.currency}`
    : null;

  return (
    <Link href={href} className="no-underline">
      <div
        className={cn(
          glassCard,
          "px-4 py-3 flex items-center gap-3 transition-all duration-200 cursor-pointer group",
        )}
        style={{
          ["--hover-border" as string]: `${meta.color}25`,
        }}
      >
        <AgentRunIcon color={meta.color} isFailed={isFailed} agentType={run.agentType} />

        <div className="flex-1 min-w-0">
          <div
            className="text-[0.85rem] font-medium truncate group-hover:transition-colors"
            style={{ color: "var(--text)" }}
          >
            {label}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[0.72rem] text-[var(--text-muted)]">
            <span
              className="font-semibold text-[0.6rem] uppercase tracking-wide px-1.5 py-0.5 rounded-full"
              style={{ background: `${meta.color}12`, color: meta.color }}
            >
              {meta.label}
            </span>
            {budget && <span>{budget}</span>}
            <span className="opacity-40">·</span>
            <span>{formatRelativeTime(run.createdAt)}</span>
          </div>
        </div>

        <div className="shrink-0">
          {isFailed ? (
            <span className="inline-flex items-center gap-1 text-[0.72rem] font-semibold text-[#ef4444] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.15)] px-2 py-1 rounded-full">
              Failed{run.errorCode ? ` ${run.errorCode}` : ""}
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-[0.72rem] font-semibold px-2 py-1 rounded-full border"
              style={{
                color: meta.color,
                background: `${meta.color}10`,
                borderColor: `${meta.color}20`,
              }}
            >
              Done
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

/* ── Skeleton ─────────────────────────────────────────── */

export const AgentRunsSkeleton = () => (
  <div className="flex flex-col gap-2">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className={cn(glassCard, "px-4 py-3 flex items-center gap-3")}>
        <div className="size-9 rounded-lg animate-pulse bg-[var(--surface-raised)] shrink-0" />
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="h-3 rounded animate-pulse bg-[var(--surface-raised)]" style={{ width: "68%" }} />
          <div className="h-2.5 rounded animate-pulse bg-[var(--surface-raised)]" style={{ width: "42%" }} />
        </div>
        <div className="w-12 h-6 rounded-full animate-pulse bg-[var(--surface-raised)]" />
      </div>
    ))}
  </div>
);
