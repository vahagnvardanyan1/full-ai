"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { glassCard, textGradientTitle } from "@/lib/styles";
import { MOCK_AGENTS, MOCK_WORKSPACE, MOCK_STATS } from "@/lib/dashboard/mock-data";

const ACTIVITY_FEED = [
  { agent: "Frontend Engineer", action: "Committed 3 files to", target: "dashboard-ui", time: "2m ago", color: "#3b82f6" },
  { agent: "QA Engineer", action: "Passed 12 tests on", target: "auth-flow", time: "5m ago", color: "#ef4444" },
  { agent: "Product Manager", action: "Created 4 tasks for", target: "sprint-7", time: "8m ago", color: "#f59e0b" },
  { agent: "DevOps Engineer", action: "Deployed", target: "v2.4.1 to staging", time: "12m ago", color: "#8b5cf6" },
  { agent: "Backend Engineer", action: "Merged PR #47 into", target: "main", time: "18m ago", color: "#22c55e" },
  { agent: "Data Analyst", action: "Generated report for", target: "Q1 metrics", time: "25m ago", color: "#0ea5e9" },
];

const RECENT_RUNS = [
  { id: "run-1", prompt: "Build user authentication flow", agents: 4, tasks: 12, status: "completed" as const, duration: "3m 42s" },
  { id: "run-2", prompt: "Add dark mode to settings page", agents: 2, tasks: 6, status: "completed" as const, duration: "1m 18s" },
  { id: "run-3", prompt: "Create REST API for notifications", agents: 3, tasks: 9, status: "running" as const, duration: "0m 47s" },
];

function StatusDot({ status, size = 6 }: { status: string; size?: number }) {
  const color = status === "active" || status === "available" ? "#22c55e" : status === "busy" || status === "running" ? "#f59e0b" : "#6b7280";
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
}

function AgentMiniCard({ agent }: { agent: typeof MOCK_AGENTS[0] }) {
  return (
    <Link href={`/dashboard/agents/${agent.id}`} className="no-underline">
      <div className={cn(glassCard, "p-3.5 flex items-center gap-3 transition-all duration-200 hover:border-[rgba(34,197,94,0.2)] cursor-pointer group")}>
        {agent.avatar ? (
          <Image src={agent.avatar} alt={agent.name} width={36} height={36} className="size-9 rounded-full shrink-0 bg-[var(--surface-raised)] border border-[var(--surface-border)]" />
        ) : (
          <div className="size-9 rounded-full shrink-0 bg-[var(--surface-raised)] border border-[var(--surface-border)] flex items-center justify-center text-[0.75rem] font-bold text-[var(--text-muted)]">
            {agent.name[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[0.78rem] font-semibold text-[var(--text)] group-hover:text-[#22c55e] transition-colors truncate">
            {agent.name}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <StatusDot status={agent.status} />
            <span className="text-[0.65rem] text-[var(--text-muted)] capitalize">{agent.status}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[0.68rem] font-semibold text-[var(--text)]">{agent.tasksCompleted}</div>
          <div className="text-[0.58rem] text-[var(--text-muted)]">tasks</div>
        </div>
      </div>
    </Link>
  );
}

function RunRow({ run }: { run: typeof RECENT_RUNS[0] }) {
  const isRunning = run.status === "running";
  return (
    <Link href="/dashboard/workspace" className="no-underline">
      <div className={cn(glassCard, "px-4 py-3 flex items-center gap-3 transition-all duration-200 hover:border-[rgba(34,197,94,0.15)] cursor-pointer group")}>
        <div className={cn(
          "size-8 rounded-lg flex items-center justify-center shrink-0 border",
          isRunning
            ? "bg-[rgba(249,115,22,0.1)] border-[rgba(249,115,22,0.2)]"
            : "bg-[rgba(34,197,94,0.08)] border-[rgba(34,197,94,0.15)]"
        )}>
          {isRunning ? (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin" style={{ animationDuration: "3s" }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[0.78rem] font-medium text-[var(--text)] group-hover:text-[#22c55e] transition-colors truncate">
            {run.prompt}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[0.65rem] text-[var(--text-muted)]">
            <span>{run.agents} agents</span>
            <span className="opacity-30">|</span>
            <span>{run.tasks} tasks</span>
            <span className="opacity-30">|</span>
            <span>{run.duration}</span>
          </div>
        </div>
        <div className="shrink-0">
          {isRunning ? (
            <span className="inline-flex items-center gap-1.5 text-[0.62rem] font-semibold text-[#f97316] bg-[rgba(249,115,22,0.1)] border border-[rgba(249,115,22,0.2)] px-2 py-0.5 rounded-full">
              <StatusDot status="running" size={5} />
              Running
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[0.62rem] font-semibold text-[#22c55e] bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.15)] px-2 py-0.5 rounded-full">
              Done
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function DashboardOverview() {
  const workspace = MOCK_WORKSPACE[0];
  const activeMembers = workspace.members.filter((m) => m.status === "active");

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1200px] mx-auto space-y-6 sm:space-y-8">
      {/* Header with greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className={cn("text-[1.5rem] sm:text-[1.8rem] font-bold font-[var(--font-display)] tracking-tight", textGradientTitle)}>
            Command Center
          </h1>
          <p className="text-[0.82rem] sm:text-[0.88rem] text-[var(--text-muted)] mt-1">
            {activeMembers.length} agents working &middot; {MOCK_STATS.tasksCompleted.toLocaleString()} tasks completed
          </p>
        </div>
        <Link
          href="/dashboard/workspace"
          className="inline-flex items-center gap-2 py-2 px-4 rounded-lg bg-gradient-to-br from-[#22c55e] to-[#16a34a] text-white text-[0.78rem] font-semibold no-underline transition-all duration-200 shadow-[0_2px_12px_rgba(34,197,94,0.25)] hover:shadow-[0_2px_20px_rgba(34,197,94,0.4)] shrink-0 w-fit"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Open Workspace
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Active Agents", value: MOCK_STATS.activeAgents, suffix: `/${MOCK_AGENTS.length}`, color: "#22c55e", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 8V4H8" /><rect x="4" y="8" width="16" height="12" rx="2" /></svg> },
          { label: "Tasks Done", value: MOCK_STATS.tasksCompleted.toLocaleString(), suffix: "", color: "#3b82f6", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg> },
          { label: "Teams", value: MOCK_STATS.activeTeams, suffix: " active", color: "#a78bfa", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
          { label: "Uptime", value: MOCK_STATS.uptime, suffix: "", color: "#f59e0b", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg> },
        ].map((stat) => (
          <div key={stat.label} className={cn(glassCard, "p-4 sm:p-5 flex items-start gap-3")}>
            <div
              className="size-9 sm:size-10 rounded-lg flex items-center justify-center shrink-0 border"
              style={{ background: `${stat.color}12`, borderColor: `${stat.color}25`, color: stat.color }}
            >
              {stat.icon}
            </div>
            <div className="min-w-0">
              <div className="text-[0.65rem] sm:text-[0.72rem] font-medium text-[var(--text-muted)] uppercase tracking-wide">
                {stat.label}
              </div>
              <div className="text-[1.2rem] sm:text-[1.5rem] font-bold font-[var(--font-display)] text-[var(--text)] tracking-tight mt-0.5">
                {stat.value}
                {stat.suffix && <span className="text-[0.7rem] font-normal text-[var(--text-muted)]">{stat.suffix}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main content: 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Left column: Activity + Runs */}
        <div className="lg:col-span-3 flex flex-col gap-4 sm:gap-6">
          {/* Recent Pipeline Runs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[0.88rem] font-semibold text-[var(--text)]">Recent Runs</h2>
              <Link href="/dashboard/workspace" className="text-[0.7rem] text-[var(--text-muted)] no-underline hover:text-[var(--text)] transition-colors">
                View all &rarr;
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              {RECENT_RUNS.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </div>
          </div>

          {/* Activity Feed */}
          <div>
            <h2 className="text-[0.88rem] font-semibold text-[var(--text)] mb-3">Live Activity</h2>
            <div className={cn(glassCard, "divide-y divide-[var(--surface-border)] overflow-hidden")}>
              {ACTIVITY_FEED.map((item, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3 text-[0.76rem]">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ background: item.color, boxShadow: `0 0 6px ${item.color}40` }}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="font-semibold text-[var(--text)]">{item.agent}</span>
                    {" "}
                    <span className="text-[var(--text-muted)]">{item.action}</span>
                    {" "}
                    <span className="font-mono text-[0.7rem] text-[#22c55e]">{item.target}</span>
                  </span>
                  <span className="text-[0.62rem] text-[var(--text-muted)] shrink-0">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Agents */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[0.88rem] font-semibold text-[var(--text)]">Your Agents</h2>
            <Link href="/dashboard/agents" className="text-[0.7rem] text-[var(--text-muted)] no-underline hover:text-[var(--text)] transition-colors">
              Browse all &rarr;
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {MOCK_AGENTS.slice(0, 6).map((agent) => (
              <AgentMiniCard key={agent.id} agent={agent} />
            ))}
          </div>

          {/* Quick launch */}
          <div className="mt-4 sm:mt-6">
            <h2 className="text-[0.88rem] font-semibold text-[var(--text)] mb-3">Quick Launch</h2>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/dashboard/agents" className="no-underline">
                <div className={cn(glassCard, "p-3.5 flex flex-col items-center gap-2 text-center transition-all duration-200 hover:border-[rgba(167,139,250,0.25)] cursor-pointer group")}>
                  <div className="size-9 rounded-lg bg-[rgba(167,139,250,0.1)] border border-[rgba(167,139,250,0.2)] flex items-center justify-center">
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8">
                      <path d="M12 8V4H8" />
                      <rect x="4" y="8" width="16" height="12" rx="2" />
                      <circle cx="9" cy="14" r="1.5" fill="#a78bfa" />
                      <circle cx="15" cy="14" r="1.5" fill="#a78bfa" />
                    </svg>
                  </div>
                  <span className="text-[0.72rem] font-semibold text-[var(--text)] group-hover:text-[#a78bfa] transition-colors">Hire Agent</span>
                </div>
              </Link>
              <Link href="/dashboard/teams" className="no-underline">
                <div className={cn(glassCard, "p-3.5 flex flex-col items-center gap-2 text-center transition-all duration-200 hover:border-[rgba(52,211,153,0.25)] cursor-pointer group")}>
                  <div className="size-9 rounded-lg bg-[rgba(52,211,153,0.1)] border border-[rgba(52,211,153,0.2)] flex items-center justify-center">
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.8">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <span className="text-[0.72rem] font-semibold text-[var(--text)] group-hover:text-[#34d399] transition-colors">Browse Teams</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
