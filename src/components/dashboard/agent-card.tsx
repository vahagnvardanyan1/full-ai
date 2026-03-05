import Link from "next/link";
import { cn } from "@/lib/utils";
import { pillBase } from "@/lib/styles";
import { AgentAvatar } from "@/components/agent-avatar";
import type { IAgent } from "@/lib/dashboard/types";

const STATUS_COLORS: Record<string, string> = {
  available: "#22c55e",
  busy: "#f59e0b",
  offline: "#6b7280",
};

const SKILL_LEVEL_COLORS: Record<string, string> = {
  expert: "#22c55e",
  advanced: "#3b82f6",
  intermediate: "#f59e0b",
  beginner: "#6b7280",
};

export function AgentCard({ agent }: { agent: IAgent }) {
  const statusColor = STATUS_COLORS[agent.status] ?? "#6b7280";

  return (
    <Link href={`/dashboard/agents/${agent.id}`} className="no-underline group">
      <div
        className="p-3 sm:p-4 flex flex-col gap-2.5 sm:gap-3 rounded-xl border border-[var(--surface-border)] transition-all duration-200 cursor-pointer hover:border-[rgba(34,197,94,0.25)] hover:shadow-[0_0_24px_rgba(34,197,94,0.06)]"
        style={{ background: "var(--glass-bg)", backdropFilter: "blur(12px)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div
              className="absolute -inset-1 rounded-full opacity-0 group-hover:opacity-30 blur-md transition-opacity"
              style={{ background: "linear-gradient(135deg, #22c55e, #a855f7)" }}
            />
            <AgentAvatar role={agent.role} size={44} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[0.92rem] font-semibold text-[var(--text)] truncate group-hover:bg-gradient-to-r group-hover:from-[#22c55e] group-hover:to-[#a78bfa] group-hover:bg-clip-text group-hover:text-transparent transition-colors">
              {agent.name}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="inline-block size-1.5 rounded-full"
                style={{ background: statusColor }}
              />
              <span className="text-[0.7rem] text-[var(--text-muted)] capitalize">
                {agent.status}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-baseline gap-0.5">
              <span className="text-[1rem] font-bold text-[var(--text)]">${agent.price}</span>
              <span className="text-[0.65rem] text-[var(--text-muted)]">/mo</span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-[0.7rem] text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <svg width={12} height={12} viewBox="0 0 24 24" fill="#facc15" stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {agent.rating}
          </span>
          <span>{agent.reviewCount} reviews</span>
          <span>{agent.tasksCompleted} tasks</span>
        </div>

        {/* Skills */}
        <div className="flex flex-wrap gap-1.5">
          {agent.skills.map((skill) => {
            const color = SKILL_LEVEL_COLORS[skill.level] ?? "#6b7280";
            return (
              <span
                key={skill.name}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.65rem] font-medium bg-[var(--surface-raised)] border border-[var(--surface-border)]"
              >
                <span className="text-[var(--text)]">{skill.name}</span>
                <span
                  className={cn(pillBase, "border text-[0.5rem] py-0")}
                  style={{ color, borderColor: `${color}30`, background: `${color}10` }}
                >
                  {skill.level}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </Link>
  );
}
