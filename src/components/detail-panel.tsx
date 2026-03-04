"use client";

import { CSSProperties, useState, useMemo, useEffect } from "react";
import type { AgentResponse, TaskItem, GeneratedFile } from "@/lib/agents/types";
import { AgentAvatar } from "@/components/agent-avatar";

// ── Types ──────────────────────────────────────────────

interface DetailPanelProps {
  agent: string;
  response: AgentResponse;
  tasks: TaskItem[];
  files: GeneratedFile[];
  onClose: () => void;
}

// ── Colors ─────────────────────────────────────────────

const AGENT_COLORS: Record<string, string> = {
  product_manager: "#a78bfa",
  frontend_developer: "#34d399",
  qa: "#facc15",
  devops: "#f97316",
  orchestrator: "#60a5fa",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "#ef4444",
  medium: "#eab308",
  low: "#6b7280",
};

function formatName(role: string): string {
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Styles ─────────────────────────────────────────────

const overlay: CSSProperties = {
  position: "absolute",
  top: 10,
  left: "50%",
  transform: "translateX(-50%)",
  width: "min(560px, calc(100% - 2rem))",
  maxHeight: "50vh",
  background: "var(--panel-bg)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid var(--panel-border)",
  borderRadius: 16,
  display: "flex",
  flexDirection: "column",
  zIndex: 55,
  animation: "panel-slide-down 0.25s ease-out",
  overflowY: "auto",
  boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
};

const panelHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  padding: "1rem 1.25rem",
  borderBottom: "1px solid var(--panel-border)",
  position: "sticky",
  top: 0,
  background: "var(--panel-bg)",
  backdropFilter: "blur(12px)",
  borderRadius: "16px 16px 0 0",
  zIndex: 2,
};

const closeBtn: CSSProperties = {
  marginLeft: "auto",
  background: "var(--surface-raised)",
  border: "1px solid var(--surface-border)",
  borderRadius: 8,
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  transition: "background 0.15s",
};

const section: CSSProperties = {
  padding: "0.875rem 1.25rem",
  borderBottom: "1px solid var(--surface-border)",
};

const sectionLabel: CSSProperties = {
  fontSize: "0.65rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--text-muted)",
  marginBottom: "0.5rem",
};

const pill: CSSProperties = {
  display: "inline-block",
  padding: "0.1rem 0.4rem",
  borderRadius: "9999px",
  fontSize: "0.6rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

// ── Summary renderer ───────────────────────────────────

function SummaryBlock({ text }: { text: string }) {
  const segments = useMemo(() => {
    const parts: { type: "text" | "code"; content: string; lang?: string }[] = [];
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIdx = 0;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push({ type: "text", content: text.slice(lastIdx, match.index) });
      }
      parts.push({ type: "code", content: match[2], lang: match[1] });
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < text.length) {
      parts.push({ type: "text", content: text.slice(lastIdx) });
    }
    return parts;
  }, [text]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <p key={i} style={{ fontSize: "0.82rem", lineHeight: 1.55, color: "var(--text)", whiteSpace: "pre-wrap", margin: 0 }}>
            {seg.content.trim()}
          </p>
        ) : (
          <pre
            key={i}
            style={{
              margin: 0,
              padding: "0.6rem 0.75rem",
              background: "var(--code-bg)",
              border: "1px solid var(--surface-border)",
              borderRadius: 8,
              fontSize: "0.72rem",
              lineHeight: 1.45,
              maxHeight: 200,
              overflowY: "auto",
              overflowX: "auto",
              color: "var(--text)",
              whiteSpace: "pre",
            }}
          >
            <code>{seg.content}</code>
          </pre>
        ),
      )}
    </div>
  );
}

// ── Task row ───────────────────────────────────────────

function TaskRow({ task }: { task: TaskItem }) {
  const assigneeColor = AGENT_COLORS[task.assignedTo] ?? "#888";
  const priorityColor = PRIORITY_COLORS[task.priority] ?? "#888";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.4rem 0.5rem",
        borderRadius: 8,
        background: "var(--surface-hover)",
        border: "1px solid var(--surface-border)",
        borderLeft: `2px solid ${assigneeColor}`,
      }}
    >
      <AgentAvatar role={task.assignedTo} size={16} />
      <span style={{ fontSize: "0.75rem", fontWeight: 500, flex: 1, lineHeight: 1.3 }}>
        {task.title}
      </span>
      <span
        style={{
          ...pill,
          color: priorityColor,
          background: `${priorityColor}12`,
          border: `1px solid ${priorityColor}25`,
        }}
      >
        {task.priority}
      </span>
    </div>
  );
}

// ── File row ───────────────────────────────────────────

function FileRow({ file }: { file: GeneratedFile }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(file.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      style={{
        borderRadius: 8,
        background: "var(--surface-hover)",
        border: "1px solid var(--surface-border)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.4rem 0.6rem",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{open ? "\u25BE" : "\u25B8"}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--accent)", fontWeight: 600, flex: 1 }}>
          {file.filePath}
        </span>
        <span style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>{file.code.split("\n").length}L</span>
        <button
          onClick={(e) => { e.stopPropagation(); handleCopy(); }}
          style={{
            padding: "1px 6px",
            borderRadius: 4,
            border: "1px solid var(--surface-border)",
            background: "var(--surface-hover)",
            color: "var(--text-muted)",
            fontSize: "0.58rem",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
          }}
        >
          {copied ? "\u2713" : "Copy"}
        </button>
      </div>
      {open && (
        <pre
          style={{
            margin: 0,
            padding: "0.6rem",
            background: "var(--code-bg)",
            borderTop: "1px solid var(--surface-border)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.7rem",
            lineHeight: 1.45,
            maxHeight: 240,
            overflowY: "auto",
            overflowX: "auto",
            whiteSpace: "pre",
            color: "var(--text)",
          }}
        >
          <code>{file.code}</code>
        </pre>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────

export function DetailPanel({ agent, response, tasks, files, onClose }: DetailPanelProps) {
  const color = AGENT_COLORS[agent] ?? "#888";

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div style={overlay}>
      {/* Header */}
      <div style={panelHeader}>
        <AgentAvatar role={agent} size={32} status="done" />
        <div>
          <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>{formatName(agent)}</div>
          <div style={{ fontSize: "0.65rem", color: "var(--success)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Complete
          </div>
        </div>
        <button style={closeBtn} onClick={onClose} title="Close">
          <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
            <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Summary */}
      <div style={section}>
        <div style={sectionLabel}>Summary</div>
        <SummaryBlock text={response.summary} />
      </div>

      {/* Tasks */}
      {tasks.length > 0 && (
        <div style={section}>
          <div style={sectionLabel}>{tasks.length} {tasks.length === 1 ? "Task" : "Tasks"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      {files.length > 0 && (
        <div style={section}>
          <div style={sectionLabel}>{files.length} {files.length === 1 ? "File" : "Files"} Generated</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {files.map((file) => (
              <FileRow key={file.id} file={file} />
            ))}
          </div>
        </div>
      )}

      {/* Tool calls */}
      {response.toolCalls.length > 0 && (
        <div style={{ ...section, borderBottom: "none" }}>
          <div style={sectionLabel}>{response.toolCalls.length} Tool Calls</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {response.toolCalls.map((tc, i) => (
              <div
                key={i}
                style={{
                  fontSize: "0.7rem",
                  padding: "0.3rem 0.5rem",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-muted)",
                }}
              >
                <span style={{ color: "var(--accent)" }}>{tc.tool}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
