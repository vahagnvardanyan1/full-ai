"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { textGradientTitle } from "@/lib/styles";
import { AgentCard } from "@/components/dashboard/agent-card";
import { MOCK_AGENTS } from "@/lib/dashboard/mock-data";
import { AGENT_CATEGORIES } from "@/lib/dashboard/constants";

export default function AgentsPage() {
  const [category, setCategory] = useState("All");

  const filtered =
    category === "All"
      ? MOCK_AGENTS
      : MOCK_AGENTS.filter((a) => a.category === category);

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto space-y-6">
      <div>
        <h1 className={cn("text-[1.8rem] font-bold font-[var(--font-display)] tracking-tight", textGradientTitle)}>
          Agents Marketplace
        </h1>
        <p className="text-[0.88rem] text-[var(--text-muted)] mt-1">
          Browse and hire AI agents for your projects.
        </p>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        {AGENT_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-[0.75rem] font-medium border cursor-pointer transition-all duration-150",
              category === cat
                ? "bg-[rgba(34,197,94,0.1)] text-[#22c55e] border-[rgba(34,197,94,0.25)]"
                : "bg-[var(--surface-raised)] text-[var(--text-muted)] border-[var(--surface-border)] hover:border-[var(--text-muted)] hover:text-[var(--text)]",
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-[var(--text-muted)] text-[0.88rem]">
          No agents found in this category.
        </div>
      )}
    </div>
  );
}
