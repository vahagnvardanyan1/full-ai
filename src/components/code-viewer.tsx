"use client";

import { CSSProperties, useState } from "react";
import type { GeneratedFile } from "@/lib/agents/types";
import { AgentAvatar } from "@/components/agent-avatar";

// ── Styling ──────────────────────────────────────────────

const wrapper: CSSProperties = {
  background: "var(--glass-bg)",
  backdropFilter: "blur(var(--glass-blur))",
  WebkitBackdropFilter: "blur(var(--glass-blur))",
  border: "1px solid var(--glass-border)",
  borderRadius: "var(--radius-lg)",
  padding: "0.75rem 0.875rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  animation: "slide-in 0.3s ease-out",
};

const sectionTitle: CSSProperties = {
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "var(--text-muted)",
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
};

const fileCard: CSSProperties = {
  background: "rgba(255, 255, 255, 0.02)",
  border: "1px solid var(--glass-border)",
  borderRadius: "var(--radius)",
  overflow: "hidden",
};

const fileHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0.5rem 0.75rem",
  cursor: "pointer",
  userSelect: "none",
  gap: "0.5rem",
};

const filePathStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "var(--accent)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const codeBlock: CSSProperties = {
  margin: 0,
  padding: "0.75rem",
  background: "var(--bg)",
  fontFamily: "var(--font-mono)",
  fontSize: "0.75rem",
  lineHeight: 1.5,
  overflowX: "auto",
  whiteSpace: "pre",
  color: "var(--text)",
  maxHeight: 300,
  overflowY: "auto",
  borderTop: "1px solid var(--border)",
};

const pill: CSSProperties = {
  display: "inline-block",
  padding: "0.1rem 0.4rem",
  borderRadius: "9999px",
  fontSize: "0.6rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const AGENT_COLORS: Record<string, string> = {
  frontend_developer: "#34d399",
  qa: "#facc15",
  devops: "#f97316",
  product_manager: "#a78bfa",
};

const copyBtn: CSSProperties = {
  padding: "0.15rem 0.45rem",
  borderRadius: "4px",
  border: "1px solid var(--glass-border)",
  background: "rgba(255, 255, 255, 0.04)",
  color: "var(--text-muted)",
  fontSize: "0.6rem",
  cursor: "pointer",
  fontFamily: "var(--font-mono)",
  transition: "background 0.15s",
  flexShrink: 0,
};

const rightGroup: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.35rem",
  flexShrink: 0,
};

function formatAgent(role: string): string {
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Single file ──────────────────────────────────────────

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
    <div style={fileCard}>
      <div style={fileHeader} onClick={() => setOpen((v) => !v)}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", minWidth: 0, flex: 1 }}>
          <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", flexShrink: 0 }}>
            {open ? "\u25BE" : "\u25B8"}
          </span>
          <span style={filePathStyle}>{file.filePath}</span>
          <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", flexShrink: 0 }}>
            {lineCount}L
          </span>
        </div>
        <div style={rightGroup}>
          <AgentAvatar role={file.createdBy} size={24} />
          <span
            style={{
              ...pill,
              color,
              background: `${color}12`,
              border: `1px solid ${color}25`,
            }}
          >
            {formatAgent(file.createdBy)}
          </span>
          <span
            style={{
              ...pill,
              color: "var(--text-muted)",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid var(--glass-border)",
            }}
          >
            {file.language}
          </span>
          <button
            style={copyBtn}
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
            <div
              style={{
                fontSize: "0.7rem",
                color: "var(--text-muted)",
                padding: "0.3rem 0.75rem 0",
              }}
            >
              {file.description}
            </div>
          )}
          <pre style={codeBlock}>
            <code>{file.code}</code>
          </pre>
        </>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────

export function CodeViewer({ files }: { files: GeneratedFile[] }) {
  if (files.length === 0) return null;

  return (
    <div style={wrapper}>
      <div style={sectionTitle}>
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
