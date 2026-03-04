"use client";

import { AgentAvatar } from "@/components/agent-avatar";
import { glassCard } from "@/lib/styles";

function formatName(role: string): string {
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function TypingDots() {
  return (
    <span className="inline-flex gap-[3px] items-center ml-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1 rounded-full bg-[var(--text-muted)] inline-block"
          style={{ animation: `dot-bounce 1.2s ease-in-out ${i * 0.15}s infinite` }}
        />
      ))}
    </span>
  );
}

export function AgentWorking({ agents }: { agents: string[] }) {
  if (agents.length === 0) return null;

  return (
    <>
      {agents.map((agent) => (
        <div key={agent} className={`${glassCard} flex items-center gap-3 px-4 py-3 animate-slide-in`}>
          <AgentAvatar role={agent} size={42} status="working" />
          <span className="text-[0.8rem] text-[var(--text-muted)] flex items-center gap-[0.4rem]">
            {formatName(agent)} is working
            <TypingDots />
          </span>
        </div>
      ))}
    </>
  );
}
