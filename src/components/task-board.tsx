"use client";

import { CSSProperties, useState } from "react";
import type { TaskItem } from "@/lib/agents/types";
import { AgentAvatar } from "@/components/agent-avatar";

// ── Styling ──────────────────────────────────────────────

const board: CSSProperties = {
  background: "var(--glass-bg)",
  backdropFilter: "blur(var(--glass-blur))",
  WebkitBackdropFilter: "blur(var(--glass-blur))",
  border: "1px solid var(--glass-border)",
  borderRadius: "var(--radius-lg)",
  padding: "0.75rem 0.875rem",
  animation: "slide-in 0.3s ease-out",
};

const boardTitle: CSSProperties = {
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: "0.5rem",
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  cursor: "pointer",
  userSelect: "none",
};

const taskRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.4rem 0.5rem",
  borderRadius: "var(--radius)",
  background: "rgba(255, 255, 255, 0.02)",
  border: "1px solid var(--glass-border)",
  marginBottom: "0.3rem",
};

const pill: CSSProperties = {
  display: "inline-block",
  padding: "0.08rem 0.35rem",
  borderRadius: "9999px",
  fontSize: "0.55rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  flexShrink: 0,
};

const ASSIGNEE_COLORS: Record<string, string> = {
  frontend_developer: "#34d399",
  qa: "#facc15",
  devops: "#f97316",
  product_manager: "#a78bfa",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "#ef4444",
  medium: "#eab308",
  low: "#6b7280",
};

// ── Component ────────────────────────────────────────────

export function TaskBoard({ tasks }: { tasks: TaskItem[] }) {
  const [expanded, setExpanded] = useState(false);

  if (tasks.length === 0) return null;

  return (
    <div style={board}>
      <div style={boardTitle} onClick={() => setExpanded((v) => !v)}>
        <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
          <rect x="1" y="2" width="6" height="5" rx="1" stroke="var(--text-muted)" strokeWidth="1.2" />
          <rect x="9" y="2" width="6" height="5" rx="1" stroke="var(--text-muted)" strokeWidth="1.2" />
          <rect x="1" y="9" width="6" height="5" rx="1" stroke="var(--text-muted)" strokeWidth="1.2" />
          <rect x="9" y="9" width="6" height="5" rx="1" stroke="var(--text-muted)" strokeWidth="1.2" />
        </svg>
        {tasks.length} {tasks.length === 1 ? "task" : "tasks"} created
        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginLeft: "auto" }}>
          {expanded ? "\u25B2" : "\u25BC"}
        </span>
      </div>
      {expanded && (
        <div>
          {tasks.map((task) => {
            const assigneeColor = ASSIGNEE_COLORS[task.assignedTo] ?? "#888";
            const priorityColor = PRIORITY_COLORS[task.priority] ?? "#888";

            return (
              <div key={task.id} style={{ ...taskRow, borderLeft: `2px solid ${assigneeColor}` }}>
                <AgentAvatar role={task.assignedTo} size={18} />
                <span style={{ fontSize: "0.78rem", fontWeight: 500, flex: 1, lineHeight: 1.3 }}>
                  {task.title}
                </span>
                <span
                  style={{
                    ...pill,
                    color: priorityColor,
                    background: `${priorityColor}15`,
                    border: `1px solid ${priorityColor}30`,
                  }}
                >
                  {task.priority}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.55rem",
                    color: "var(--text-muted)",
                    flexShrink: 0,
                  }}
                >
                  {task.id}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
