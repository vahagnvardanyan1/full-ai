"use client";

import { CSSProperties } from "react";
import { AgentAvatar } from "@/components/agent-avatar";

const wrapper: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.75rem 1rem",
  background: "var(--glass-bg)",
  backdropFilter: "blur(var(--glass-blur))",
  WebkitBackdropFilter: "blur(var(--glass-blur))",
  border: "1px solid var(--glass-border)",
  borderRadius: "var(--radius-lg)",
  animation: "slide-in 0.3s ease-out",
};

const text: CSSProperties = {
  fontSize: "0.8rem",
  color: "var(--text-muted)",
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
};

const dotsContainer: CSSProperties = {
  display: "inline-flex",
  gap: "3px",
  alignItems: "center",
  marginLeft: "2px",
};

function formatName(role: string): string {
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function TypingDots() {
  return (
    <span style={dotsContainer}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: "var(--text-muted)",
            display: "inline-block",
            animation: `dot-bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
          }}
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
        <div key={agent} style={wrapper}>
          <AgentAvatar role={agent} size={42} status="working" />
          <span style={text}>
            {formatName(agent)} is working
            <TypingDots />
          </span>
        </div>
      ))}
    </>
  );
}
