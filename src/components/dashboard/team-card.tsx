import Link from "next/link";
import { cn } from "@/lib/utils";
import { glassCard, pillBase } from "@/lib/styles";
import type { ITeam } from "@/lib/dashboard/types";

const CATEGORY_COLORS: Record<string, string> = {
  IT: "#3b82f6",
  Design: "#a78bfa",
  Marketing: "#f97316",
  Consulting: "#0ea5e9",
};

export function TeamCard({ team }: { team: ITeam }) {
  const highlightedPlan = team.pricing.find((p) => p.highlighted) ?? team.pricing[1];
  const catColor = CATEGORY_COLORS[team.category] ?? "#22c55e";

  return (
    <Link href={`/dashboard/teams/${team.id}`} className="no-underline group">
      <div
        className={cn(
          glassCard,
          "p-5 flex flex-col gap-4 transition-all duration-200 hover:shadow-[0_0_32px_rgba(34,197,94,0.08)] cursor-pointer relative overflow-hidden",
        )}
        style={{ borderTop: `2px solid ${catColor}` }}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className="size-11 rounded-xl flex items-center justify-center font-bold text-[0.9rem] shrink-0 border"
            style={{ background: `${catColor}12`, borderColor: `${catColor}25`, color: catColor }}
          >
            {team.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[0.88rem] font-semibold text-[var(--text)] group-hover:text-[#22c55e] transition-colors truncate">
              {team.name}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={cn(pillBase, "border")}
                style={{ color: catColor, background: `${catColor}10`, borderColor: `${catColor}20` }}
              >
                {team.category}
              </span>
              <span className="flex items-center gap-1 text-[0.65rem] text-[var(--text-muted)]">
                <svg width={11} height={11} viewBox="0 0 24 24" fill="#facc15" stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {team.rating}
                <span className="opacity-60">({team.reviewCount})</span>
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-[0.76rem] text-[var(--text-muted)] leading-relaxed line-clamp-2 m-0">
          {team.description}
        </p>

        {/* Agent avatars */}
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {team.agents.slice(0, 5).map((agent, i) => (
              agent.avatar ? (
                <img
                  key={`${agent.id}-${i}`}
                  src={agent.avatar}
                  alt={agent.name}
                  className="size-7 rounded-full border-2 border-[var(--glass-bg)] bg-[var(--surface-raised)]"
                  title={agent.name}
                />
              ) : (
                <div
                  key={`${agent.id}-${i}`}
                  className="size-7 rounded-full border-2 border-[var(--glass-bg)] bg-[var(--surface-raised)] flex items-center justify-center text-[0.5rem] font-bold text-[var(--text-muted)]"
                  title={agent.name}
                >
                  {agent.name[0]}
                </div>
              )
            ))}
            {team.agents.length > 5 && (
              <div className="size-7 rounded-full border-2 border-[var(--glass-bg)] bg-[var(--surface-raised)] flex items-center justify-center text-[0.5rem] font-semibold text-[var(--text-muted)]">
                +{team.agents.length - 5}
              </div>
            )}
          </div>
          <span className="text-[0.65rem] text-[var(--text-muted)]">
            {team.agents.length} agents
          </span>
        </div>

        {/* Services tags */}
        <div className="flex flex-wrap gap-1.5">
          {team.services.slice(0, 3).map((s) => (
            <span
              key={s}
              className="text-[0.62rem] px-2 py-0.5 rounded-full bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--surface-border)]"
            >
              {s}
            </span>
          ))}
          {team.services.length > 3 && (
            <span className="text-[0.62rem] px-2 py-0.5 rounded-full bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--surface-border)]">
              +{team.services.length - 3} more
            </span>
          )}
        </div>

        {/* Footer: price + CTA */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--surface-border)]">
          <div>
            <span className="text-[0.65rem] text-[var(--text-muted)]">From </span>
            <span className="text-[1rem] font-bold text-[var(--text)]">${team.pricing[0].price}</span>
            <span className="text-[0.68rem] text-[var(--text-muted)]">/mo</span>
          </div>
          <span
            className="text-[0.7rem] font-semibold px-3 py-1 rounded-lg transition-all duration-200 group-hover:shadow-[0_2px_12px_rgba(34,197,94,0.2)]"
            style={{
              color: "#22c55e",
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.15)",
            }}
          >
            View Team &rarr;
          </span>
        </div>
      </div>
    </Link>
  );
}
