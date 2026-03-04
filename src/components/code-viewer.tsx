"use client";

import { useState } from "react";
import type { GeneratedFile } from "@/lib/agents/types";
import { AgentAvatar } from "@/components/agent-avatar";
import { glassCard } from "@/lib/styles";

const AGENT_COLORS: Record<string, string> = {
  frontend_developer: "#34d399",
  qa: "#facc15",
  devops: "#f97316",
  product_manager: "#a78bfa",
};

function formatAgent(role: string): string {
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function FileItem({ file }: { file: GeneratedFile }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const color = AGENT_COLORS[file.createdBy] ?? "#888";
  const lineCount = file.code.split("\n").length;

  function handleCopy() {
    navigator.clipboard.writeText(file.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white/[0.02] border border-[var(--glass-border)] rounded overflow-hidden">
      <div className="flex justify-between items-center px-3 py-2 cursor-pointer select-none gap-2" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-[var(--text-muted)] text-[0.7rem] shrink-0">
            {open ? "\u25BE" : "\u25B8"}
          </span>
          <span className="font-mono text-[0.75rem] font-semibold text-[var(--accent)] overflow-hidden text-ellipsis whitespace-nowrap">
            {file.filePath}
          </span>
          <span className="text-[0.6rem] text-[var(--text-muted)] shrink-0">
            {lineCount}L
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <AgentAvatar role={file.createdBy} size={24} />
          <span
            className="inline-block px-1.5 py-0.5 rounded-full text-[0.6rem] font-semibold uppercase tracking-tight"
            style={{ color, background: `${color}12`, border: `1px solid ${color}25` }}
          >
            {formatAgent(file.createdBy)}
          </span>
          <span className="inline-block px-1.5 py-0.5 rounded-full text-[0.6rem] font-semibold uppercase tracking-tight text-[var(--text-muted)] bg-white/[0.03] border border-[var(--glass-border)]">
            {file.language}
          </span>
          <button
            className="px-2 py-0.5 rounded border border-[var(--glass-border)] bg-white/[0.04] text-[var(--text-muted)] text-[0.6rem] cursor-pointer font-mono transition-colors shrink-0 hover:bg-white/[0.08]"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
          >
            {copied ? "\u2713" : "Copy"}
          </button>
        </div>
      </div>
      {open && (
        <>
          {file.description && (
            <div className="text-[0.7rem] text-[var(--text-muted)] px-3 pt-1">
              {file.description}
            </div>
          )}
          <pre className="m-0 p-3 bg-[var(--bg)] font-mono text-[0.75rem] leading-normal overflow-x-auto whitespace-pre text-[var(--text)] max-h-[300px] overflow-y-auto border-t border-[var(--border)]">
            <code>{file.code}</code>
          </pre>
        </>
      )}
    </div>
  );
}

export function CodeViewer({ files }: { files: GeneratedFile[] }) {
  if (files.length === 0) return null;

  return (
    <div className={`${glassCard} p-3 flex flex-col gap-2 animate-slide-in`}>
      <div className="text-[0.8rem] font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
        <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="1" width="12" height="14" rx="2" stroke="var(--text-muted)" strokeWidth="1.3" />
          <line x1="5" y1="5" x2="11" y2="5" stroke="var(--text-muted)" strokeWidth="1" strokeLinecap="round" />
          <line x1="5" y1="8" x2="9" y2="8" stroke="var(--text-muted)" strokeWidth="1" strokeLinecap="round" />
        </svg>
        {files.length} {files.length === 1 ? "file" : "files"} generated
      </div>
      {files.map((file) => (
        <FileItem key={file.id} file={file} />
      ))}
    </div>
  );
}
