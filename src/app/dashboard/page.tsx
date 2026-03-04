import Link from "next/link";
import { cn } from "@/lib/utils";
import { glassCard, textGradientTitle } from "@/lib/styles";
import { StatCard } from "@/components/dashboard/stat-card";
import { MOCK_STATS } from "@/lib/dashboard/mock-data";

export default function DashboardOverview() {
  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className={cn("text-[1.8rem] font-bold font-[var(--font-display)] tracking-tight", textGradientTitle)}>
          Dashboard
        </h1>
        <p className="text-[0.88rem] text-[var(--text-muted)] mt-1">
          Welcome back. Here&apos;s your AI team overview.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8V4H8" />
              <rect x="4" y="8" width="16" height="12" rx="2" />
            </svg>
          }
          label="Active Agents"
          value={MOCK_STATS.activeAgents}
        />
        <StatCard
          icon={
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 11 12 14 22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          }
          label="Tasks Completed"
          value={MOCK_STATS.tasksCompleted.toLocaleString()}
        />
        <StatCard
          icon={
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
          label="Active Teams"
          value={MOCK_STATS.activeTeams}
        />
        <StatCard
          icon={
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          }
          label="Uptime"
          value={MOCK_STATS.uptime}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-[0.95rem] font-semibold text-[var(--text)] mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/dashboard/agents" className="no-underline">
            <div className={cn(glassCard, "p-5 flex items-center gap-4 transition-all duration-200 hover:border-[rgba(34,197,94,0.2)] cursor-pointer group")}>
              <div className="size-10 rounded-lg bg-[rgba(167,139,250,0.1)] border border-[rgba(167,139,250,0.2)] flex items-center justify-center shrink-0">
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8V4H8" />
                  <rect x="4" y="8" width="16" height="12" rx="2" />
                  <circle cx="9" cy="14" r="1.5" fill="#a78bfa" />
                  <circle cx="15" cy="14" r="1.5" fill="#a78bfa" />
                </svg>
              </div>
              <div>
                <div className="text-[0.82rem] font-semibold text-[var(--text)] group-hover:text-[#22c55e] transition-colors">
                  Browse Agents
                </div>
                <div className="text-[0.7rem] text-[var(--text-muted)]">
                  Hire AI agents for your team
                </div>
              </div>
            </div>
          </Link>

          <Link href="/dashboard/teams" className="no-underline">
            <div className={cn(glassCard, "p-5 flex items-center gap-4 transition-all duration-200 hover:border-[rgba(34,197,94,0.2)] cursor-pointer group")}>
              <div className="size-10 rounded-lg bg-[rgba(52,211,153,0.1)] border border-[rgba(52,211,153,0.2)] flex items-center justify-center shrink-0">
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <div className="text-[0.82rem] font-semibold text-[var(--text)] group-hover:text-[#22c55e] transition-colors">
                  Browse Teams
                </div>
                <div className="text-[0.7rem] text-[var(--text-muted)]">
                  Pre-built AI team packages
                </div>
              </div>
            </div>
          </Link>

          <Link href="/dashboard/workspace" className="no-underline">
            <div className={cn(glassCard, "p-5 flex items-center gap-4 transition-all duration-200 hover:border-[rgba(34,197,94,0.2)] cursor-pointer group")}>
              <div className="size-10 rounded-lg bg-[rgba(249,115,22,0.1)] border border-[rgba(249,115,22,0.2)] flex items-center justify-center shrink-0">
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                  <path d="M2 13h20" />
                </svg>
              </div>
              <div>
                <div className="text-[0.82rem] font-semibold text-[var(--text)] group-hover:text-[#22c55e] transition-colors">
                  My Workspace
                </div>
                <div className="text-[0.7rem] text-[var(--text-muted)]">
                  Open your active pipeline
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
