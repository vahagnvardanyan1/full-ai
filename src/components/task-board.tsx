"use client";

import { useState } from "react";
import type { TaskItem } from "@/lib/agents/types";
import { AgentAvatar } from "@/components/agent-avatar";
import { glassCard } from "@/lib/styles";

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

export function TaskBoard({ tasks }: { tasks: TaskItem[] }) {
  const [expanded, setExpanded] = useState(false);

  if (tasks.length === 0) return null;

  return (
    <div className={`${glassCard} p-3 animate-slide-in`}>
      <div
        className="text-[0.8rem] font-semibold text-[var(--text-muted)] mb-2 flex items-center gap-1.5 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
          <rect x="1" y="2" width="6" height="5" rx="1" stroke="var(--text-muted)" strokeWidth="1.2" />
          <rect x="9" y="2" width="6" height="5" rx="1" stroke="var(--text-muted)" strokeWidth="1.2" />
          <rect x="1" y="9" width="6" height="5" rx="1" stroke="var(--text-muted)" strokeWidth="1.2" />
          <rect x="9" y="9" width="6" height="5" rx="1" stroke="var(--text-muted)" strokeWidth="1.2" />
        </svg>
        {tasks.length} {tasks.length === 1 ? "task" : "tasks"} created
        <span className="text-[0.65rem] text-[var(--text-muted)] ml-auto">
          {expanded ? "\u25B2" : "\u25BC"}
        </span>
      </div>
      {expanded && (
        <div>
          {tasks.map((task) => {
            const assigneeColor = ASSIGNEE_COLORS[task.assignedTo] ?? "#888";
            const priorityColor = PRIORITY_COLORS[task.priority] ?? "#888";

            return (
              <div
                key={task.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded bg-[var(--surface-raised)] border border-[var(--surface-border)] mb-1"
                style={{ borderLeft: `2px solid ${assigneeColor}` }}
              >
                <AgentAvatar role={task.assignedTo} size={28} />
                <span className="text-[0.78rem] font-medium flex-1 leading-tight">
                  {task.title}
                </span>
                <span
                  className="inline-block px-1.5 py-0.5 rounded-full text-[0.55rem] font-semibold uppercase tracking-tight shrink-0"
                  style={{ color: priorityColor, background: `${priorityColor}15`, border: `1px solid ${priorityColor}30` }}
                >
                  {task.priority}
                </span>
                <span className="font-mono text-[0.55rem] text-[var(--text-muted)] shrink-0">
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
