"use client";

import { useState } from "react";
import type { TaskItem, TaskStatus } from "@/lib/agents/types";
import { AgentAvatar } from "@/components/agent-avatar";
import { panelBase, closeBtnBase } from "@/lib/styles";

interface ColumnConfig {
  status: TaskStatus;
  label: string;
  color: string;
}

const COLUMNS: ColumnConfig[] = [
  { status: "open", label: "Open", color: "#6b7280" },
  { status: "in_progress", label: "In Progress", color: "#3b82f6" },
  { status: "review", label: "Code Review", color: "#a78bfa" },
  { status: "testing", label: "Testing", color: "#facc15" },
  { status: "done", label: "Done", color: "#22c55e" },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: "#ef4444",
  medium: "#eab308",
  low: "#6b7280",
};

function formatAssignee(role: string): string {
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function TaskCard({ task, accentColor }: { task: TaskItem; accentColor: string }) {
  const priorityColor = PRIORITY_COLORS[task.priority] ?? "#888";

  return (
    <div
      className="bg-[var(--surface-raised)] border border-[var(--surface-border)] rounded-[10px] px-3 py-2.5 flex flex-col gap-1.5 transition-colors cursor-default hover:bg-[var(--surface-hover)]"
      style={{ borderLeft: `2.5px solid ${accentColor}` }}
    >
      <div className="flex justify-between items-start gap-2">
        <span className="text-[0.76rem] font-semibold leading-tight text-[var(--text)]">{task.title}</span>
        <span className="font-mono text-[0.55rem] text-[var(--text-muted)] shrink-0 opacity-60 mt-px">
          {task.id}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-[0.62rem]">
        <AgentAvatar role={task.assignedTo} size={22} />
        <span className="text-[var(--text-muted)]">
          {formatAssignee(task.assignedTo)}
        </span>
        <span
          className="inline-block px-1.5 py-0.5 rounded text-[0.55rem] font-bold uppercase tracking-tight"
          style={{ color: priorityColor, background: `${priorityColor}15` }}
        >
          {task.priority}
        </span>
      </div>
    </div>
  );
}

function StatusColumn({
  config,
  tasks,
}: {
  config: ColumnConfig;
  tasks: TaskItem[];
}) {
  const count = tasks.length;
  const [expanded, setExpanded] = useState(count > 0);

  return (
    <div>
      <div
        className="flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer select-none text-[0.74rem] font-semibold transition-colors hover:bg-[var(--surface-hover)]"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span
            className="size-[7px] rounded-full shrink-0"
            style={{
              background: config.color,
              boxShadow: count > 0 ? `0 0 6px ${config.color}40` : "none",
            }}
          />
          <span className={count > 0 ? "text-[var(--text)]" : "text-[var(--text-muted)]"}>
            {config.label}
          </span>
          <svg
            width={10}
            height={10}
            viewBox="0 0 10 10"
            fill="none"
            className="transition-transform duration-200 opacity-40"
            style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
          >
            <path d="M2.5 3.5L5 6.5L7.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span
          className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[0.62rem] font-bold"
          style={{
            color: count > 0 ? config.color : "var(--text-muted)",
            background: count > 0 ? `${config.color}15` : "transparent",
          }}
        >
          {count}
        </span>
      </div>
      {expanded && count > 0 && (
        <div className="flex flex-col gap-1.5 px-1 py-1.5 pb-2">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} accentColor={config.color} />
          ))}
        </div>
      )}
    </div>
  );
}

export function KanbanBoard({ tasks, onClose }: { tasks: TaskItem[]; onClose: () => void }) {
  const totalCount = tasks.length;

  const closeButton = (
    <button className={closeBtnBase} onClick={onClose} title="Close">
      <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
        <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );

  if (totalCount === 0) {
    return (
      <div className={`${panelBase} absolute inset-0 sm:inset-auto sm:top-2.5 sm:right-2.5 sm:bottom-2.5 sm:w-[360px] sm:max-w-[calc(100%-20px)] overflow-y-auto flex flex-col rounded-none sm:rounded-2xl z-50 animate-panel-slide-in shadow-[0_8px_32px_rgba(0,0,0,0.12)]`}>
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--panel-border)] shrink-0 sticky top-0 bg-[var(--panel-bg)] backdrop-blur-[12px] sm:rounded-t-2xl z-2">
          <span className="text-[0.78rem] font-bold tracking-wide uppercase text-[var(--text-muted)]">Tasks</span>
          {closeButton}
        </div>
        <p className="text-center text-[var(--text-muted)] text-[0.78rem] py-12 px-6 leading-relaxed">
          No tasks yet. Send a request to get started.
        </p>
      </div>
    );
  }

  const grouped = new Map<TaskStatus, TaskItem[]>();
  for (const col of COLUMNS) {
    grouped.set(col.status, []);
  }
  for (const task of tasks) {
    const list = grouped.get(task.status);
    if (list) {
      list.push(task);
    } else {
      grouped.get("open")!.push(task);
    }
  }

  const doneCount = grouped.get("done")?.length ?? 0;

  return (
    <div className={`${panelBase} absolute inset-0 sm:inset-auto sm:top-2.5 sm:right-2.5 sm:bottom-2.5 sm:w-[360px] sm:max-w-[calc(100%-20px)] overflow-y-auto flex flex-col rounded-none sm:rounded-2xl z-50 animate-panel-slide-in shadow-[0_8px_32px_rgba(0,0,0,0.12)]`}>
      <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--panel-border)] shrink-0 sticky top-0 bg-[var(--panel-bg)] backdrop-blur-[12px] sm:rounded-t-2xl z-2">
        <span className="text-[0.78rem] font-bold tracking-wide uppercase text-[var(--text-muted)]">Tasks</span>
        <span className="text-[0.65rem] font-semibold px-2 py-0.5 rounded-full bg-[var(--surface-hover)] border border-[var(--surface-border)] text-[var(--text-muted)]">
          {doneCount}/{totalCount} done
        </span>
        {closeButton}
      </div>
      <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-0.5">
        {COLUMNS.map((col) => (
          <StatusColumn
            key={col.status}
            config={col}
            tasks={grouped.get(col.status) ?? []}
          />
        ))}
      </div>
    </div>
  );
}
