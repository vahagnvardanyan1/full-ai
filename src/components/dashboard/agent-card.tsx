import Link from "next/link";
import { cn } from "@/lib/utils";
import { glassCard, pillBase } from "@/lib/styles";
import type { IAgent } from "@/lib/dashboard/types";

const STATUS_COLORS: Record<string, string> = {
  available: "#22c55e",
  busy: "#f59e0b",
  offline: "#6b7280",
};

export function AgentCard({ agent }: { agent: IAgent }) {
  const statusColor = STATUS_COLORS[agent.status] ?? "#6b7280";

  return (
    <Link href={`/dashboard/agents/${agent.id}`} className="no-underline group">
      <div
        className={cn(
          glassCard,
          "p-5 flex flex-col gap-4 transition-all duration-200 hover:border-[rgba(34,197,94,0.2)] hover:shadow-[0_0_24px_rgba(34,197,94,0.06)] cursor-pointer",
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          {agent.avatar ? (
            <img
              src={agent.avatar}
              alt={agent.name}
              className="size-11 rounded-full shrink-0 bg-[var(--surface-raised)] border border-[var(--surface-border)]"
            />
          ) : (
            <div className="size-11 rounded-full shrink-0 bg-[var(--surface-raised)] border border-[var(--surface-border)] flex items-center justify-center text-[var(--text-muted)] font-bold text-[0.9rem]">
              {agent.name[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[0.88rem] font-semibold text-[var(--text)] group-hover:text-[#22c55e] transition-colors truncate">
              {agent.name}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="inline-block size-1.5 rounded-full"
                style={{ background: statusColor }}
              />
              <span className="text-[0.68rem] text-[var(--text-muted)] capitalize">
                {agent.status}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[1rem] font-bold text-[var(--text)]">
              ${agent.price}
            </div>
            <div className="text-[0.62rem] text-[var(--text-muted)]">/mo</div>
          </div>
        </div>

        {/* Skills */}
        <div className="flex flex-wrap gap-1.5">
          {agent.skills.map((skill) => (
            <span
              key={skill.name}
              className={cn(
                pillBase,
                "bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--surface-border)]",
              )}
            >
              {skill.name}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 text-[0.68rem] text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <svg width={12} height={12} viewBox="0 0 24 24" fill="#facc15" stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {agent.rating} ({agent.reviewCount})
          </span>
          <span>{agent.tasksCompleted} tasks</span>
        </div>
      </div>
    </Link>
  );
}
