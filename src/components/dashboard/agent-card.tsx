import Link from "next/link";
import { cn } from "@/lib/utils";
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

const CATEGORY_ICONS: Record<string, string> = {
  Engineering: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
  Design: "M12 3l1.912 5.813h6.112l-4.968 3.602 1.912 5.813L12 14.626l-4.968 3.602 1.912-5.813-4.968-3.602h6.112z",
  Management: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  Quality: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  Operations: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  Analytics: "M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  Lifestyle: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
};

export function AgentCard({ agent, featured = false }: { agent: IAgent; featured?: boolean }) {
  const statusColor = STATUS_COLORS[agent.status] ?? "#6b7280";
  const catIcon = CATEGORY_ICONS[agent.category];

  return (
    <Link href={`/dashboard/agents/${agent.id}`} className="no-underline group">
      <div
        className={cn(
          "relative flex flex-col rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden",
          featured
            ? "border-[rgba(34,197,94,0.2)] shadow-[0_0_40px_rgba(34,197,94,0.06)]"
            : "border-[var(--surface-border)] hover:border-[rgba(34,197,94,0.2)] hover:shadow-[0_0_30px_rgba(34,197,94,0.05)]",
        )}
        style={{ background: "var(--glass-bg)", backdropFilter: "blur(12px)" }}
      >
        {/* Top accent line */}
        <div
          className="h-[2px] w-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: "linear-gradient(90deg, transparent, #22c55e, #a855f7, transparent)" }}
        />

        <div className="p-4 sm:p-5 flex flex-col gap-3">
          {/* Header row */}
          <div className="flex items-start gap-3.5">
            <div className="relative shrink-0">
              <div
                className="absolute -inset-1.5 rounded-full opacity-0 group-hover:opacity-20 blur-lg transition-opacity duration-300"
                style={{ background: "linear-gradient(135deg, #22c55e, #a855f7)" }}
              />
              <AgentAvatar role={agent.role} size={featured ? 52 : 46} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-[0.95rem] font-semibold text-[var(--text)] truncate group-hover:bg-gradient-to-r group-hover:from-[#22c55e] group-hover:to-[#a78bfa] group-hover:bg-clip-text group-hover:text-transparent transition-colors">
                  {agent.name}
                </h3>
                <span
                  className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[0.58rem] font-medium uppercase tracking-wide"
                  style={{
                    color: statusColor,
                    background: `${statusColor}12`,
                    border: `1px solid ${statusColor}25`,
                  }}
                >
                  <span className="inline-block size-1.5 rounded-full" style={{ background: statusColor }} />
                  {agent.status}
                </span>
              </div>
              <p className="text-[0.72rem] text-[var(--text-muted)] mt-1 line-clamp-2 leading-relaxed">
                {agent.description}
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 pt-1">
            <span className="flex items-center gap-1 text-[0.72rem]">
              <svg width={13} height={13} viewBox="0 0 24 24" fill="#facc15" stroke="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span className="font-semibold text-[var(--text)]">{agent.rating}</span>
              <span className="text-[var(--text-muted)]">({agent.reviewCount})</span>
            </span>
            <span className="text-[0.65rem] text-[var(--text-muted)]">{agent.tasksCompleted} tasks done</span>
            {catIcon && (
              <span className="ml-auto flex items-center gap-1 text-[0.62rem] text-[var(--text-muted)]">
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d={catIcon} />
                </svg>
                {agent.category}
              </span>
            )}
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-[var(--surface-border)]" />

          {/* Bottom row: skills + price */}
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
              {agent.skills.slice(0, 3).map((skill) => {
                const color = SKILL_LEVEL_COLORS[skill.level] ?? "#6b7280";
                return (
                  <span
                    key={skill.name}
                    className="inline-flex items-center px-2 py-[3px] rounded-md text-[0.62rem] font-medium"
                    style={{
                      color,
                      background: `${color}0c`,
                      border: `1px solid ${color}20`,
                    }}
                  >
                    {skill.name}
                  </span>
                );
              })}
              {agent.skills.length > 3 && (
                <span className="inline-flex items-center px-1.5 py-[3px] rounded-md text-[0.6rem] text-[var(--text-muted)]">
                  +{agent.skills.length - 3}
                </span>
              )}
            </div>
            <div className="shrink-0 text-right">
              <div className="flex items-baseline gap-0.5">
                <span className="text-[1.1rem] font-bold text-[var(--text)]">${agent.price}</span>
                <span className="text-[0.6rem] text-[var(--text-muted)]">/mo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
