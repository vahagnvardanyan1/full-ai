"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { glassCard, textGradientTitle } from "@/lib/styles";
import { AgentAvatar } from "@/components/agent-avatar";
import { MOCK_WORKSPACE, MOCK_AGENTS } from "@/lib/dashboard/mock-data";
import type { IWorkspaceMember } from "@/lib/dashboard/types";

/* ── Mock activity & run data ───────────────────────── */

const RECENT_ACTIVITY = [
  { agent: "Product Manager", action: "Created 4 tasks for sprint backlog", time: "3m ago", color: "#f59e0b" },
  { agent: "Frontend Engineer", action: "Committed dashboard-ui components", time: "7m ago", color: "#3b82f6" },
  { agent: "DevOps Engineer", action: "Deployed staging build v2.4.2", time: "15m ago", color: "#8b5cf6" },
  { agent: "QA Engineer", action: "Ran 18 integration tests — all passed", time: "22m ago", color: "#ef4444" },
  { agent: "Frontend Engineer", action: "Merged PR #51 into main", time: "34m ago", color: "#3b82f6" },
];

const PIPELINE_RUNS = [
  { id: "r1", prompt: "Build user auth with OAuth", tasks: 12, status: "completed" as const, duration: "3m 42s", time: "1h ago" },
  { id: "r2", prompt: "Add dark mode to settings", tasks: 6, status: "completed" as const, duration: "1m 18s", time: "3h ago" },
  { id: "r3", prompt: "Create notification API endpoints", tasks: 9, status: "completed" as const, duration: "2m 55s", time: "5h ago" },
];

/* ── Status helpers ─────────────────────────────────── */

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: "Working", color: "#22c55e" },
  idle: { label: "Standby", color: "#6b7280" },
  offline: { label: "Offline", color: "#4b5563" },
};

function StatusDot({ status, size = 6 }: { status: string; size?: number }) {
  const color = STATUS_CONFIG[status]?.color ?? "#6b7280";
  const isActive = status === "active";
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{ width: size, height: size, background: color, boxShadow: isActive ? `0 0 8px ${color}60` : "none" }}
    />
  );
}

/* ── Member card (enhanced) ─────────────────────────── */

function stableProgress(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return 40 + (((hash % 40) + 40) % 40);
}

function MemberCard({ member }: { member: IWorkspaceMember }) {
  const status = STATUS_CONFIG[member.status] ?? STATUS_CONFIG.idle;
  const agentData = MOCK_AGENTS.find((a) => a.id === member.agentId);

  return (
    <div
      className={cn(glassCard, "p-4 flex flex-col gap-3 transition-all duration-200 hover:border-[rgba(34,197,94,0.15)]")}
      style={{ borderTop: `2px solid ${member.color}` }}
    >
      <div className="flex items-center gap-3">
        {agentData?.avatar ? (
          <Image
            src={agentData.avatar}
            alt={member.name}
            width={40}
            height={40}
            className="size-10 rounded-full shrink-0 bg-[var(--surface-raised)] border border-[var(--surface-border)]"
          />
        ) : (
          <AgentAvatar
            role={member.role}
            size={40}
            status={member.status === "active" ? "working" : "idle"}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[0.92rem] font-semibold text-[var(--text)] truncate">{member.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <StatusDot status={member.status} />
            <span className="text-[0.9rem] font-medium" style={{ color: status.color }}>{status.label}</span>
          </div>
        </div>
      </div>

      {member.currentTask ? (
        <div className="px-3 py-2 rounded-lg bg-[var(--surface-raised)] border border-[var(--surface-border)]">
          <div className="text-[0.75rem] text-[var(--text-muted)] uppercase tracking-wide font-semibold mb-1">Current Task</div>
          <div className="text-[0.85rem] text-[var(--text)] leading-snug">{member.currentTask}</div>
          {member.status === "active" && (
            <div className="mt-2 h-1 rounded-full bg-[var(--surface-border)] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${stableProgress(member.agentId)}%`,
                  background: `linear-gradient(90deg, ${member.color}, ${member.color}80)`,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="px-3 py-2 rounded-lg border border-dashed border-[var(--surface-border)] text-[0.8rem] text-[var(--text-muted)] text-center">
          Awaiting assignment
        </div>
      )}

      {agentData && (
        <div className="flex items-center justify-between text-[0.75rem] text-[var(--text-muted)]">
          <span>{agentData.tasksCompleted} tasks completed</span>
          <span className="flex items-center gap-1">
            <svg width={10} height={10} viewBox="0 0 24 24" fill="#facc15" stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {agentData.rating}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────── */

export default function WorkspacePage() {
  const team = MOCK_WORKSPACE[0];
  const activeCount = team.members.filter((m) => m.status === "active").length;
  const idleCount = team.members.filter((m) => m.status === "idle").length;

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className={cn("text-[1.5rem] sm:text-[1.8rem] font-bold font-[var(--font-display)] tracking-tight", textGradientTitle)}>
            My Workspace
          </h1>
          <p className="text-[0.92rem] sm:text-[1rem] text-[var(--text-muted)] mt-1">
            Manage your active teams and monitor agent activity.
          </p>
        </div>
        <Link href="/dashboard/teams" className="no-underline shrink-0 w-fit">
          <span className="inline-flex items-center gap-2 py-2 px-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-raised)] text-[var(--text-muted)] text-[0.9rem] font-medium hover:border-[rgba(34,197,94,0.25)] hover:text-[var(--text)] transition-all cursor-pointer">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Team
          </span>
        </Link>
      </div>

      {/* Team hero card */}
      <div className={cn(glassCard, "p-5 sm:p-6 overflow-hidden relative")}>
        {/* Subtle gradient bg */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 20% 0%, rgba(34,197,94,0.04) 0%, transparent 50%)" }} />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] flex items-center justify-center shrink-0">
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                <path d="M2 13h20" />
              </svg>
            </div>
            <div>
              <h2 className="text-[1.1rem] font-bold text-[var(--text)]">{team.name}</h2>
              <div className="flex items-center gap-3 mt-1 text-[0.85rem] text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  <StatusDot status="active" />
                  {activeCount} working
                </span>
                <span className="flex items-center gap-1.5">
                  <StatusDot status="idle" />
                  {idleCount} standby
                </span>
                <span>Active since {new Date(team.activeSince).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Agent avatar stack */}
            <div className="flex -space-x-2 mr-2">
              {team.members.map((m) => {
                const agentData = MOCK_AGENTS.find((a) => a.id === m.agentId);
                return agentData?.avatar ? (
                  <Image
                    key={m.agentId}
                    src={agentData.avatar}
                    alt={m.name}
                    width={32}
                    height={32}
                    className="size-8 rounded-full border-2 border-[var(--glass-bg)] bg-[var(--surface-raised)]"
                    title={m.name}
                  />
                ) : (
                  <div
                    key={m.agentId}
                    className="size-8 rounded-full border-2 border-[var(--glass-bg)] flex items-center justify-center text-[0.5rem] font-bold"
                    style={{ background: `${m.color}15`, color: m.color }}
                    title={m.name}
                  >
                    {m.name[0]}
                  </div>
                );
              })}
            </div>

            <Link href={`/dashboard/workspace/${team.teamId}`} className="no-underline">
              <span className="inline-flex items-center gap-2 py-2.5 px-5 rounded-lg bg-gradient-to-br from-[#22c55e] to-[#16a34a] text-white text-[0.9rem] font-semibold cursor-pointer transition-all duration-200 shadow-[0_2px_12px_rgba(34,197,94,0.25)] hover:shadow-[0_2px_20px_rgba(34,197,94,0.4)]">
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Open Pipeline
              </span>
            </Link>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="relative grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-[var(--surface-border)]">
          {[
            { label: "Total Tasks", value: "1,247", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>, color: "#3b82f6" },
            { label: "Pipeline Runs", value: "38", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>, color: "#a78bfa" },
            { label: "Uptime", value: "99.9%", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>, color: "#22c55e" },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-2.5">
              <div
                className="size-8 rounded-lg flex items-center justify-center shrink-0 border"
                style={{ background: `${stat.color}10`, borderColor: `${stat.color}20`, color: stat.color }}
              >
                {stat.icon}
              </div>
              <div>
                <div className="text-[0.72rem] text-[var(--text-muted)] uppercase tracking-wide font-medium">{stat.label}</div>
                <div className="text-[1rem] font-bold text-[var(--text)] tracking-tight">{stat.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main content: 2-col */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left: Agent cards */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[1rem] font-semibold text-[var(--text)]">Team Members</h2>
            <span className="text-[0.8rem] text-[var(--text-muted)]">{team.members.length} agents</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {team.members.map((member) => (
              <MemberCard key={member.agentId} member={member} />
            ))}

            {/* Add agent placeholder */}
            <Link href="/dashboard/agents" className="no-underline">
              <div className={cn(glassCard, "p-4 flex flex-col items-center justify-center gap-2 min-h-[160px] border-dashed cursor-pointer transition-all duration-200 hover:border-[rgba(34,197,94,0.25)] group")}>
                <div className="size-10 rounded-full border border-dashed border-[var(--surface-border)] flex items-center justify-center text-[var(--text-muted)] group-hover:border-[rgba(34,197,94,0.3)] group-hover:text-[#22c55e] transition-colors">
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <span className="text-[0.85rem] font-medium text-[var(--text-muted)] group-hover:text-[#22c55e] transition-colors">Add Agent</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Right: Activity + Runs */}
        <div className="flex flex-col gap-4 sm:gap-6">
          {/* Activity feed */}
          <div>
            <h2 className="text-[1rem] font-semibold text-[var(--text)] mb-3">Recent Activity</h2>
            <div className={cn(glassCard, "divide-y divide-[var(--surface-border)] overflow-hidden")}>
              {RECENT_ACTIVITY.map((item, i) => (
                <div key={i} className="px-4 py-3 flex items-start gap-2.5">
                  <span
                    className="size-2 rounded-full shrink-0 mt-1.5"
                    style={{ background: item.color, boxShadow: `0 0 6px ${item.color}40` }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[0.85rem] leading-snug">
                      <span className="font-semibold text-[var(--text)]">{item.agent}</span>
                      {" "}
                      <span className="text-[var(--text-muted)]">{item.action}</span>
                    </div>
                    <div className="text-[0.72rem] text-[var(--text-muted)] mt-0.5">{item.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pipeline runs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[1rem] font-semibold text-[var(--text)]">Pipeline Runs</h2>
              <Link href={`/dashboard/workspace/${team.teamId}`} className="text-[0.8rem] text-[var(--text-muted)] no-underline hover:text-[var(--text)] transition-colors">
                View all &rarr;
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              {PIPELINE_RUNS.map((run) => (
                <div key={run.id} className={cn(glassCard, "px-4 py-3 flex items-center gap-3")}>
                  <div className="size-8 rounded-lg bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.15)] flex items-center justify-center shrink-0">
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.85rem] font-medium text-[var(--text)] truncate">{run.prompt}</div>
                    <div className="text-[0.72rem] text-[var(--text-muted)] mt-0.5">
                      {run.tasks} tasks &middot; {run.duration} &middot; {run.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Empty state (kept for zero-teams case) */}
      {MOCK_WORKSPACE.length === 0 && (
        <div className={cn(glassCard, "p-12 text-center")}>
          <div className="size-16 rounded-2xl bg-[var(--surface-raised)] border border-[var(--surface-border)] flex items-center justify-center mx-auto mb-4">
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round">
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            </svg>
          </div>
          <p className="text-[var(--text-muted)] text-[1rem] mb-1">No active teams yet</p>
          <p className="text-[var(--text-muted)] text-[0.88rem] mb-5">Browse the marketplace to hire your first AI team.</p>
          <Link href="/dashboard/teams" className="no-underline">
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-br from-[#22c55e] to-[#16a34a] text-white text-[0.9rem] font-semibold cursor-pointer shadow-[0_2px_12px_rgba(34,197,94,0.3)]">
              Browse Teams
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
