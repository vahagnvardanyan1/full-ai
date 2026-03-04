import Link from "next/link";
import { cn } from "@/lib/utils";
import { glassCard, pillBase } from "@/lib/styles";
import type { ITeam } from "@/lib/dashboard/types";

export function TeamCard({ team }: { team: ITeam }) {
  const priceRange = team.pricing.length > 0
    ? `$${team.pricing[0].price} – $${team.pricing[team.pricing.length - 1].price}`
    : "Custom";

  return (
    <Link href={`/dashboard/teams/${team.id}`} className="no-underline group">
      <div
        className={cn(
          glassCard,
          "p-5 flex flex-col gap-4 transition-all duration-200 hover:border-[rgba(34,197,94,0.2)] hover:shadow-[0_0_24px_rgba(34,197,94,0.06)] cursor-pointer",
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.15)] flex items-center justify-center text-[#22c55e] font-bold text-[0.9rem] shrink-0">
            {team.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[0.88rem] font-semibold text-[var(--text)] group-hover:text-[#22c55e] transition-colors truncate">
              {team.name}
            </div>
            <span className={cn(pillBase, "bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--surface-border)] mt-1")}>
              {team.category}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className="text-[0.76rem] text-[var(--text-muted)] leading-relaxed line-clamp-2">
          {team.description}
        </p>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-[0.68rem] text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            {team.agents.length} agents
          </span>
          <span className="flex items-center gap-1">
            <svg width={12} height={12} viewBox="0 0 24 24" fill="#facc15" stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {team.rating} ({team.reviewCount})
          </span>
          <span className="ml-auto font-semibold text-[var(--text)]">
            {priceRange}
          </span>
        </div>
      </div>
    </Link>
  );
}
