"use client";

import { CSSProperties } from "react";
import type { AgentRole } from "@/lib/agents/types";

export type AvatarStatus = "idle" | "working" | "done" | "error";

interface AgentAvatarProps {
  role: AgentRole | string;
  size?: number;
  status?: AvatarStatus;
}

const AGENT_COLORS: Record<string, string> = {
  product_manager: "#a78bfa",
  frontend_developer: "#34d399",
  qa: "#facc15",
  devops: "#f97316",
  orchestrator: "#60a5fa",
};

const AGENT_SEEDS: Record<string, string> = {
  product_manager: "PM-Strategy",
  frontend_developer: "Dev-Code",
  qa: "QA-Bug",
  devops: "DevOps-Cloud",
  orchestrator: "Orchestrator-Hub",
};

const STATUS_COLORS: Record<AvatarStatus, string> = {
  idle: "transparent",
  working: "#3b82f6",
  done: "#22c55e",
  error: "#ef4444",
};

export function AgentAvatar({ role, size = 36, status }: AgentAvatarProps) {
  const color = AGENT_COLORS[role] ?? "#888";
  const seed = AGENT_SEEDS[role] ?? role;

  const container: CSSProperties = {
    position: "relative",
    width: size,
    height: size,
    flexShrink: 0,
  };

  const imgWrapper: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    background: `${color}20`,
    border: `1.5px solid ${color}40`,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const dotSize = Math.max(8, size * 0.25);
  const showDot = status && status !== "idle";
  const dotColor = status ? STATUS_COLORS[status] : "transparent";

  return (
    <div style={container}>
      <div style={imgWrapper}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://api.dicebear.com/9.x/bottts/svg?seed=${seed}`}
          alt={role}
          width={size}
          height={size}
          style={{ width: size, height: size, objectFit: "cover" }}
        />
      </div>
      {showDot && (
        <div
          style={{
            position: "absolute",
            bottom: -1,
            right: -1,
            width: dotSize,
            height: dotSize,
            borderRadius: "50%",
            background: dotColor,
            border: "2px solid var(--bg-secondary)",
            animation: status === "working" ? "pulse 1.2s ease-in-out infinite" : undefined,
          }}
        />
      )}
    </div>
  );
}
