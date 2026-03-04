"use client";

import { useState, useMemo } from "react";
import type { AgentResponse } from "@/lib/agents/types";
import { AgentAvatar } from "@/components/agent-avatar";
import { glassCard } from "@/lib/styles";

const AGENT_COLORS: Record<string, string> = {
  product_manager: "#a78bfa",
  frontend_developer: "#34d399",
  qa: "#facc15",
  devops: "#f97316",
  orchestrator: "#60a5fa",
};

const HIDDEN_TOOLS = new Set(["create_task", "write_code"]);
const SUMMARY_CLAMP = 3;

function formatAgentName(role: string): string {
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

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

  if (!expanded) {
    const firstText = segments.find((s) => s.type === "text");
    const preview = firstText?.content.trim().split("\n").slice(0, SUMMARY_CLAMP).join("\n") ?? "";
    const hasCode = segments.some((s) => s.type === "code");
    const hasMore = (firstText?.content.trim().split("\n").length ?? 0) > SUMMARY_CLAMP || segments.length > 1;

    return (
      <div className="text-[0.85rem] leading-relaxed text-[var(--text)]">
        <span className="whitespace-pre-wrap">{preview}</span>
        {hasMore && <span className="text-[var(--text-muted)]"> ...</span>}
        {hasCode && !expanded && (
          <span className="inline-block ml-1.5 px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[0.65rem] text-[var(--text-muted)] font-mono align-middle">
            + code
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="text-[0.85rem] leading-relaxed flex flex-col gap-1.5">
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <span key={i} className="whitespace-pre-wrap text-[var(--text)]">
            {seg.content.trim()}
          </span>
        ) : (
          <pre
            key={i}
            className="m-0 px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded text-[0.78rem] leading-normal max-h-[220px] overflow-auto text-[var(--text)]"
          >
            <code>{seg.content}</code>
          </pre>
        ),
      )}
    </div>
  );
}

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

  const hasCodeBlocks = /```/.test(response.summary);
  const lineCount = response.summary.trim().split("\n").length;
  const isLong = lineCount > SUMMARY_CLAMP || hasCodeBlocks;

  return (
    <div className={`${glassCard} p-3.5 flex flex-col gap-2 animate-slide-in`} style={{ borderLeft: `3px solid ${color}` }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AgentAvatar role={response.agent} size={40} status="done" />
          <span
            className="inline-block px-2 py-0.5 rounded-full text-[0.7rem] font-semibold uppercase tracking-wide"
            style={{ color, background: `${color}12`, border: `1px solid ${color}25` }}
          >
            {formatAgentName(response.agent)}
          </span>
        </div>
        {hiddenCount > 0 && (
          <span className="text-[0.65rem] text-[var(--text-muted)]">
            {hiddenCount} {hiddenCount === 1 ? "action" : "actions"}
          </span>
        )}
      </div>

      {/* Summary */}
      <SummaryContent text={response.summary} expanded={expanded} />
      {isLong && (
        <button className="bg-transparent border-none text-[var(--accent)] text-[0.75rem] cursor-pointer py-0.5 font-medium" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less" : "Show more"}
        </button>
      )}

      {/* Tool calls */}
      {visibleTools.length > 0 && (
        <div className="border-t border-[var(--glass-border)] pt-2">
          <button className="bg-transparent border-none text-[var(--accent)] text-[0.75rem] cursor-pointer py-0.5 font-medium" onClick={() => setShowTools((v) => !v)}>
            {showTools ? "Hide" : "Show"} tool calls ({visibleTools.length})
          </button>
          {showTools &&
            visibleTools.map((tc, i) => (
              <div key={i} className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-3 py-2 mt-1.5 text-[0.8rem] font-mono overflow-auto max-h-[200px]">
                <strong className="text-[var(--accent)] text-[0.75rem]">{tc.tool}</strong>
                <pre className="mt-1 text-[0.75rem]">
                  {JSON.stringify(tc.arguments, null, 2)}
                </pre>
                <pre className="mt-1 text-[0.75rem] text-[var(--success)]">
                  {JSON.stringify(tc.result, null, 2)}
                </pre>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
