"use client";

import { useState } from "react";
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
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(168,85,247,0.06) 50%, transparent 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative px-4 sm:px-6 lg:px-10 pt-4 sm:pt-5 pb-4 sm:pb-5">
          <h1 className="text-[1.3rem] sm:text-[1.6rem] font-bold tracking-tight bg-gradient-to-r from-[#22c55e] to-[#a78bfa] bg-clip-text text-transparent">
            Agents Marketplace
          </h1>
          <p className="text-[0.78rem] sm:text-[0.82rem] text-[var(--text-muted)] mt-1 sm:mt-1.5 mb-3 sm:mb-4">
            Browse and hire AI agents for your projects.
          </p>

          {/* Category filters */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {AGENT_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1 rounded-full text-[0.72rem] font-medium border cursor-pointer transition-all duration-150 ${
                  category === cat
                    ? "bg-[rgba(34,197,94,0.1)] text-[#22c55e] border-[rgba(34,197,94,0.25)]"
                    : "bg-[var(--surface-raised)] text-[var(--text-muted)] border-[var(--surface-border)] hover:border-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Agent grid — scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 lg:px-10 py-3 sm:py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
    </div>
  );
}
