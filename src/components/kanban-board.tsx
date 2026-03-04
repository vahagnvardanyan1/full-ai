"use client";

import { useState, CSSProperties } from "react";
import type { TaskItem, TaskStatus } from "@/lib/agents/types";
import { AgentAvatar } from "@/components/agent-avatar";

// ── Status column config ─────────────────────────────────

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

// ── Styles ───────────────────────────────────────────────

const boardContainer: CSSProperties = {
  width: 360,
  height: "100%",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  background: "var(--panel-bg)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  borderLeft: "1px solid var(--panel-border)",
};

const boardHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0.85rem 1rem",
  borderBottom: "1px solid var(--panel-border)",
  flexShrink: 0,
};

const boardTitle: CSSProperties = {
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
};

const totalBadge: CSSProperties = {
  fontSize: "0.65rem",
  fontWeight: 600,
  padding: "0.15rem 0.5rem",
  borderRadius: 99,
  background: "var(--surface-hover)",
  border: "1px solid var(--surface-border)",
  color: "var(--text-muted)",
};

const columnsWrap: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "0.5rem 0.65rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.2rem",
};

const columnHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0.45rem 0.6rem",
  borderRadius: 8,
  cursor: "pointer",
  userSelect: "none",
  fontSize: "0.74rem",
  fontWeight: 600,
  transition: "background 0.15s",
};

const countBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 18,
  height: 18,
  borderRadius: 99,
  fontSize: "0.62rem",
  fontWeight: 700,
};

const cardStyle: CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--surface-border)",
  borderRadius: 10,
  padding: "0.6rem 0.7rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
  transition: "background 0.15s, border-color 0.15s",
  cursor: "default",
};

const cardTitle: CSSProperties = {
  fontSize: "0.76rem",
  fontWeight: 600,
  lineHeight: 1.35,
  color: "var(--text)",
};

const cardMeta: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.35rem",
  fontSize: "0.62rem",
};

const priorityPill: CSSProperties = {
  display: "inline-block",
  padding: "0.1rem 0.35rem",
  borderRadius: 4,
  fontSize: "0.55rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const emptyState: CSSProperties = {
  textAlign: "center",
  color: "var(--text-muted)",
  fontSize: "0.78rem",
  padding: "3rem 1.5rem",
  lineHeight: 1.5,
};

// ── Color maps ───────────────────────────────────────────

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

// ── Components ───────────────────────────────────────────

function TaskCard({ task, accentColor }: { task: TaskItem; accentColor: string }) {
  const priorityColor = PRIORITY_COLORS[task.priority] ?? "#888";

  return (
    <div
      style={{ ...cardStyle, borderLeft: `2.5px solid ${accentColor}` }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--surface-hover)";
        e.currentTarget.style.borderColor = `${accentColor}40`;
        e.currentTarget.style.borderLeftColor = accentColor;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--surface-raised)";
        e.currentTarget.style.borderColor = "var(--surface-border)";
        e.currentTarget.style.borderLeftColor = accentColor;
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
        <span style={cardTitle}>{task.title}</span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.55rem",
            color: "var(--text-muted)",
            flexShrink: 0,
            opacity: 0.6,
            marginTop: 1,
          }}
        >
          {task.id}
        </span>
      </div>
      <div style={cardMeta}>
        <AgentAvatar role={task.assignedTo} size={14} />
        <span style={{ color: "var(--text-muted)" }}>
          {formatAssignee(task.assignedTo)}
        </span>
        <span
          style={{
            ...priorityPill,
            color: priorityColor,
            background: `${priorityColor}15`,
          }}
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
        style={columnHeader}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `${config.color}08`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: config.color,
              flexShrink: 0,
              boxShadow: count > 0 ? `0 0 6px ${config.color}40` : "none",
            }}
          />
          <span style={{ color: count > 0 ? "var(--text)" : "var(--text-muted)" }}>
            {config.label}
          </span>
          <svg
            width={10}
            height={10}
            viewBox="0 0 10 10"
            fill="none"
            style={{
              transition: "transform 0.2s",
              transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
              opacity: 0.4,
            }}
          >
            <path d="M2.5 3.5L5 6.5L7.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span
          style={{
            ...countBadge,
            color: count > 0 ? config.color : "var(--text-muted)",
            background: count > 0 ? `${config.color}15` : "transparent",
          }}
        >
          {count}
        </span>
      </div>
      {expanded && count > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.35rem",
            padding: "0.35rem 0.25rem 0.5rem 0.25rem",
          }}
        >
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} accentColor={config.color} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main export ──────────────────────────────────────────

export function KanbanBoard({ tasks }: { tasks: TaskItem[] }) {
  const totalCount = tasks.length;

  if (totalCount === 0) {
    return (
      <div style={boardContainer}>
        <div style={boardHeader}>
          <span style={boardTitle}>Tasks</span>
        </div>
        <p style={emptyState}>
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
    <div style={boardContainer}>
      <div style={boardHeader}>
        <span style={boardTitle}>Tasks</span>
        <span style={totalBadge}>
          {doneCount}/{totalCount} done
        </span>
      </div>
      <div style={columnsWrap}>
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
