import Link from "next/link";
import { cn } from "@/lib/utils";
import { glassCard, textGradientTitle } from "@/lib/styles";
import { WorkspaceMemberCard } from "@/components/dashboard/workspace-member";
import { MOCK_WORKSPACE } from "@/lib/dashboard/mock-data";

export default function WorkspacePage() {
  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto space-y-6">
      <div>
        <h1 className={cn("text-[1.8rem] font-bold font-[var(--font-display)] tracking-tight", textGradientTitle)}>
          My Workspace
        </h1>
        <p className="text-[0.88rem] text-[var(--text-muted)] mt-1">
          Your active teams and their current status.
        </p>
      </div>

      {MOCK_WORKSPACE.map((team) => (
        <div key={team.teamId} className={cn(glassCard, "p-6 space-y-5")}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[1rem] font-semibold text-[var(--text)]">{team.name}</h2>
              <p className="text-[0.72rem] text-[var(--text-muted)] mt-0.5">
                {team.members.length} members &middot; Active since {new Date(team.activeSince).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </p>
            </div>
            <Link href={`/dashboard/workspace/${team.teamId}`}>
              <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-[#22c55e] to-[#16a34a] text-white text-[0.78rem] font-semibold cursor-pointer transition-all duration-200 shadow-[0_2px_12px_rgba(34,197,94,0.3)] hover:from-[#16a34a] hover:to-[#15803d] hover:shadow-[0_2px_20px_rgba(34,197,94,0.5)] border-none">
                Open Pipeline
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {team.members.map((member) => (
              <WorkspaceMemberCard key={member.agentId} member={member} />
            ))}
          </div>
        </div>
      ))}

      {MOCK_WORKSPACE.length === 0 && (
        <div className={cn(glassCard, "p-12 text-center")}>
          <div className="text-[var(--text-muted)] text-[0.88rem] mb-4">
            No active teams yet.
          </div>
          <Link href="/dashboard/teams">
            <button className="px-4 py-2 rounded-lg bg-gradient-to-br from-[#22c55e] to-[#16a34a] text-white text-[0.78rem] font-semibold cursor-pointer border-none">
              Browse Teams
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
