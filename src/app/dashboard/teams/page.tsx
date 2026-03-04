"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { textGradientTitle } from "@/lib/styles";
import { TeamCard } from "@/components/dashboard/team-card";
import { TeamFlowHero } from "@/components/dashboard/team-flow-hero";
import { MOCK_TEAMS } from "@/lib/dashboard/mock-data";
import { TEAM_CATEGORIES } from "@/lib/dashboard/constants";

export default function TeamsPage() {
  const [category, setCategory] = useState("All");

  const filtered =
    category === "All"
      ? MOCK_TEAMS
      : MOCK_TEAMS.filter((t) => t.category === category);

  const totalAgents = MOCK_TEAMS.reduce((sum, t) => sum + t.agents.length, 0);

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className={cn("text-[1.5rem] sm:text-[1.8rem] font-bold font-[var(--font-display)] tracking-tight", textGradientTitle)}>
            Team Marketplace
          </h1>
          <p className="text-[0.82rem] sm:text-[0.88rem] text-[var(--text-muted)] mt-1">
            {MOCK_TEAMS.length} teams &middot; {totalAgents} agents &middot; Ready to deploy
          </p>
        </div>

        {/* Stats mini row */}
        <div className="flex items-center gap-4 text-[0.72rem] text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#22c55e] shadow-[0_0_6px_rgba(34,197,94,0.4)]" />
            {MOCK_TEAMS.length} available
          </span>
          <span className="flex items-center gap-1">
            <svg width={12} height={12} viewBox="0 0 24 24" fill="#facc15" stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {(MOCK_TEAMS.reduce((s, t) => s + t.rating, 0) / MOCK_TEAMS.length).toFixed(1)} avg
          </span>
        </div>
      </div>

      {/* Flow hero */}
      <TeamFlowHero />

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        {TEAM_CATEGORIES.map((cat) => {
          const count = cat === "All" ? MOCK_TEAMS.length : MOCK_TEAMS.filter((t) => t.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-[0.75rem] font-medium border cursor-pointer transition-all duration-150 flex items-center gap-1.5",
                category === cat
                  ? "bg-[rgba(34,197,94,0.1)] text-[#22c55e] border-[rgba(34,197,94,0.25)]"
                  : "bg-[var(--surface-raised)] text-[var(--text-muted)] border-[var(--surface-border)] hover:border-[var(--text-muted)] hover:text-[var(--text)]",
              )}
            >
              {cat}
              <span className={cn(
                "text-[0.6rem] font-semibold px-1.5 py-px rounded-full",
                category === cat
                  ? "bg-[rgba(34,197,94,0.15)] text-[#22c55e]"
                  : "bg-[var(--surface-hover)] text-[var(--text-muted)]",
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Team grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((team) => (
          <TeamCard key={team.id} team={team} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="text-[2rem] mb-2 opacity-30">
            <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-[var(--text-muted)]">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <p className="text-[var(--text-muted)] text-[0.88rem]">
            No teams found in &ldquo;{category}&rdquo;
          </p>
          <button
            onClick={() => setCategory("All")}
            className="mt-3 text-[0.78rem] text-[#22c55e] bg-transparent border-none cursor-pointer underline underline-offset-2"
          >
            Show all teams
          </button>
        </div>
      )}
    </div>
  );
}
