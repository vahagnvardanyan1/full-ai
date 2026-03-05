"use client";

import { useState, useMemo } from "react";
import { AgentCard } from "@/components/dashboard/agent-card";
import { MOCK_AGENTS } from "@/lib/dashboard/mock-data";
import { AGENT_CATEGORIES } from "@/lib/dashboard/constants";

const CATEGORY_ICONS: Record<string, string> = {
  All: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
  Engineering: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
  Design: "M12 3l1.912 5.813h6.112l-4.968 3.602 1.912 5.813L12 14.626l-4.968 3.602 1.912-5.813-4.968-3.602h6.112z",
  Management: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  Quality: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  Operations: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  Analytics: "M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  Lifestyle: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
};

export default function AgentsPage() {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = category === "All" ? MOCK_AGENTS : MOCK_AGENTS.filter((a) => a.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.skills.some((s) => s.name.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [category, search]);

  const totalAgents = MOCK_AGENTS.length;
  const availableCount = MOCK_AGENTS.filter((a) => a.status === "available").length;
  const avgRating = (MOCK_AGENTS.reduce((s, a) => s + a.rating, 0) / totalAgents).toFixed(1);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(168,85,247,0.04) 40%, transparent 70%)",
        }} />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        <div className="relative px-4 sm:px-6 lg:px-10 pt-5 sm:pt-6 pb-4 sm:pb-5">
          {/* Title row */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-[1.35rem] sm:text-[1.6rem] font-bold tracking-tight bg-gradient-to-r from-[#22c55e] via-[#86efac] to-[#a78bfa] bg-clip-text text-transparent">
                Agents Marketplace
              </h1>
              <p className="text-[0.76rem] sm:text-[0.8rem] text-[var(--text-muted)] mt-1">
                Hire specialized AI agents for your projects
              </p>
            </div>

            {/* Stats pills */}
            <div className="hidden sm:flex items-center gap-2">
              {[
                { label: "Agents", value: totalAgents, color: "#a78bfa" },
                { label: "Available", value: availableCount, color: "#22c55e" },
                { label: "Avg Rating", value: avgRating, color: "#facc15" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--surface-border)]"
                  style={{ background: "var(--surface-raised)" }}
                >
                  <span className="size-1.5 rounded-full" style={{ background: stat.color }} />
                  <span className="text-[0.68rem] text-[var(--text-muted)]">{stat.label}</span>
                  <span className="text-[0.78rem] font-semibold text-[var(--text)]">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Search + filters row */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div
              className="relative flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--surface-border)] sm:w-64 transition-colors focus-within:border-[rgba(34,197,94,0.3)]"
              style={{ background: "var(--surface-raised)" }}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={2} strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search agents, skills..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-[0.78rem] text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="text-[var(--text-muted)] hover:text-[var(--text)] text-[0.75rem] cursor-pointer"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Category filters */}
            <div className="flex flex-wrap gap-1.5">
              {AGENT_CATEGORIES.map((cat) => {
                const active = category === cat;
                const icon = CATEGORY_ICONS[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.7rem] font-medium border cursor-pointer transition-all duration-200 ${
                      active
                        ? "bg-[rgba(34,197,94,0.1)] text-[#22c55e] border-[rgba(34,197,94,0.25)] shadow-[0_0_12px_rgba(34,197,94,0.08)]"
                        : "bg-[var(--surface-raised)] text-[var(--text-muted)] border-[var(--surface-border)] hover:border-[rgba(255,255,255,0.1)] hover:text-[var(--text)]"
                    }`}
                  >
                    {icon && (
                      <svg
                        width={12} height={12} viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                        className="opacity-70"
                      >
                        <path d={icon} />
                      </svg>
                    )}
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Results info */}
      <div className="shrink-0 px-4 sm:px-6 lg:px-10 py-2 flex items-center justify-between">
        <span className="text-[0.68rem] text-[var(--text-muted)]">
          {filtered.length} agent{filtered.length !== 1 ? "s" : ""}{" "}
          {category !== "All" && <>in <span className="text-[var(--text)]">{category}</span></>}
          {search && <> matching &ldquo;<span className="text-[var(--text)]">{search}</span>&rdquo;</>}
        </span>
      </div>

      {/* Agent grid */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 lg:px-10 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((agent, i) => (
            <AgentCard key={agent.id} agent={agent} featured={i === 0 && category === "All" && !search} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div
              className="size-16 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--surface-border)" }}
            >
              <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={1.5} strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
                <path d="M8 11h6" />
              </svg>
            </div>
            <p className="text-[0.85rem] text-[var(--text-muted)]">No agents found</p>
            <button
              onClick={() => { setCategory("All"); setSearch(""); }}
              className="text-[0.75rem] text-[#22c55e] hover:underline cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
