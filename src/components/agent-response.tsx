"use client";

import { CSSProperties, useState, useMemo } from "react";
import type { AgentResponse } from "@/lib/agents/types";
import { AgentAvatar } from "@/components/agent-avatar";

// ── Styling ──────────────────────────────────────────────

const AGENT_COLORS: Record<string, string> = {
  product_manager: "#a78bfa",
  frontend_developer: "#34d399",
  qa: "#facc15",
  devops: "#f97316",
  orchestrator: "#60a5fa",
};

const card: CSSProperties = {
  background: "var(--glass-bg)",
  backdropFilter: "blur(var(--glass-blur))",
  WebkitBackdropFilter: "blur(var(--glass-blur))",
  border: "1px solid var(--glass-border)",
  borderRadius: "var(--radius-lg)",
  padding: "0.875rem 1rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  animation: "slide-in 0.3s ease-out",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

const badge: CSSProperties = {
  display: "inline-block",
  padding: "0.15rem 0.5rem",
  borderRadius: "9999px",
  fontSize: "0.7rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const toolSection: CSSProperties = {
  borderTop: "1px solid var(--glass-border)",
  paddingTop: "0.5rem",
};

const toolItem: CSSProperties = {
  background: "var(--bg-tertiary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "0.5rem 0.75rem",
  marginTop: "0.4rem",
  fontSize: "0.8rem",
  fontFamily: "var(--font-mono)",
  overflow: "auto",
  maxHeight: 200,
};

const toggleBtnStyle: CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--accent)",
  fontSize: "0.75rem",
  cursor: "pointer",
  padding: "0.15rem 0",
  fontWeight: 500,
};

const HIDDEN_TOOLS = new Set(["create_task", "write_code"]);
const SUMMARY_CLAMP = 3;

// ── Helpers ──────────────────────────────────────────────

function formatAgentName(role: string): string {
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Split summary text into prose lines and code blocks, render nicely */
function SummaryContent({ text, expanded }: { text: string; expanded: boolean }) {
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

  // For collapsed: only show first text segment, truncated
  if (!expanded) {
    const firstText = segments.find((s) => s.type === "text");
    const preview = firstText?.content.trim().split("\n").slice(0, SUMMARY_CLAMP).join("\n") ?? "";
    const hasCode = segments.some((s) => s.type === "code");
    const hasMore = (firstText?.content.trim().split("\n").length ?? 0) > SUMMARY_CLAMP || segments.length > 1;

    return (
      <div style={{ fontSize: "0.85rem", lineHeight: 1.55, color: "var(--text)" }}>
        <span style={{ whiteSpace: "pre-wrap" }}>{preview}</span>
        {hasMore && <span style={{ color: "var(--text-muted)" }}> ...</span>}
        {hasCode && !expanded && (
          <span
            style={{
              display: "inline-block",
              marginLeft: "0.4rem",
              padding: "0.1rem 0.35rem",
              borderRadius: 4,
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border)",
              fontSize: "0.65rem",
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              verticalAlign: "middle",
            }}
          >
            + code
          </span>
        )}
      </div>
    );
  }

  return (
    <div style={{ fontSize: "0.85rem", lineHeight: 1.55, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <span key={i} style={{ whiteSpace: "pre-wrap", color: "var(--text)" }}>
            {seg.content.trim()}
          </span>
        ) : (
          <pre
            key={i}
            style={{
              margin: 0,
              padding: "0.6rem 0.75rem",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: "0.78rem",
              lineHeight: 1.5,
              maxHeight: 220,
              overflowY: "auto",
              overflowX: "auto",
              color: "var(--text)",
            }}
          >
            <code>{seg.content}</code>
          </pre>
        ),
      )}
    </div>
  );
}

// ── Component ────────────────────────────────────────────

export function AgentResponseCard({
  response,
}: {
  response: AgentResponse;
}) {
  const [showTools, setShowTools] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const color = AGENT_COLORS[response.agent] ?? "#888";

  const visibleTools = response.toolCalls.filter(
    (tc) => !HIDDEN_TOOLS.has(tc.tool),
  );
  const hiddenCount = response.toolCalls.length - visibleTools.length;

  // Determine if summary is long enough to need expand toggle
  const hasCodeBlocks = /```/.test(response.summary);
  const lineCount = response.summary.trim().split("\n").length;
  const isLong = lineCount > SUMMARY_CLAMP || hasCodeBlocks;

  return (
    <div style={{ ...card, borderLeft: `3px solid ${color}` }}>
      {/* Header: avatar + badge + actions count */}
      <div style={{ ...headerStyle, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <AgentAvatar role={response.agent} size={26} status="done" />
          <span
            style={{
              ...badge,
              color,
              background: `${color}12`,
              border: `1px solid ${color}25`,
            }}
          >
            {formatAgentName(response.agent)}
          </span>
        </div>
        {hiddenCount > 0 && (
          <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
            {hiddenCount} {hiddenCount === 1 ? "action" : "actions"}
          </span>
        )}
      </div>

      {/* Summary — collapsible */}
      <SummaryContent text={response.summary} expanded={expanded} />
      {isLong && (
        <button style={toggleBtnStyle} onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less" : "Show more"}
        </button>
      )}

      {/* Tool calls */}
      {visibleTools.length > 0 && (
        <div style={toolSection}>
          <button style={toggleBtnStyle} onClick={() => setShowTools((v) => !v)}>
            {showTools ? "Hide" : "Show"} tool calls ({visibleTools.length})
          </button>
          {showTools &&
            visibleTools.map((tc, i) => (
              <div key={i} style={toolItem}>
                <strong style={{ color: "var(--accent)", fontSize: "0.75rem" }}>{tc.tool}</strong>
                <pre style={{ marginTop: "0.25rem", fontSize: "0.75rem" }}>
                  {JSON.stringify(tc.arguments, null, 2)}
                </pre>
                <pre
                  style={{
                    marginTop: "0.25rem",
                    fontSize: "0.75rem",
                    color: "var(--success)",
                  }}
                >
                  {JSON.stringify(tc.result, null, 2)}
                </pre>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
