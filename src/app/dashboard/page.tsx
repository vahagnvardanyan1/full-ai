"use client";

import Link from "next/link";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { glassCard, textGradientTitle } from "@/lib/styles";
import { MOCK_AGENTS, MOCK_WORKSPACE } from "@/lib/dashboard/mock-data";
import { useWorkspaceSummary } from "@/lib/dashboard/use-workspace-summary";
import { getAgentDisplay, getUptimeColor } from "@/lib/dashboard/agent-display";
import { formatRelativeTime, formatDuration } from "@/lib/format-relative-time";
import type { PipelineRunItem } from "@/lib/dashboard/use-workspace-summary";

/* ── Status dot ─────────────────────────────────────── */

const StatusDot = ({ status, size = 7 }: { status: string; size?: number }) => {
  const color =
    status === "active" || status === "available"
      ? "#22c55e"
      : status === "busy" || status === "running"
        ? "#f59e0b"
        : "#6b7280";
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        background: color,
        boxShadow: status === "active" || status === "running" ? `0 0 8px ${color}60` : "none",
      }}
    />
  );
};

/* ── Agent mini card ────────────────────────────────── */

const AgentMiniCard = ({ agent }: { agent: typeof MOCK_AGENTS[0] }) => (
  <Link href={`/dashboard/agents/${agent.id}`} className="no-underline">
    <div className={cn(glassCard, "p-4 flex items-center gap-3.5 transition-all duration-200 hover:border-[rgba(34,197,94,0.2)] cursor-pointer group")}>
      {agent.avatar ? (
        <Image src={agent.avatar} alt={agent.name} width={40} height={40} className="size-10 rounded-full shrink-0 bg-[var(--surface-raised)] border border-[var(--surface-border)]" />
      ) : (
        <div className="size-10 rounded-full shrink-0 bg-[var(--surface-raised)] border border-[var(--surface-border)] flex items-center justify-center text-[0.85rem] font-bold text-[var(--text-muted)]">
          {agent.name[0]}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[0.9rem] font-semibold text-[var(--text)] group-hover:text-[#22c55e] transition-colors truncate">
          {agent.name}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <StatusDot status={agent.status} />
          <span className="text-[0.78rem] text-[var(--text-muted)] capitalize">{agent.status}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[0.82rem] font-semibold text-[var(--text)]">{agent.tasksCompleted}</div>
        <div className="text-[0.72rem] text-[var(--text-muted)]">tasks</div>
      </div>
    </div>
  </Link>
);

/* ── Pipeline run row ───────────────────────────────── */

const RunRow = ({ run }: { run: PipelineRunItem }) => {
  const isRunning = run.status === "running";
  const isFailed = run.status === "failed";

  return (
    <Link href="/dashboard/workspace" className="no-underline">
      <div className={cn(glassCard, "px-5 py-3.5 flex items-center gap-3.5 transition-all duration-200 hover:border-[rgba(34,197,94,0.15)] cursor-pointer group")}>
        <div className={cn(
          "size-10 rounded-lg flex items-center justify-center shrink-0 border",
          isRunning
            ? "bg-[rgba(249,115,22,0.1)] border-[rgba(249,115,22,0.2)]"
            : isFailed
              ? "bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.2)]"
              : "bg-[rgba(34,197,94,0.08)] border-[rgba(34,197,94,0.15)]",
        )}>
          {isRunning ? (
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin" style={{ animationDuration: "3s" }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : isFailed ? (
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[0.9rem] font-medium text-[var(--text)] group-hover:text-[#22c55e] transition-colors truncate">
            {run.prompt}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[0.78rem] text-[var(--text-muted)]">
            {run.agentCount > 0 && (
              <>
                <span>{run.agentCount} {run.agentCount === 1 ? "agent" : "agents"}</span>
                <span className="opacity-30">|</span>
              </>
            )}
            <span>{run.taskCount} {run.taskCount === 1 ? "task" : "tasks"}</span>
            <span className="opacity-30">|</span>
            <span>{formatDuration(run.createdAt, run.updatedAt)}</span>
            <span className="opacity-30">|</span>
            <span>{formatRelativeTime(run.createdAt)}</span>
          </div>
        </div>
        <div className="shrink-0">
          {isRunning ? (
            <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-[#f97316] bg-[rgba(249,115,22,0.1)] border border-[rgba(249,115,22,0.2)] px-2.5 py-1 rounded-full">
              <StatusDot status="running" size={6} />
              Running
            </span>
          ) : isFailed ? (
            <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-[#ef4444] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.15)] px-2.5 py-1 rounded-full">
              Failed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-[#22c55e] bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.15)] px-2.5 py-1 rounded-full">
              Done
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

/* ── Skeleton loaders ───────────────────────────────── */

const SkeletonLine = ({ width = "100%", height = 12 }: { width?: string | number; height?: number }) => (
  <div className="rounded animate-pulse bg-[var(--surface-raised)]" style={{ width, height }} />
);

const RunsSkeleton = () => (
  <div className="flex flex-col gap-2.5">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className={cn(glassCard, "px-5 py-3.5 flex items-center gap-3.5")}>
        <div className="size-10 rounded-lg animate-pulse bg-[var(--surface-raised)] shrink-0" />
        <div className="flex-1 flex flex-col gap-1.5">
          <SkeletonLine width="70%" height={13} />
          <SkeletonLine width="45%" height={10} />
        </div>
        <div className="w-14 h-6 rounded-full animate-pulse bg-[var(--surface-raised)]" />
      </div>
    ))}
  </div>
);

const ActivitySkeleton = () => (
  <div className={cn(glassCard, "divide-y divide-[var(--surface-border)] overflow-hidden")}>
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="px-5 py-3.5 flex items-center gap-3">
        <div className="size-2.5 rounded-full animate-pulse bg-[var(--surface-raised)] shrink-0" />
        <div className="flex-1 flex flex-col gap-1.5">
          <SkeletonLine width="80%" height={12} />
        </div>
        <div className="w-10 h-3 rounded animate-pulse bg-[var(--surface-raised)]" />
      </div>
    ))}
  </div>
);

/* ── Page ────────────────────────────────────────────── */

export default function DashboardOverview() {
  const workspace = MOCK_WORKSPACE[0];
  const activeMembers = workspace.members.filter((m) => m.status === "active");

  const { data, loading } = useWorkspaceSummary();

  const totalTasks = data?.stats.totalTasks ?? 0;
  const totalRuns = data?.stats.totalRuns ?? 0;
  const uptimePercent = data?.stats.uptimePercent ?? null;
  const uptimeColor = getUptimeColor(loading ? null : uptimePercent);

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1200px] mx-auto space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className={cn("text-[1.75rem] sm:text-[2rem] font-bold font-[var(--font-display)] tracking-tight", textGradientTitle)}>
            Command Center
          </h1>
          <p className="text-[0.95rem] text-[var(--text-muted)] mt-1">
            {activeMembers.length} agents working
            {!loading && totalTasks > 0 && (
              <> &middot; {totalTasks.toLocaleString()} tasks completed</>
            )}
          </p>
        </div>
        <Link
          href="/dashboard/workspace"
          className="inline-flex items-center gap-2 py-2.5 px-5 rounded-lg bg-gradient-to-br from-[#22c55e] to-[#16a34a] text-white text-[0.88rem] font-semibold no-underline transition-all duration-200 shadow-[0_2px_12px_rgba(34,197,94,0.25)] hover:shadow-[0_2px_20px_rgba(34,197,94,0.4)] shrink-0 w-fit"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Open Workspace
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            label: "Active Agents",
            value: activeMembers.length,
            suffix: `/${MOCK_AGENTS.length}`,
            color: "#22c55e",
            icon: (
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 8V4H8" /><rect x="4" y="8" width="16" height="12" rx="2" />
              </svg>
            ),
          },
          {
            label: "Tasks Done",
            value: loading ? "—" : totalTasks.toLocaleString(),
            suffix: "",
            color: "#3b82f6",
            icon: (
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <polyline points="9 11 12 14 22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            ),
          },
          {
            label: "Pipeline Runs",
            value: loading ? "—" : totalRuns.toLocaleString(),
            suffix: "",
            color: "#a78bfa",
            icon: (
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            ),
          },
          {
            label: "Uptime",
            value: loading ? "—" : `${uptimePercent ?? 0}%`,
            suffix: "",
            color: uptimeColor,
            icon: (
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            ),
          },
        ].map((stat) => (
          <div key={stat.label} className={cn(glassCard, "p-5 sm:p-6 flex items-start gap-4")}>
            <div
              className="size-11 sm:size-12 rounded-xl flex items-center justify-center shrink-0 border"
              style={{ background: `${stat.color}12`, borderColor: `${stat.color}25`, color: stat.color }}
            >
              {stat.icon}
            </div>
            <div className="min-w-0">
              <div className="text-[0.78rem] sm:text-[0.82rem] font-medium text-[var(--text-muted)] uppercase tracking-wide">
                {stat.label}
              </div>
              <div className={cn("text-[1.4rem] sm:text-[1.75rem] font-bold font-[var(--font-display)] text-[var(--text)] tracking-tight mt-0.5", loading && "animate-pulse")}>
                {stat.value}
                {stat.suffix && <span className="text-[0.82rem] font-normal text-[var(--text-muted)]">{stat.suffix}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main content: 2-column */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Left: Runs + Activity */}
        <div className="lg:col-span-3 flex flex-col gap-4 sm:gap-6">
          {/* Recent Pipeline Runs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[1rem] font-semibold text-[var(--text)]">Recent Runs</h2>
              <Link href="/dashboard/workspace" className="text-[0.82rem] text-[var(--text-muted)] no-underline hover:text-[var(--text)] transition-colors">
                View all &rarr;
              </Link>
            </div>
            {loading ? (
              <RunsSkeleton />
            ) : !data?.pipelineRuns.length ? (
              <div className={cn(glassCard, "px-5 py-8 text-center text-[0.88rem] text-[var(--text-muted)]")}>
                No pipeline runs yet — open your workspace to get started.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {data.pipelineRuns.map((run) => (
                  <RunRow key={run.requestId} run={run} />
                ))}
              </div>
            )}
          </div>

          {/* Live Activity */}
          <div>
            <h2 className="text-[1rem] font-semibold text-[var(--text)] mb-3">Live Activity</h2>
            {loading ? (
              <ActivitySkeleton />
            ) : !data?.recentActivity.length ? (
              <div className={cn(glassCard, "px-5 py-8 text-center text-[0.88rem] text-[var(--text-muted)]")}>
                No activity recorded yet.
              </div>
            ) : (
              <div className={cn(glassCard, "divide-y divide-[var(--surface-border)] overflow-hidden")}>
                {data.recentActivity.map((item, i) => {
                  const display = getAgentDisplay(item.agent);
                  const action = item.action.replace(/\*\*/g, "").replace(/\n[\s\S]*/m, "").trim();
                  const actionShort = action.length > 55 ? `${action.slice(0, 55)}…` : action;
                  const promptShort = item.runPrompt.length > 48 ? `${item.runPrompt.slice(0, 48)}…` : item.runPrompt;
                  return (
                    <div key={i} className="px-5 py-3 flex items-start gap-3">
                      <span
                        className="size-2.5 rounded-full shrink-0 mt-[5px]"
                        style={{ background: display.color, boxShadow: `0 0 6px ${display.color}40` }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.88rem] truncate">
                          <span className="font-semibold text-[var(--text)]">{display.label}</span>
                          {" "}
                          <span className="text-[var(--text-muted)]">{actionShort}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[0.75rem] text-[var(--text-muted)]">
                          <span className="truncate opacity-60">for: {promptShort}</span>
                          {item.prUrl && (
                            <>
                              <span className="opacity-30 shrink-0">·</span>
                              <a href={item.prUrl} target="_blank" rel="noopener noreferrer" className="text-[#22c55e] shrink-0 hover:underline">PR ↗</a>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="text-[0.75rem] text-[var(--text-muted)] shrink-0 mt-[2px]">
                        {formatRelativeTime(item.runCreatedAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Agents + Quick Launch */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[1rem] font-semibold text-[var(--text)]">Your Agents</h2>
            <Link href="/dashboard/agents" className="text-[0.82rem] text-[var(--text-muted)] no-underline hover:text-[var(--text)] transition-colors">
              Browse all &rarr;
            </Link>
          </div>
          <div className="flex flex-col gap-2.5">
            {MOCK_AGENTS.slice(0, 6).map((agent) => (
              <AgentMiniCard key={agent.id} agent={agent} />
            ))}
          </div>

          <div className="mt-5 sm:mt-6">
            <h2 className="text-[1rem] font-semibold text-[var(--text)] mb-3">Quick Launch</h2>
            <div className="grid grid-cols-2 gap-2.5">
              <Link href="/dashboard/agents" className="no-underline">
                <div className={cn(glassCard, "p-4 flex flex-col items-center gap-2.5 text-center transition-all duration-200 hover:border-[rgba(167,139,250,0.25)] cursor-pointer group")}>
                  <div className="size-11 rounded-xl bg-[rgba(167,139,250,0.1)] border border-[rgba(167,139,250,0.2)] flex items-center justify-center">
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8">
                      <path d="M12 8V4H8" />
                      <rect x="4" y="8" width="16" height="12" rx="2" />
                      <circle cx="9" cy="14" r="1.5" fill="#a78bfa" />
                      <circle cx="15" cy="14" r="1.5" fill="#a78bfa" />
                    </svg>
                  </div>
                  <span className="text-[0.85rem] font-semibold text-[var(--text)] group-hover:text-[#a78bfa] transition-colors">Hire Agent</span>
                </div>
              </Link>
              <Link href="/dashboard/teams" className="no-underline">
                <div className={cn(glassCard, "p-4 flex flex-col items-center gap-2.5 text-center transition-all duration-200 hover:border-[rgba(52,211,153,0.25)] cursor-pointer group")}>
                  <div className="size-11 rounded-xl bg-[rgba(52,211,153,0.1)] border border-[rgba(52,211,153,0.2)] flex items-center justify-center">
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.8">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <span className="text-[0.85rem] font-semibold text-[var(--text)] group-hover:text-[#34d399] transition-colors">Browse Teams</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
