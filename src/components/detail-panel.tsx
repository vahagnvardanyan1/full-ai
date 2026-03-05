"use client";

import { useState, useMemo, useEffect } from "react";
import type { AgentResponse, TaskItem, GeneratedFile } from "@/lib/agents/types";
import { AgentAvatar } from "@/components/agent-avatar";
import { OutfitDisplay } from "@/components/fashion/outfit-display";
import { panelBase, sectionLabel, pillBase, closeBtnBase } from "@/lib/styles";

interface DetailPanelProps {
  agent: string;
  response: AgentResponse;
  tasks: TaskItem[];
  files: GeneratedFile[];
  onClose: () => void;
}

const AGENT_COLORS: Record<string, string> = {
  product_manager: "#a78bfa",
  frontend_developer: "#34d399",
  qa: "#facc15",
  devops: "#f97316",
  orchestrator: "#60a5fa",
  fashion_stylist: "#ec4899",
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
    <div className="flex flex-col gap-1.5">
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <p key={i} className="text-[0.82rem] leading-relaxed text-[var(--text)] whitespace-pre-wrap m-0">
            {seg.content.trim()}
          </p>
        ) : (
          <pre
            key={i}
            className="m-0 px-3 py-2.5 bg-[var(--code-bg)] border border-[var(--surface-border)] rounded-lg text-[0.72rem] leading-snug max-h-[200px] overflow-auto text-[var(--text)] whitespace-pre"
          >
            <code>{seg.content}</code>
          </pre>
        ),
      )}
    </div>
  );
}

function TaskRow({ task }: { task: TaskItem }) {
  const assigneeColor = AGENT_COLORS[task.assignedTo] ?? "#888";
  const priorityColor = PRIORITY_COLORS[task.priority] ?? "#888";

  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--surface-hover)] border border-[var(--surface-border)]"
      style={{ borderLeft: `2px solid ${assigneeColor}` }}
    >
      <AgentAvatar role={task.assignedTo} size={24} />
      <span className="text-[0.75rem] font-medium flex-1 leading-tight">
        {task.title}
      </span>
      <span
        className={pillBase}
        style={{ color: priorityColor, background: `${priorityColor}12`, border: `1px solid ${priorityColor}25` }}
      >
        {task.priority}
      </span>
    </div>
  );
}

function FileRow({ file }: { file: GeneratedFile }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(file.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-lg bg-[var(--surface-hover)] border border-[var(--surface-border)] overflow-hidden">
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-[0.65rem] text-[var(--text-muted)]">{open ? "\u25BE" : "\u25B8"}</span>
        <span className="font-mono text-[0.72rem] text-[var(--accent)] font-semibold flex-1">
          {file.filePath}
        </span>
        <span className="text-[0.6rem] text-[var(--text-muted)]">{file.code.split("\n").length}L</span>
        <button
          onClick={(e) => { e.stopPropagation(); handleCopy(); }}
          className="px-1.5 py-px rounded border border-[var(--surface-border)] bg-[var(--surface-hover)] text-[var(--text-muted)] text-[0.58rem] cursor-pointer font-mono"
        >
          {copied ? "\u2713" : "Copy"}
        </button>
      </div>
      {open && (
        <pre className="m-0 p-2.5 bg-[var(--code-bg)] border-t border-[var(--surface-border)] font-mono text-[0.7rem] leading-snug max-h-[240px] overflow-auto whitespace-pre text-[var(--text)]">
          <code>{file.code}</code>
        </pre>
      )}
    </div>
  );
}

export function DetailPanel({ agent, response, tasks, files, onClose }: DetailPanelProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center sm:pt-2.5 pointer-events-none">
    <div className={`${panelBase} w-full sm:w-[min(560px,calc(100%-2rem))] max-w-[560px] h-full sm:h-auto sm:max-h-[50vh] rounded-none sm:rounded-2xl flex flex-col overflow-y-auto shadow-[0_8px_32px_rgba(0,0,0,0.12)] pointer-events-auto`} style={{ animation: "panel-slide-down 0.25s ease-out forwards" }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[var(--panel-border)] sticky top-0 bg-[var(--panel-bg)] backdrop-blur-[12px] rounded-t-2xl z-2">
        <AgentAvatar role={agent} size={48} status="done" />
        <div>
          <div className="text-[0.9rem] font-semibold">{formatName(agent)}</div>
          <div className="text-[0.65rem] text-[var(--success)] font-medium uppercase tracking-wide">
            Complete
          </div>
        </div>
        <button className={closeBtnBase} onClick={onClose} title="Close">
          <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
            <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Summary */}
      <div className="px-5 py-3.5 border-b border-[var(--surface-border)]">
        <div className={sectionLabel}>Summary</div>
        <SummaryBlock text={response.summary} />
      </div>

      {/* Outfit Recommendation (Fashion Stylist) */}
      {response.outfitRecommendation && response.outfitRecommendation.items.length > 0 && (
        <div className="px-5 py-3.5 border-b border-[var(--surface-border)]">
          <OutfitDisplay outfit={response.outfitRecommendation} />
        </div>
      )}

      {/* Tasks */}
      {tasks.length > 0 && (
        <div className="px-5 py-3.5 border-b border-[var(--surface-border)]">
          <div className={sectionLabel}>{tasks.length} {tasks.length === 1 ? "Task" : "Tasks"}</div>
          <div className="flex flex-col gap-1.5">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      {files.length > 0 && (
        <div className="px-5 py-3.5 border-b border-[var(--surface-border)]">
          <div className={sectionLabel}>{files.length} {files.length === 1 ? "File" : "Files"} Generated</div>
          <div className="flex flex-col gap-1.5">
            {files.map((file) => (
              <FileRow key={file.id} file={file} />
            ))}
          </div>
        </div>
      )}

      {/* Tool calls */}
      {response.toolCalls.length > 0 && (
        <div className="px-5 py-3.5">
          <div className={sectionLabel}>{response.toolCalls.length} Tool Calls</div>
          <div className="flex flex-col gap-1">
            {response.toolCalls.map((tc, i) => (
              <div
                key={i}
                className="text-[0.7rem] px-2 py-1 rounded-md bg-[var(--surface-raised)] border border-[var(--surface-border)] font-mono text-[var(--text-muted)]"
              >
                <span className="text-[var(--accent)]">{tc.tool}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
